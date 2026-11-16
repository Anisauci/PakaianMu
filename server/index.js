import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, UPLOAD_DIR } from './db.js';
import {
  COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  parseCookies,
  setSessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    role: row.role,
    status: row.status,
    waNumber: row.wa_number,
    createdAt: row.created_at,
  };
}

function normalizeWa(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function text(value) {
  return String(value ?? '').trim();
}

function productRow(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    nama: row.nama,
    kategoriId: row.category_id,
    kategori: row.kategori,
    harga: row.harga,
    stok: row.stok,
    deskripsi: row.deskripsi,
    imageUrl: row.image_url || null,
    unggulan: Boolean(row.unggulan),
    sellerName: row.seller_name ?? undefined,
    waNumber: row.wa_number ?? undefined,
    updatedAt: row.updated_at,
  };
}

const productSelect = `
  SELECT p.*, c.nama AS kategori, u.nama AS seller_name, u.wa_number
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

function currentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const uid = verifySessionToken(cookies[COOKIE_NAME]);
  if (!uid) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(uid) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  if (user.status !== 'active') {
    clearSessionCookie(res);
    return res.status(403).json({ error: 'Akun Anda diblokir.' });
  }
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

function saveUploadedImage(dataUrl) {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || '')
  );
  if (!match) {
    const err = new Error('Format gambar tidak didukung. Gunakan PNG, JPEG, WEBP, atau GIF.');
    err.status = 400;
    throw err;
  }
  const [, ext, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    const err = new Error('Ukuran gambar maksimal 2 MB.');
    err.status = 400;
    throw err;
  }
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

function removeUploadedImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  const target = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch {
    /* gambar lama gagal dihapus, abaikan */
  }
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function tooManyAttempts(key) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() - record.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return record.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(key) {
  const record = loginAttempts.get(key);
  if (!record || Date.now() - record.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { first: Date.now(), count: 1 });
    return;
  }
  record.count += 1;
}

app.post('/api/auth/login', (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');
  const key = `${req.ip}|${email}`;

  if (tooManyAttempts(key)) {
    return res
      .status(429)
      .json({ error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 10 menit.' });
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailedAttempt(key);
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Akun Anda diblokir. Hubungi admin.' });
  }

  loginAttempts.delete(key);
  setSessionCookie(res, createSessionToken(user.id));
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const nama = text(req.body?.nama);
  const email = text(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');

  if (nama.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email tidak valid.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email sudah terdaftar.' });
  }

  const info = db
    .prepare(
      "INSERT INTO users (nama, email, password_hash, role, wa_number) VALUES (?, ?, ?, 'buyer', '')"
    )
    .run(nama, email, hashPassword(password));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  setSessionCookie(res, createSessionToken(user.id));
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ user: null });
  if (user.status !== 'active') {
    clearSessionCookie(res);
    return res.json({ user: null });
  }
  res.json({ user: publicUser(user) });
});

/* ------------------------------------------------------------------ */
/* Katalog publik                                                      */
/* ------------------------------------------------------------------ */

app.get('/api/catalog', (req, res) => {
  const products = db
    .prepare(`${productSelect} ORDER BY p.unggulan DESC, p.nama COLLATE NOCASE ASC`)
    .all()
    .map(productRow);

  const seen = new Set();
  const categories = [];
  for (const row of db
    .prepare('SELECT nama FROM categories ORDER BY nama COLLATE NOCASE ASC')
    .all()) {
    const key = row.nama.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(row.nama);
    }
  }

  const sellers = db
    .prepare("SELECT id, nama, wa_number FROM users WHERE role = 'seller' AND status = 'active'")
    .all()
    .map((row) => ({ id: row.id, nama: row.nama, waNumber: row.wa_number }));

  res.json({ products, categories, sellers });
});

/* ------------------------------------------------------------------ */
/* Seller: produk, kategori, pengaturan                                */
/* ------------------------------------------------------------------ */

function sellerCategory(req, res, categoryId) {
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ? AND seller_id = ?')
    .get(categoryId, req.user.id);
  if (!category) {
    res.status(400).json({ error: 'Kategori tidak ditemukan atau bukan milik Anda.' });
    return null;
  }
  return category;
}

function parseProductBody(req, res) {
  const nama = text(req.body?.nama);
  const deskripsi = text(req.body?.deskripsi);
  const hargaRaw = req.body?.harga;
  const stokRaw = req.body?.stok;
  const harga = Number(hargaRaw);
  const stok = Number(stokRaw);
  const unggulan = req.body?.unggulan ? 1 : 0;

  if (!nama) return res.status(400).json({ error: 'Nama produk wajib diisi.' });
  if (!deskripsi) return res.status(400).json({ error: 'Deskripsi produk wajib diisi.' });
  if (!Number.isFinite(harga) || harga < 0 || !Number.isInteger(harga)) {
    return res.status(400).json({ error: 'Harga harus bilangan bulat minimal 0.' });
  }
  if (!Number.isInteger(stok) || stok < 0) {
    return res.status(400).json({ error: 'Stok harus bilangan bulat minimal 0.' });
  }
  if (!req.body?.kategoriId) {
    return res.status(400).json({ error: 'Kategori wajib dipilih.' });
  }
  return { nama, deskripsi, harga, stok, unggulan, kategoriId: Number(req.body.kategoriId) };
}

app.get('/api/seller/overview', requireAuth, requireRole('seller'), (req, res) => {
  const products = db
    .prepare(`${productSelect} WHERE p.seller_id = ? ORDER BY p.created_at DESC, p.id DESC`)
    .all(req.user.id)
    .map(productRow);
  const categories = db
    .prepare('SELECT id, nama FROM categories WHERE seller_id = ? ORDER BY nama COLLATE NOCASE ASC')
    .all(req.user.id)
    .map((row) => ({ id: row.id, nama: row.nama }));
  const categoryUsage = db
    .prepare('SELECT category_id, COUNT(*) AS total FROM products WHERE seller_id = ? GROUP BY category_id')
    .all(req.user.id)
    .reduce((acc, row) => ({ ...acc, [row.category_id]: row.total }), {});

  res.json({
    products,
    categories: categories.map((c) => ({ ...c, productCount: categoryUsage[c.id] || 0 })),
    stats: {
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stok, 0),
      totalCategories: categories.length,
    },
    waNumber: req.user.wa_number,
  });
});

app.post('/api/seller/products', requireAuth, requireRole('seller'), (req, res) => {
  const data = parseProductBody(req, res);
  if (!data) return;
  if (!sellerCategory(req, res, data.kategoriId)) return;

  let imageUrl = '';
  try {
    if (req.body?.imageDataUrl) imageUrl = saveUploadedImage(req.body.imageDataUrl);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const info = db
    .prepare(
      `INSERT INTO products (seller_id, category_id, nama, harga, stok, deskripsi, image_url, unggulan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      data.kategoriId,
      data.nama,
      data.harga,
      data.stok,
      data.deskripsi,
      imageUrl,
      data.unggulan
    );
  const product = db
    .prepare(`${productSelect} WHERE p.id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json({ product: productRow(product) });
});

app.put('/api/seller/products/:id', requireAuth, requireRole('seller'), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

  const data = parseProductBody(req, res);
  if (!data) return;
  if (!sellerCategory(req, res, data.kategoriId)) return;

  let imageUrl = existing.image_url;
  try {
    if (req.body?.imageDataUrl) {
      const nextImage = saveUploadedImage(req.body.imageDataUrl);
      removeUploadedImage(existing.image_url);
      imageUrl = nextImage;
    } else if (req.body?.removeImage && existing.image_url) {
      removeUploadedImage(existing.image_url);
      imageUrl = '';
    }
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  db.prepare(
    `UPDATE products
     SET category_id = ?, nama = ?, harga = ?, stok = ?, deskripsi = ?, image_url = ?,
         unggulan = ?, updated_at = datetime('now')
     WHERE id = ? AND seller_id = ?`
  ).run(
    data.kategoriId,
    data.nama,
    data.harga,
    data.stok,
    data.deskripsi,
    imageUrl,
    data.unggulan,
    existing.id,
    req.user.id
  );

  const product = db.prepare(`${productSelect} WHERE p.id = ?`).get(existing.id);
  res.json({ product: productRow(product) });
});

app.delete('/api/seller/products/:id', requireAuth, requireRole('seller'), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  removeUploadedImage(existing.image_url);
  res.json({ ok: true });
});

app.post('/api/seller/categories', requireAuth, requireRole('seller'), (req, res) => {
  const nama = text(req.body?.nama);
  if (nama.length < 2) return res.status(400).json({ error: 'Nama kategori minimal 2 karakter.' });
  if (nama.length > 40) return res.status(400).json({ error: 'Nama kategori maksimal 40 karakter.' });

  const key = nama.toLowerCase();
  const duplicate = db
    .prepare('SELECT id FROM categories WHERE seller_id = ? AND nama_key = ?')
    .get(req.user.id, key);
  if (duplicate) return res.status(409).json({ error: 'Kategori sudah ada.' });

  const info = db
    .prepare('INSERT INTO categories (seller_id, nama, nama_key) VALUES (?, ?, ?)')
    .run(req.user.id, nama, key);
  res.status(201).json({ category: { id: Number(info.lastInsertRowid), nama, productCount: 0 } });
});

app.delete('/api/seller/categories/:id', requireAuth, requireRole('seller'), (req, res) => {
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ? AND seller_id = ?')
    .get(req.params.id, req.user.id);
  if (!category) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });

  const used = db
    .prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?')
    .get(category.id).n;
  if (used > 0) {
    return res
      .status(409)
      .json({ error: 'Kategori masih dipakai produk. Ubah atau hapus produk terkait dulu.' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
  res.json({ ok: true });
});

app.put('/api/seller/settings', requireAuth, requireRole('seller'), (req, res) => {
  const waNumber = normalizeWa(req.body?.waNumber);
  if (!waNumber) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
  if (waNumber.length < 8 || waNumber.length > 15) {
    return res
      .status(400)
      .json({ error: 'Nomor WhatsApp harus 8-15 digit, contoh 6281234567890.' });
  }
  if (!waNumber.startsWith('62')) {
    return res
      .status(400)
      .json({ error: 'Gunakan format internasional tanpa tanda plus, contoh 6281234567890.' });
  }
  db.prepare('UPDATE users SET wa_number = ? WHERE id = ?').run(waNumber, req.user.id);
  res.json({ waNumber });
});

/* ------------------------------------------------------------------ */
/* Admin: manajemen user                                               */
/* ------------------------------------------------------------------ */

const ROLES = ['admin', 'seller', 'buyer'];

app.get('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS product_count
       FROM users u ORDER BY u.created_at ASC, u.id ASC`
    )
    .all()
    .map((row) => ({ ...publicUser(row), productCount: row.product_count }));
  res.json({ users });
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  const nama = text(req.body?.nama);
  const email = text(req.body?.email).toLowerCase();
  const password = String(req.body?.password ?? '');
  const role = text(req.body?.role);
  const waNumber = normalizeWa(req.body?.waNumber);

  if (nama.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email tidak valid.' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Peran tidak valid.' });
  if (role === 'seller' && waNumber && !waNumber.startsWith('62')) {
    return res
      .status(400)
      .json({ error: 'Nomor WhatsApp seller harus diawali 62, contoh 6281234567890.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email sudah terdaftar.' });
  }

  const info = db
    .prepare(
      'INSERT INTO users (nama, email, password_hash, role, status, wa_number) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      nama,
      email,
      hashPassword(password),
      role,
      'active',
      role === 'seller' ? waNumber : ''
    );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: { ...publicUser(user), productCount: 0 } });
});

app.put('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  const isSelf = target.id === req.user.id;
  const nama = text(req.body?.nama ?? target.nama);
  const role = text(req.body?.role ?? target.role);
  const status = text(req.body?.status ?? target.status);
  const password = req.body?.password ? String(req.body.password) : '';
  const waNumber =
    req.body?.waNumber !== undefined ? normalizeWa(req.body.waNumber) : target.wa_number;

  if (nama.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Peran tidak valid.' });
  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }
  if (isSelf && (role !== 'admin' || status !== 'active')) {
    return res
      .status(400)
      .json({ error: 'Anda tidak dapat menurunkan peran atau memblokir akun sendiri.' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }
  if (role === 'seller' && waNumber && !waNumber.startsWith('62')) {
    return res
      .status(400)
      .json({ error: 'Nomor WhatsApp seller harus diawali 62, contoh 6281234567890.' });
  }

  if (target.role === 'admin' && (role !== 'admin' || status !== 'active')) {
    const admins = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'")
      .get().n;
    if (admins <= 1) {
      return res.status(400).json({ error: 'Minimal harus ada satu admin aktif.' });
    }
  }

  db.prepare(
    `UPDATE users SET nama = ?, role = ?, status = ?, wa_number = ?
       ${password ? ', password_hash = ?' : ''}
     WHERE id = ?`
  ).run(
    ...(password
      ? [nama, role, status, role === 'seller' ? waNumber : '', hashPassword(password), target.id]
      : [nama, role, status, role === 'seller' ? waNumber : '', target.id])
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(target.id);
  const productCount = db
    .prepare('SELECT COUNT(*) AS n FROM products WHERE seller_id = ?')
    .get(target.id).n;
  res.json({ user: { ...publicUser(updated), productCount } });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Anda tidak dapat menghapus akun sendiri.' });
  }
  if (target.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'Minimal harus ada satu admin.' });
  }

  const images = db
    .prepare('SELECT image_url FROM products WHERE seller_id = ?')
    .all(target.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  images.forEach((row) => removeUploadedImage(row.image_url));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */

app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '7d' }));

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Data terlalu besar. Gunakan gambar maksimal 2 MB.' });
  }
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`PakaianMu server berjalan di http://localhost:${PORT}`);
});

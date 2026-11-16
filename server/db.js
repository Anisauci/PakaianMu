import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller', 'buyer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  wa_number TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  nama_key TEXT NOT NULL,
  UNIQUE (seller_id, nama_key)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  nama TEXT NOT NULL,
  harga INTEGER NOT NULL CHECK (harga >= 0),
  stok INTEGER NOT NULL CHECK (stok >= 0),
  deskripsi TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  unggulan INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const seedUsers = [
  {
    nama: 'Admin PakaianMu',
    email: 'admin@pakaianmu.id',
    password: 'admin123',
    role: 'admin',
  },
  {
    nama: 'Toko Rapi Jaya',
    email: 'seller@pakaianmu.id',
    password: 'seller123',
    role: 'seller',
    waNumber: '6281234567890',
    categories: ['Kemeja', 'Jaket', 'Kaos', 'Celana', 'Hoodie', 'Blouse', 'Sweater', 'Rok'],
    products: [
      ['Kemeja Flanel Kotak', 'Kemeja', 75000, 4, 'Kemeja flanel motif kotak, kondisi bersih dan nyaman dipakai.', 1],
      ['Jaket Denim Klasik', 'Jaket', 120000, 2, 'Jaket denim biru klasik, cocok untuk gaya kasual harian.', 1],
      ['Kaos Polos Oversize', 'Kaos', 45000, 8, 'Kaos polos potongan oversize, bahan adem dan jatuh.', 0],
      ['Celana Chino Cream', 'Celana', 85000, 3, 'Celana chino warna cream, tampilan rapi untuk santai maupun semi-formal.', 0],
      ['Hoodie Zip Abu', 'Hoodie', 95000, 5, 'Hoodie resleting warna abu, hangat dan praktis.', 1],
      ['Blouse Vintage Bunga', 'Blouse', 60000, 6, 'Blouse motif bunga gaya vintage, bahan ringan.', 0],
      ['Sweater Rajut Cokelat', 'Sweater', 90000, 1, 'Sweater rajut warna cokelat, cocok untuk cuaca sejuk.', 0],
      ['Rok Midi Plisket', 'Rok', 70000, 4, 'Rok midi plisket warna lembut, mudah dipadukan.', 0],
    ],
  },
  {
    nama: 'Toko Gaya Lama',
    email: 'seller2@pakaianmu.id',
    password: 'seller123',
    role: 'seller',
    waNumber: '6289876543210',
    categories: ['Jaket', 'Kaos'],
    products: [
      ['Jaket Bomber Retro', 'Jaket', 135000, 2, 'Jaket bomber bergaya retro dengan warna pudar yang khas.', 1],
      ['Kaos Band Vintage', 'Kaos', 55000, 3, 'Kaos bergaya vintage dengan sablon lama yang sudah lembut.', 0],
    ],
  },
  {
    nama: 'Pembeli Contoh',
    email: 'pembeli@pakaianmu.id',
    password: 'pembeli123',
    role: 'buyer',
  },
];

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (nama, email, password_hash, role, wa_number) VALUES (?, ?, ?, ?, ?)'
  );
  const insertCategory = db.prepare(
    'INSERT INTO categories (seller_id, nama, nama_key) VALUES (?, ?, ?)'
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (seller_id, category_id, nama, harga, stok, deskripsi, unggulan)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const seed = db.transaction(() => {
    for (const user of seedUsers) {
      const info = insertUser.run(
        user.nama,
        user.email,
        hashPassword(user.password),
        user.role,
        user.waNumber || ''
      );
      const sellerId = Number(info.lastInsertRowid);
      const categoryIds = new Map();

      for (const nama of user.categories || []) {
        const cat = insertCategory.run(sellerId, nama, nama.toLowerCase());
        categoryIds.set(nama, Number(cat.lastInsertRowid));
      }
      for (const [nama, kategori, harga, stok, deskripsi, unggulan] of user.products || []) {
        insertProduct.run(
          sellerId,
          categoryIds.get(kategori),
          nama,
          harga,
          stok,
          deskripsi,
          unggulan
        );
      }
    }
  });

  seed();
  console.log('Database seeded with dummy users, categories and products.');
}

seedIfEmpty();

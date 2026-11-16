import { api } from './api.js';
import {
  ROLE_LABEL,
  esc,
  rupiah,
  placeholderImage,
  productImage,
  waLink,
  normalizeWa,
  formatDate,
} from './helpers.js';
import './styles.css';

const app = document.getElementById('app');
const toastWrap = document.getElementById('toastWrap');
const THEME_KEY = 'pakaianmu_theme_v1';

const state = {
  ready: false,
  user: null,
  guest: false,
  view: 'catalog',
  authMode: 'login',
  catalog: null,
  catalogLoading: false,
  filters: { q: '', category: '', sort: 'unggulan' },
  sellerData: null,
  sellerLoading: false,
  adminData: null,
  adminLoading: false,
  editingId: null,
  imageDataUrl: '',
  removeImage: false,
};

/* ------------------------------------------------------------------ */
/* Tema & notifikasi                                                   */
/* ------------------------------------------------------------------ */

function initTheme() {
  let theme = 'light';
  try {
    theme =
      localStorage.getItem(THEME_KEY) ||
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch {
    /* localStorage tidak tersedia */
  }
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

function toggleTheme() {
  const next =
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* abaikan */
  }
}

let toastTimer;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toastWrap.innerHTML = `<div class="toast ${type === 'error' ? 'toast-error' : ''}">${esc(
    message
  )}</div>`;
  toastTimer = setTimeout(() => {
    toastWrap.innerHTML = '';
  }, 4500);
}

/* ------------------------------------------------------------------ */
/* Render utama                                                        */
/* ------------------------------------------------------------------ */

function render() {
  if (!state.ready) {
    app.innerHTML = `<div class="boot-screen"><div class="logo">👗</div><p>Memuat PakaianMu…</p></div>`;
    return;
  }
  if (!state.user && !state.guest) {
    renderAuth();
    return;
  }
  renderShell();
}

function renderAuth() {
  app.innerHTML = `
  <div class="auth-page">
    <button class="theme-btn auth-theme" data-action="theme" type="button" aria-label="Ganti tema">
      <span data-theme-icon>🌙</span>
    </button>
    <div class="auth-grid">
      <aside class="auth-hero">
        <div class="brand brand-hero">
          <div class="logo">👗</div>
          <div>
            <span class="eyebrow">Katalog UMKM Baju Trift</span>
            <h1>PakaianMu</h1>
          </div>
        </div>
        <h2>Gaya unik, harga bersahabat.</h2>
        <p>Etalase digital untuk toko baju trift. Pembeli melihat katalog dan memesan lewat
          WhatsApp, penjual mengelola produk dan kategori, admin mengatur pengguna.</p>
        <ul class="auth-perks">
          <li>🛍️ Katalog dengan pencarian, filter, dan urutan</li>
          <li>🏷️ Kelola produk & kategori per toko</li>
          <li>👥 Manajemen pengguna dan peran</li>
        </ul>
        <div class="demo-box demo-hero">
          <strong>Akun demo</strong>
          <div class="demo-list">
            <button type="button" class="demo-account" data-demo="admin@pakaianmu.id|admin123">
              <span>Admin</span><code>admin@pakaianmu.id</code><em>admin123</em>
            </button>
            <button type="button" class="demo-account" data-demo="seller@pakaianmu.id|seller123">
              <span>Penjual</span><code>seller@pakaianmu.id</code><em>seller123</em>
            </button>
            <button type="button" class="demo-account" data-demo="pembeli@pakaianmu.id|pembeli123">
              <span>Pembeli</span><code>pembeli@pakaianmu.id</code><em>pembeli123</em>
            </button>
          </div>
        </div>
      </aside>

      <div class="auth-card">
        <div class="auth-tabs" role="tablist" aria-label="Pilih formulir masuk atau daftar">
          <button type="button" class="auth-tab ${state.authMode === 'login' ? 'active' : ''}"
            data-auth="login">Masuk</button>
          <button type="button" class="auth-tab ${state.authMode === 'register' ? 'active' : ''}"
            data-auth="register">Daftar</button>
        </div>

        ${
          state.authMode === 'login'
            ? `<form id="loginForm" class="form-stack" novalidate>
                <label for="loginEmail">Email</label>
                <input id="loginEmail" name="email" type="email" autocomplete="email"
                  placeholder="nama@email.com" required>
                <label for="loginPassword">Kata sandi</label>
                <input id="loginPassword" name="password" type="password"
                  autocomplete="current-password" placeholder="••••••••" required>
                <button class="btn primary full" type="submit">Masuk</button>
              </form>
              <div class="divider"><span>atau</span></div>
              <button class="btn ghost full" type="button" data-action="guest">Lihat katalog tanpa masuk</button>
              <p class="help">Pembeli dapat mendaftar sendiri lewat tab Daftar. Akun penjual dibuat oleh admin.</p>`
            : `<form id="registerForm" class="form-stack" novalidate>
                <label for="regNama">Nama lengkap</label>
                <input id="regNama" name="nama" type="text" autocomplete="name" placeholder="Nama Anda" required>
                <label for="regEmail">Email</label>
                <input id="regEmail" name="email" type="email" autocomplete="email"
                  placeholder="nama@email.com" required>
                <label for="regPassword">Kata sandi</label>
                <input id="regPassword" name="password" type="password" autocomplete="new-password"
                  placeholder="Minimal 6 karakter" required>
                <button class="btn primary full" type="submit">Daftar sebagai Pembeli</button>
              </form>
              <p class="help">Registrasi publik hanya untuk peran pembeli. Hubungi admin untuk akun penjual.</p>`
        }
      </div>
    </div>
  </div>`;

  app.querySelector('[data-action="theme"]')?.addEventListener('click', toggleTheme);
  app.querySelectorAll('[data-auth]').forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.auth;
      renderAuth();
    });
  });
  app.querySelectorAll('[data-demo]').forEach((button) => {
    button.addEventListener('click', () => {
      const [email, password] = button.dataset.demo.split('|');
      state.authMode = 'login';
      renderAuth();
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      if (emailInput) emailInput.value = email;
      if (passwordInput) passwordInput.value = password;
    });
  });
  app.querySelector('[data-action="guest"]')?.addEventListener('click', () => {
    state.guest = true;
    render();
    ensureCatalog();
  });

  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      state.user = data.user;
      state.guest = false;
      state.view = 'catalog';
      showToast(`Selamat datang, ${data.user.nama}.`);
      render();
      ensureCatalog();
    } catch (error) {
      showToast(error.message, 'error');
      submit.disabled = false;
    }
  });

  const registerForm = document.getElementById('registerForm');
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nama = document.getElementById('regNama').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const submit = registerForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { nama, email, password },
      });
      state.user = data.user;
      state.guest = false;
      state.view = 'catalog';
      showToast('Akun pembeli berhasil dibuat.');
      render();
      ensureCatalog();
    } catch (error) {
      showToast(error.message, 'error');
      submit.disabled = false;
    }
  });
}

function renderShell() {
  const user = state.user;
  const role = user?.role;
  const navItems = [{ view: 'catalog', label: 'Katalog' }];
  if (role === 'seller') navItems.push({ view: 'dashboard', label: 'Dashboard' });
  if (role === 'admin') navItems.push({ view: 'users', label: 'Pengguna' });

  const navHtml = navItems
    .map(
      (item) => `<button class="tab ${state.view === item.view ? 'active' : ''}"
        data-view="${item.view}">${item.label}</button>`
    )
    .join('');

  const userChip = user
    ? `<div class="user-chip">
        <span class="avatar">${esc((user.nama || '?').charAt(0).toUpperCase())}</span>
        <span class="user-meta"><strong>${esc(user.nama)}</strong><small>${ROLE_LABEL[role] || role}</small></span>
        <button class="btn ghost small" type="button" data-action="logout">Keluar</button>
      </div>`
    : `<button class="btn primary small" type="button" data-action="login">Masuk</button>`;

  let viewHtml = '';
  if (state.view === 'catalog') viewHtml = catalogHtml();
  else if (state.view === 'dashboard' && role === 'seller') viewHtml = sellerDashboardHtml();
  else if (state.view === 'users' && role === 'admin') viewHtml = adminPanelHtml();
  else viewHtml = catalogHtml();

  app.innerHTML = `
  <header class="site-header">
    <div class="wrap topbar">
      <div class="brand">
        <div class="logo">👗</div>
        <div>
          <h1>PakaianMu</h1>
          <div class="sub">Katalog &amp; Dashboard Produk UMKM Baju Trift</div>
        </div>
      </div>
      <div class="nav-right">
        <nav class="main-nav" aria-label="Navigasi utama">${navHtml}</nav>
        <button class="theme-btn" type="button" data-action="theme" aria-label="Ganti tema">
          <span data-theme-icon>🌙</span>
        </button>
        ${userChip}
      </div>
    </div>
  </header>
  <main class="wrap app-main">${viewHtml}</main>
  <footer class="site-footer">
    © PakaianMu · Aplikasi katalog UMKM baju trift${user ? ` · ${esc(user.email)}` : ' · Mode tamu'}
  </footer>`;

  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  app.querySelector('[data-action="theme"]')?.addEventListener('click', toggleTheme);
  app.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  app.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* tetap bersihkan sesi lokal */
    }
    state.user = null;
    state.guest = false;
    state.sellerData = null;
    state.adminData = null;
    state.view = 'catalog';
    state.editingId = null;
    state.imageDataUrl = '';
    state.removeImage = false;
    state.authMode = 'login';
    showToast('Anda telah keluar.');
    render();
  });
  app.querySelector('[data-action="login"]')?.addEventListener('click', () => {
    state.guest = false;
    state.authMode = 'login';
    render();
  });

  if (state.view === 'catalog') bindCatalog();
  if (state.view === 'dashboard' && role === 'seller') bindSellerDashboard();
  if (state.view === 'users' && role === 'admin') bindAdminPanel();
}

function switchView(view) {
  state.view = view;
  state.editingId = null;
  state.imageDataUrl = '';
  state.removeImage = false;
  render();
  if (view === 'catalog') ensureCatalog();
  if (view === 'dashboard') ensureSellerData();
  if (view === 'users') ensureAdminData();
}

/* ------------------------------------------------------------------ */
/* Katalog                                                             */
/* ------------------------------------------------------------------ */

function filteredProducts() {
  if (!state.catalog) return [];
  const { q, category, sort } = state.filters;
  const query = q.trim().toLowerCase();
  const list = state.catalog.products.filter((product) => {
    const matchQuery =
      !query ||
      product.nama.toLowerCase().includes(query) ||
      product.deskripsi.toLowerCase().includes(query);
    const matchCategory = !category || product.kategori === category;
    return matchQuery && matchCategory;
  });

  if (sort === 'nama-asc') list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  else if (sort === 'harga-asc') list.sort((a, b) => a.harga - b.harga);
  else if (sort === 'harga-desc') list.sort((a, b) => b.harga - a.harga);
  else if (sort === 'stok-desc') list.sort((a, b) => b.stok - a.stok);
  else
    list.sort(
      (a, b) =>
        Number(b.unggulan) - Number(a.unggulan) || a.nama.localeCompare(b.nama, 'id')
    );
  return list;
}

function catalogGridHtml() {
  if (!state.catalog) {
    return `<div class="empty">Memuat katalog…</div>`;
  }
  const list = filteredProducts();
  if (!list.length) {
    return `<div class="empty">Produk tidak ditemukan.</div>`;
  }
  return list
    .map((product) => {
      const stok = Number(product.stok) || 0;
      const stockClass = stok === 0 ? 'out' : stok <= 2 ? 'low' : '';
      const stockText = stok === 0 ? 'Habis' : stok <= 2 ? `Sisa ${stok}!` : `Stok: ${stok}`;
      const canChat = Boolean(product.waNumber);
      const chatHref = canChat ? waLink(product.waNumber, product) : '#';
      return `<article class="card">
        <div class="thumb">
          <img src="${esc(productImage(product))}" alt="${esc(product.nama)}" loading="lazy">
          ${product.unggulan ? '<span class="ribbon">★ Unggulan</span>' : ''}
          <span class="stock ${stockClass}">${stockText}</span>
        </div>
        <div class="body">
          <div class="card-top">
            <span class="badge">${esc(product.kategori)}</span>
            <span class="seller">🏪 ${esc(product.sellerName || 'Penjual')}</span>
          </div>
          <h3 class="title">${esc(product.nama)}</h3>
          <div class="price">${rupiah(product.harga)}</div>
          <p class="meta desc">${esc(product.deskripsi)}</p>
          <div class="row">
            ${
              canChat
                ? `<a class="btn primary" target="_blank" rel="noopener"
                    href="${esc(chatHref)}" aria-label="Pesan ${esc(product.nama)} lewat WhatsApp">💬 Pesan WhatsApp</a>`
                : `<button class="btn ghost" type="button" disabled>WhatsApp belum diatur</button>`
            }
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function catalogChipsHtml() {
  const categories = state.catalog?.categories || [];
  const chips = [
    `<button type="button" class="chip chip-btn ${!state.filters.category ? 'active' : ''}"
      data-cat="">Semua</button>`,
    ...categories.map(
      (category) => `<button type="button"
        class="chip chip-btn ${state.filters.category === category ? 'active' : ''}"
        data-cat="${esc(category)}">${esc(category)}</button>`
    ),
  ];
  return chips.join('');
}

function catalogHtml() {
  const role = state.user?.role;
  const greeting =
    role === 'buyer'
      ? 'Anda masuk sebagai pembeli. Pilih produk lalu hubungi penjual lewat WhatsApp.'
      : role === 'seller'
        ? 'Lihat etalase seperti yang dilihat pembeli, lalu kelola produk di Dashboard.'
        : role === 'admin'
          ? 'Pantau katalog publik dan kelola akun pengguna dari menu Pengguna.'
          : 'Jelajahi katalog tanpa akun. Untuk memesan, hubungi penjual lewat WhatsApp.';
  const categories = state.catalog?.categories || [];

  return `
  <section id="katalog">
    <div class="hero">
      <span class="tag">♻️ THRIFT PILIHAN</span>
      <h2>Gaya unik, harga bersahabat, bumi pun senang.</h2>
      <p>${esc(greeting)}</p>
      <div class="perks">
        <span>✔ Kondisi dicek</span><span>✔ Harga hemat</span><span>✔ Pesan via WhatsApp</span>
      </div>
    </div>

    <div class="controls">
      <input id="searchInput" type="search" placeholder="🔍  Cari nama atau deskripsi…"
        value="${esc(state.filters.q)}" aria-label="Cari produk">
      <select id="filterKategori" aria-label="Filter kategori">
        <option value="">Semua Kategori</option>
        ${categories
          .map(
            (category) =>
              `<option value="${esc(category)}" ${
                state.filters.category === category ? 'selected' : ''
              }>${esc(category)}</option>`
          )
          .join('')}
      </select>
      <select id="sortBy" aria-label="Urutkan produk">
        <option value="unggulan" ${state.filters.sort === 'unggulan' ? 'selected' : ''}>Unggulan dulu</option>
        <option value="nama-asc" ${state.filters.sort === 'nama-asc' ? 'selected' : ''}>Nama A-Z</option>
        <option value="harga-asc" ${state.filters.sort === 'harga-asc' ? 'selected' : ''}>Harga terendah</option>
        <option value="harga-desc" ${state.filters.sort === 'harga-desc' ? 'selected' : ''}>Harga tertinggi</option>
        <option value="stok-desc" ${state.filters.sort === 'stok-desc' ? 'selected' : ''}>Stok terbanyak</option>
      </select>
    </div>

    <div class="chips chips-filter" id="categoryChips">${catalogChipsHtml()}</div>
    <div class="result-info" id="resultInfo"></div>
    <div id="catalogGrid" class="grid">${catalogGridHtml()}</div>
  </section>`;
}

function bindCatalog() {
  const search = document.getElementById('searchInput');
  const filter = document.getElementById('filterKategori');
  const sort = document.getElementById('sortBy');
  const chips = document.getElementById('categoryChips');
  updateResultInfo();

  search?.addEventListener('input', () => {
    state.filters.q = search.value;
    renderGrid();
  });
  filter?.addEventListener('change', () => {
    state.filters.category = filter.value;
    renderGrid();
  });
  sort?.addEventListener('change', () => {
    state.filters.sort = sort.value;
    renderGrid();
  });
  chips?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cat]');
    if (!button) return;
    state.filters.category = button.dataset.cat;
    filter.value = button.dataset.cat;
    chips.querySelectorAll('[data-cat]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.cat === button.dataset.cat);
    });
    renderGrid();
  });
}

function updateResultInfo() {
  const info = document.getElementById('resultInfo');
  if (!info || !state.catalog) return;
  const total = filteredProducts().length;
  const all = state.catalog.products.length;
  info.textContent =
    total === all ? `${all} produk tersedia` : `Menampilkan ${total} dari ${all} produk`;
}

function renderGrid() {
  const grid = document.getElementById('catalogGrid');
  if (grid) grid.innerHTML = catalogGridHtml();
  updateResultInfo();
}

async function ensureCatalog(force = false) {
  if (state.catalogLoading) return;
  if (state.catalog && !force) return;
  state.catalogLoading = true;
  try {
    const data = await api('/api/catalog');
    state.catalog = data;
    if (state.view === 'catalog') render();
  } catch (error) {
    handleApiError(error);
  } finally {
    state.catalogLoading = false;
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard penjual                                                   */
/* ------------------------------------------------------------------ */

function sellerDashboardHtml() {
  if (!state.sellerData) {
    return `<div class="empty">Memuat data toko…</div>`;
  }
  const { products, categories, stats, waNumber } = state.sellerData;
  const editing = state.editingId
    ? products.find((product) => product.id === state.editingId)
    : null;
  const editingImage = editing?.imageUrl || '';
  const previewSrc = state.imageDataUrl || editingImage || '';

  return `
  <section id="dashboard">
    <div class="page-head">
      <div>
        <span class="eyebrow">Dashboard Penjual</span>
        <h2>${esc(state.user.nama)}</h2>
        <p>Kelola produk, kategori, dan nomor WhatsApp toko Anda.</p>
      </div>
      <button class="btn primary" type="button" data-action="new-product">+ Produk Baru</button>
    </div>

    <div class="stats">
      <div class="stat"><div class="icon">👕</div><div class="label">Total Produk</div>
        <div class="value">${stats.totalProducts}</div></div>
      <div class="stat"><div class="icon">📦</div><div class="label">Total Stok</div>
        <div class="value">${stats.totalStock}</div></div>
      <div class="stat"><div class="icon">🏷️</div><div class="label">Total Kategori</div>
        <div class="value">${stats.totalCategories}</div></div>
    </div>

    <div class="panel">
      <h3>⚙️ Pengaturan Toko</h3>
      <form id="waForm" class="inline-form">
        <div>
          <label for="waNumber">Nomor WhatsApp (format internasional, tanpa +)</label>
          <input id="waNumber" name="waNumber" inputmode="numeric" value="${esc(waNumber || '')}"
            placeholder="Contoh: 6281234567890">
          <div class="help">Nomor ini dipakai tombol “Pesan WhatsApp” untuk semua produk Anda.</div>
        </div>
        <div class="inline-action"><button class="btn primary" type="submit">Simpan Nomor</button></div>
      </form>
    </div>

    <div class="panel">
      <h3>🏷️ Kelola Kategori</h3>
      <form id="categoryForm" class="inline-form">
        <div>
          <label for="newCategory">Tambah kategori</label>
          <input id="newCategory" name="nama" placeholder="Contoh: Aksesoris" maxlength="40">
        </div>
        <div class="inline-action"><button class="btn primary" type="submit">Tambah</button></div>
      </form>
      <div class="chips" id="categoryChips">
        ${
          categories.length
            ? categories
                .map(
                  (category) => `<span class="chip">${esc(category.nama)}
                  <small>${category.productCount}</small>
                  <button type="button" data-delete-category="${category.id}"
                    title="Hapus kategori ${esc(category.nama)}"
                    aria-label="Hapus kategori ${esc(category.nama)}">&times;</button></span>`
                )
                .join('')
            : '<span class="meta">Belum ada kategori. Tambahkan kategori dulu sebelum membuat produk.</span>'
        }
      </div>
    </div>

    <div class="panel" id="productFormPanel">
      <h3>${editing ? '✏️ Edit Produk' : '➕ Tambah Produk'}</h3>
      <form id="productForm" novalidate>
        <div class="form-grid">
          <div>
            <label for="pNama">Nama produk</label>
            <input id="pNama" name="nama" value="${esc(editing?.nama || '')}" required>
          </div>
          <div>
            <label for="pKategori">Kategori</label>
            <select id="pKategori" name="kategoriId" required>
              <option value="" disabled ${editing ? '' : 'selected'}>Pilih kategori</option>
              ${categories
                .map(
                  (category) =>
                    `<option value="${category.id}" ${
                      editing?.kategoriId === category.id ? 'selected' : ''
                    }>${esc(category.nama)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label for="pHarga">Harga (Rp)</label>
            <input id="pHarga" name="harga" type="number" min="0" step="1"
              value="${editing ? editing.harga : ''}" required>
          </div>
          <div>
            <label for="pStok">Stok</label>
            <input id="pStok" name="stok" type="number" min="0" step="1"
              value="${editing ? editing.stok : ''}" required>
          </div>
          <div class="full">
            <label for="pDeskripsi">Deskripsi</label>
            <textarea id="pDeskripsi" name="deskripsi" required>${esc(editing?.deskripsi || '')}</textarea>
          </div>
          <div class="full">
            <label for="pGambar">Gambar produk (opsional, maks. 2 MB)</label>
            <input id="pGambar" name="gambar" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <div class="help">Tanpa gambar, sistem memakai placeholder lokal otomatis.</div>
            <div class="preview" id="imagePreviewWrap" style="display:${previewSrc ? 'block' : 'none'}">
              <img id="imagePreview" src="${esc(previewSrc)}" alt="Pratinjau gambar produk">
            </div>
            ${
              editingImage
                ? `<label class="check"><input id="removeImage" type="checkbox" ${
                    state.removeImage ? 'checked' : ''
                  }> Hapus gambar saat ini</label>`
                : ''
            }
          </div>
          <div class="full">
            <label class="check"><input id="pUnggulan" type="checkbox" ${
              editing?.unggulan ? 'checked' : ''
            }> Tandai sebagai produk unggulan</label>
          </div>
        </div>
        <div class="row form-actions">
          <button class="btn primary" type="submit">${editing ? 'Perbarui Produk' : 'Simpan Produk'}</button>
          ${
            editing
              ? '<button class="btn ghost" type="button" data-action="cancel-edit">Batal Edit</button>'
              : ''
          }
        </div>
      </form>
    </div>

    <div class="panel">
      <h3>📋 Daftar Produk</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Nama</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Unggulan</th><th>Aksi</th>
          </tr></thead>
          <tbody id="sellerProductTable">
            ${
              products.length
                ? products
                    .map(
                      (product) => `<tr>
                        <td><strong>${esc(product.nama)}</strong></td>
                        <td>${esc(product.kategori)}</td>
                        <td>${rupiah(product.harga)}</td>
                        <td>${product.stok}</td>
                        <td>${product.unggulan ? '★ Ya' : 'Tidak'}</td>
                        <td class="actions">
                          <button class="btn ghost small" type="button" data-edit-product="${product.id}">Edit</button>
                          <button class="btn danger small" type="button" data-delete-product="${product.id}">Hapus</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="6" class="meta">Belum ada produk.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function bindSellerDashboard() {
  const waForm = document.getElementById('waForm');
  waForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const waNumber = normalizeWa(document.getElementById('waNumber').value);
    const submit = waForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api('/api/seller/settings', { method: 'PUT', body: { waNumber } });
      state.sellerData.waNumber = data.waNumber;
      state.catalog = null;
      document.getElementById('waNumber').value = data.waNumber;
      showToast('Nomor WhatsApp disimpan.');
      ensureCatalog(true);
    } catch (error) {
      handleApiError(error);
    } finally {
      submit.disabled = false;
    }
  });

  const categoryForm = document.getElementById('categoryForm');
  categoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('newCategory');
    const nama = input.value.trim();
    if (!nama) return showToast('Nama kategori wajib diisi.', 'error');
    const submit = categoryForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/seller/categories', { method: 'POST', body: { nama } });
      showToast('Kategori ditambahkan.');
      state.catalog = null;
      await loadSellerData(true);
    } catch (error) {
      handleApiError(error);
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById('categoryChips')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-category]');
    if (!button) return;
    const id = Number(button.dataset.deleteCategory);
    try {
      await api(`/api/seller/categories/${id}`, { method: 'DELETE' });
      showToast('Kategori dihapus.');
      state.catalog = null;
      await loadSellerData(true);
    } catch (error) {
      handleApiError(error);
    }
  });

  const productForm = document.getElementById('productForm');
  productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const get = (id) => document.getElementById(id);
    const nama = get('pNama').value.trim();
    const kategoriId = Number(get('pKategori').value);
    const hargaRaw = get('pHarga').value.trim();
    const stokRaw = get('pStok').value.trim();
    const deskripsi = get('pDeskripsi').value.trim();
    const harga = Number(hargaRaw);
    const stok = Number(stokRaw);

    if (!nama) return showToast('Nama produk wajib diisi.', 'error');
    if (!kategoriId) return showToast('Pilih kategori produk.', 'error');
    if (!hargaRaw || !Number.isInteger(harga) || harga < 0) {
      return showToast('Harga harus bilangan bulat minimal 0.', 'error');
    }
    if (!stokRaw || !Number.isInteger(stok) || stok < 0) {
      return showToast('Stok harus bilangan bulat minimal 0.', 'error');
    }
    if (!deskripsi) return showToast('Deskripsi produk wajib diisi.', 'error');

    const payload = {
      nama,
      kategoriId,
      harga,
      stok,
      deskripsi,
      unggulan: get('pUnggulan').checked,
    };
    if (state.imageDataUrl) payload.imageDataUrl = state.imageDataUrl;
    if (state.removeImage) payload.removeImage = true;

    const submit = productForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      if (state.editingId) {
        await api(`/api/seller/products/${state.editingId}`, { method: 'PUT', body: payload });
        showToast('Produk diperbarui.');
      } else {
        await api('/api/seller/products', { method: 'POST', body: payload });
        showToast('Produk ditambahkan.');
      }
      state.editingId = null;
      state.imageDataUrl = '';
      state.removeImage = false;
      state.catalog = null;
      await loadSellerData(true);
    } catch (error) {
      handleApiError(error);
      submit.disabled = false;
    }
  });

  document.getElementById('pGambar')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      state.imageDataUrl = '';
      updateImagePreview(state.editingId ? currentEditingImage() : '');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 2 MB.', 'error');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.imageDataUrl = String(reader.result);
      updateImagePreview(state.imageDataUrl);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removeImage')?.addEventListener('change', (event) => {
    state.removeImage = event.target.checked;
    updateImagePreview(event.target.checked ? '' : state.imageDataUrl || currentEditingImage());
  });

  const table = document.getElementById('sellerProductTable');
  table?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit-product]');
    const deleteButton = event.target.closest('[data-delete-product]');

    if (editButton) {
      state.editingId = Number(editButton.dataset.editProduct);
      state.imageDataUrl = '';
      state.removeImage = false;
      render();
      document.getElementById('productFormPanel')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (deleteButton) {
      const product = state.sellerData.products.find(
        (item) => item.id === Number(deleteButton.dataset.deleteProduct)
      );
      if (!product) return;
      if (!confirm(`Hapus produk "${product.nama}"?`)) return;
      try {
        await api(`/api/seller/products/${product.id}`, { method: 'DELETE' });
        if (state.editingId === product.id) {
          state.editingId = null;
          state.imageDataUrl = '';
          state.removeImage = false;
        }
        state.catalog = null;
        showToast('Produk dihapus.');
        await loadSellerData(true);
      } catch (error) {
        handleApiError(error);
      }
    }
  });

  app.querySelector('[data-action="new-product"]')?.addEventListener('click', () => {
    state.editingId = null;
    state.imageDataUrl = '';
    state.removeImage = false;
    render();
    document.getElementById('productFormPanel')?.scrollIntoView({ behavior: 'smooth' });
  });

  app.querySelector('[data-action="cancel-edit"]')?.addEventListener('click', () => {
    state.editingId = null;
    state.imageDataUrl = '';
    state.removeImage = false;
    render();
  });

  if (state.editingId) {
    document.getElementById('productFormPanel')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function currentEditingImage() {
  return state.sellerData?.products.find((product) => product.id === state.editingId)?.imageUrl || '';
}

function updateImagePreview(src) {
  const wrap = document.getElementById('imagePreviewWrap');
  const img = document.getElementById('imagePreview');
  if (!wrap || !img) return;
  if (src) {
    img.src = src;
    wrap.style.display = 'block';
  } else {
    img.removeAttribute('src');
    wrap.style.display = 'none';
  }
}

async function loadSellerData(force = false) {
  if (state.sellerLoading) return;
  if (state.sellerData && !force) return;
  state.sellerLoading = true;
  if (!state.sellerData) render();
  try {
    state.sellerData = await api('/api/seller/overview');
    if (state.view === 'dashboard') render();
  } catch (error) {
    handleApiError(error);
  } finally {
    state.sellerLoading = false;
  }
}

async function ensureSellerData() {
  if (!state.user || state.user.role !== 'seller') return;
  await loadSellerData();
}

/* ------------------------------------------------------------------ */
/* Panel admin                                                         */
/* ------------------------------------------------------------------ */

function adminPanelHtml() {
  if (!state.adminData) {
    return `<div class="empty">Memuat data pengguna…</div>`;
  }
  const users = state.adminData.users;
  const counts = users.reduce(
    (acc, user) => ({ ...acc, [user.role]: (acc[user.role] || 0) + 1 }),
    {}
  );

  return `
  <section id="users">
    <div class="page-head">
      <div>
        <span class="eyebrow">Panel Admin</span>
        <h2>Kelola Pengguna</h2>
        <p>Buat akun penjual dan pembeli, atur peran, blokir, atau hapus akun.</p>
      </div>
    </div>

    <div class="stats stats-users">
      <div class="stat"><div class="icon">👥</div><div class="label">Total Pengguna</div>
        <div class="value">${users.length}</div></div>
      <div class="stat"><div class="icon">🛡️</div><div class="label">Admin</div>
        <div class="value">${counts.admin || 0}</div></div>
      <div class="stat"><div class="icon">🏪</div><div class="label">Penjual</div>
        <div class="value">${counts.seller || 0}</div></div>
      <div class="stat"><div class="icon">🛍️</div><div class="label">Pembeli</div>
        <div class="value">${counts.buyer || 0}</div></div>
    </div>

    <div class="panel">
      <h3>➕ Tambah Pengguna</h3>
      <form id="adminUserForm" class="form-grid" novalidate>
        <div><label for="uNama">Nama</label><input id="uNama" name="nama" required></div>
        <div><label for="uEmail">Email</label><input id="uEmail" name="email" type="email" required></div>
        <div><label for="uPassword">Kata sandi awal</label>
          <input id="uPassword" name="password" type="password" minlength="6" placeholder="Minimal 6 karakter" required></div>
        <div><label for="uRole">Peran</label>
          <select id="uRole" name="role">
            <option value="buyer">Pembeli</option>
            <option value="seller">Penjual</option>
            <option value="admin">Admin</option>
          </select></div>
        <div class="full"><label for="uWa">Nomor WhatsApp (khusus penjual)</label>
          <input id="uWa" name="waNumber" inputmode="numeric" placeholder="Contoh: 6281234567890">
          <div class="help">Opsional. Penjual dapat mengubah nomor ini dari dashboard.</div></div>
        <div class="full"><button class="btn primary" type="submit">Buat Akun</button></div>
      </form>
    </div>

    <div class="panel">
      <h3>👥 Daftar Pengguna</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Pengguna</th><th>Peran</th><th>Status</th><th>Produk</th><th>Dibuat</th><th>Aksi</th>
          </tr></thead>
          <tbody id="adminUserTable">
            ${users
              .map((user) => {
                const isSelf = user.id === state.user.id;
                return `<tr>
                  <td>
                    <strong>${esc(user.nama)}</strong>
                    <div class="meta">${esc(user.email)}${user.waNumber ? ` · WA ${esc(user.waNumber)}` : ''}</div>
                  </td>
                  <td>
                    <select class="select-compact" data-user-role="${user.id}" ${isSelf ? 'disabled' : ''}
                      aria-label="Peran ${esc(user.nama)}">
                      ${['admin', 'seller', 'buyer']
                        .map(
                          (role) =>
                            `<option value="${role}" ${user.role === role ? 'selected' : ''}>${
                              ROLE_LABEL[role]
                            }</option>`
                        )
                        .join('')}
                    </select>
                  </td>
                  <td>
                    <select class="select-compact" data-user-status="${user.id}" ${isSelf ? 'disabled' : ''}
                      aria-label="Status ${esc(user.nama)}">
                      <option value="active" ${user.status === 'active' ? 'selected' : ''}>Aktif</option>
                      <option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Diblokir</option>
                    </select>
                  </td>
                  <td>${user.role === 'seller' ? user.productCount : '—'}</td>
                  <td class="meta">${formatDate(user.createdAt)}</td>
                  <td class="actions">
                    <button class="btn ghost small" type="button" data-save-user="${user.id}">Simpan</button>
                    <button class="btn ghost small" type="button" data-reset-password="${user.id}">Reset Sandi</button>
                    <button class="btn danger small" type="button" data-delete-user="${user.id}"
                      ${isSelf ? 'disabled title="Tidak dapat menghapus akun sendiri"' : ''}>Hapus</button>
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="help">Menghapus akun penjual juga menghapus seluruh produk dan kategorinya.
        Akun yang sedang Anda pakai tidak dapat dihapus atau diturunkan perannya.</p>
    </div>
  </section>`;
}

function bindAdminPanel() {
  const form = document.getElementById('adminUserForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      nama: document.getElementById('uNama').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      password: document.getElementById('uPassword').value,
      role: document.getElementById('uRole').value,
      waNumber: normalizeWa(document.getElementById('uWa').value),
    };
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/admin/users', { method: 'POST', body: payload });
      showToast('Pengguna dibuat.');
      await loadAdminData(true);
    } catch (error) {
      handleApiError(error);
      submit.disabled = false;
    }
  });

  const table = document.getElementById('adminUserTable');
  table?.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save-user]');
    const resetButton = event.target.closest('[data-reset-password]');
    const deleteButton = event.target.closest('[data-delete-user]');

    if (saveButton) {
      const id = Number(saveButton.dataset.saveUser);
      const role = table.querySelector(`[data-user-role="${id}"]`).value;
      const status = table.querySelector(`[data-user-status="${id}"]`).value;
      try {
        await api(`/api/admin/users/${id}`, { method: 'PUT', body: { role, status } });
        showToast('Data pengguna diperbarui.');
        state.catalog = null;
        await loadAdminData(true);
      } catch (error) {
        handleApiError(error);
      }
      return;
    }

    if (resetButton) {
      const id = Number(resetButton.dataset.resetPassword);
      const password = prompt('Kata sandi baru (minimal 6 karakter):');
      if (password === null) return;
      try {
        await api(`/api/admin/users/${id}`, { method: 'PUT', body: { password } });
        showToast('Kata sandi pengguna direset.');
      } catch (error) {
        handleApiError(error);
      }
      return;
    }

    if (deleteButton) {
      const id = Number(deleteButton.dataset.deleteUser);
      const target = state.adminData.users.find((user) => user.id === id);
      if (!target) return;
      if (!confirm(`Hapus akun "${target.nama}" (${target.email})?`)) return;
      try {
        await api(`/api/admin/users/${id}`, { method: 'DELETE' });
        showToast('Pengguna dihapus.');
        state.catalog = null;
        await loadAdminData(true);
      } catch (error) {
        handleApiError(error);
      }
    }
  });
}

async function loadAdminData(force = false) {
  if (state.adminLoading) return;
  if (state.adminData && !force) return;
  state.adminLoading = true;
  if (!state.adminData) render();
  try {
    state.adminData = await api('/api/admin/users');
    if (state.view === 'users') render();
  } catch (error) {
    handleApiError(error);
  } finally {
    state.adminLoading = false;
  }
}

async function ensureAdminData() {
  if (!state.user || state.user.role !== 'admin') return;
  await loadAdminData();
}

/* ------------------------------------------------------------------ */
/* Error handling & init                                               */
/* ------------------------------------------------------------------ */

function handleApiError(error) {
  if (error?.status === 401) {
    state.user = null;
    state.guest = false;
    state.view = 'catalog';
    state.authMode = 'login';
    render();
    showToast('Sesi berakhir. Silakan masuk lagi.', 'error');
    return;
  }
  showToast(error?.message || 'Terjadi kesalahan.', 'error');
}

async function init() {
  initTheme();
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch {
    /* belum masuk */
  }
  state.ready = true;
  render();
  if (state.user) ensureCatalog();
}

init();

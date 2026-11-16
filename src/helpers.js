export const ROLE_LABEL = { admin: 'Admin', seller: 'Penjual', buyer: 'Pembeli' };

export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

export function rupiah(value) {
  const number = Number(value);
  return `Rp${(Number.isFinite(number) ? number : 0).toLocaleString('id-ID', {
    maximumFractionDigits: 0,
  })}`;
}

const PLACEHOLDER_COLORS = [
  ['#fed7aa', '#7c2d12'],
  ['#fde68a', '#78350f'],
  ['#bbf7d0', '#14532d'],
  ['#fecaca', '#7f1d1d'],
  ['#ddd6fe', '#4c1d95'],
  ['#bfdbfe', '#1e3a8a'],
];

export function placeholderImage(nama) {
  let hash = 0;
  for (const char of String(nama)) hash = (hash * 31 + char.codePointAt(0)) % 997;
  const [background, foreground] = PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
  const label = esc(String(nama).trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <rect width="100%" height="100%" fill="${background}"/>
    <rect x="20" y="20" width="360" height="260" rx="16" fill="rgba(255,255,255,0.45)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial" font-size="28" fill="${foreground}">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function productImage(product) {
  return product.imageUrl || placeholderImage(product.nama);
}

export function waLink(number, product) {
  const message = `Halo, saya tertarik dengan produk "${product.nama}" (${rupiah(
    product.harga
  )}). Apakah masih tersedia?`;
  return `https://wa.me/${String(number || '').replace(/\D/g, '')}?text=${encodeURIComponent(
    message
  )}`;
}

export function normalizeWa(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

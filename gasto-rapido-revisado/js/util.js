// Utilidades generales: dinero (en centavos), fechas locales y escape de HTML.

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const mxnWhole = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

/** Centavos → "$1,234.50" */
export const money = (c) => mxn.format((c || 0) / 100);
/** Centavos → "$1,235" (sin decimales, para tarjetas compactas) */
export const moneyWhole = (c) => mxnWhole.format(Math.round((c || 0) / 100));

/** "1,234.5" → 123450 centavos. Texto inválido → 0. */
export const toCents = (s) => {
  const raw = String(s ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return 0;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isSafeInteger(Math.round(n * 100)) && n > 0 ? Math.round(n * 100) : 0;
};
/** Centavos → "1234.5" para rellenar inputs */
export const fromCents = (c) => {
  const v = (c || 0) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export const pad = (n) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const curMonth = () => todayStr().slice(0, 7);

export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return cap(new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));
};
export const dayLabel = (ds) => {
  const t = todayStr();
  if (ds === t) return 'Hoy';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (ds === todayStr(y)) return 'Ayer';
  const [yy, mm, dd] = ds.split('-').map(Number);
  return cap(new Date(yy, mm - 1, dd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }));
};
export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

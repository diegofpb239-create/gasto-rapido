// Almacenamiento local (IndexedDB) con copia en memoria para que la interfaz sea instantánea.
import { uid } from './util.js';

const DB_NAME = 'gasto-rapido';
const DB_VERSION = 1;
const KEYS = {
  expenses: 'id', incomes: 'id', categories: 'id',
  paymentMethods: 'id', quickExpenses: 'id', recurring: 'id', settings: 'key'
};
const LIST_STORES = ['expenses', 'incomes', 'categories', 'paymentMethods', 'quickExpenses', 'recurring'];

export const state = {
  expenses: [], incomes: [], categories: [],
  paymentMethods: [], quickExpenses: [], recurring: [],
  settings: {}
};

let db = null;

const wrap = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});
const done = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('transacción cancelada'));
});

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const [store, keyPath] of Object.entries(KEYS)) {
        if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, { keyPath });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Base de datos bloqueada por otra pestaña'));
  });
}

// ---------- Datos iniciales ----------
const PALETTE = ['#2dd4bf', '#f97316', '#eab308', '#3b82f6', '#a855f7', '#ec4899',
  '#22c55e', '#ef4444', '#06b6d4', '#84cc16', '#f59e0b', '#8b5cf6'];
export const colorFor = (i) => PALETTE[i % PALETTE.length];

function seedData() {
  const cat = (id, name, type, icon, necessity, order) =>
    ({ id, name, type, icon, defaultNecessity: necessity, order, archived: false, monthlyBudget: null, color: colorFor(order) });
  const categories = [
    cat('super', 'Súper/despensa', 'gasto', '🛒', 'necesario', 0),
    cat('comida_fuera', 'Comida fuera', 'gasto', '🍔', 'prescindible', 1),
    cat('cafe', 'Café/antojos', 'gasto', '☕', 'prescindible', 2),
    cat('gasolina', 'Gasolina', 'gasto', '⛽', 'necesario', 3),
    cat('servicios', 'Servicios', 'gasto', '💡', 'necesario', 4),
    cat('celular', 'Celular/internet', 'gasto', '📱', 'necesario', 5),
    cat('suscripciones', 'Suscripciones', 'gasto', '🔁', 'prescindible', 6),
    cat('gimnasio', 'Gimnasio/deporte', 'gasto', '🏋️', 'necesario', 7),
    cat('ropa', 'Ropa', 'gasto', '👕', 'prescindible', 8),
    cat('entretenimiento', 'Entretenimiento', 'gasto', '🎬', 'prescindible', 9),
    cat('transporte', 'Transporte', 'gasto', '🚌', 'necesario', 10),
    cat('sueldo', 'Sueldo', 'ingreso', '💼', null, 0),
    cat('ventas', 'Ventas/extras', 'ingreso', '💰', null, 1)
  ];
  const paymentMethods = [
    { id: 'efectivo', name: 'Efectivo', order: 0 },
    { id: 'debito', name: 'Débito', order: 1 },
    { id: 'transferencia', name: 'Transferencia/Mercado Pago', order: 2 }
  ];
  const quickExpenses = [
    { id: 'q_cafe', name: 'Café', amount: 5500, categoryId: 'cafe', necessity: 'prescindible', paymentMethodId: null },
    { id: 'q_gasolina', name: 'Gasolina', amount: 80000, categoryId: 'gasolina', necessity: 'necesario', paymentMethodId: null }
  ];
  return { categories, paymentMethods, quickExpenses };
}

// ---------- Carga ----------
export async function load() {
  db = await openDB();
  const tx = db.transaction(Object.keys(KEYS), 'readonly');
  const reads = {};
  for (const s of Object.keys(KEYS)) reads[s] = wrap(tx.objectStore(s).getAll());
  for (const s of LIST_STORES) state[s] = await reads[s];
  state.settings = {};
  for (const row of await reads.settings) state.settings[row.key] = row.value;

  if (state.categories.length === 0 && !state.settings.seeded) {
    const seed = seedData();
    const wtx = db.transaction([...LIST_STORES, 'settings'], 'readwrite');
    for (const s of ['categories', 'paymentMethods', 'quickExpenses']) {
      for (const row of seed[s]) wtx.objectStore(s).put(row);
      state[s] = seed[s];
    }
    const now = new Date().toISOString();
    wtx.objectStore('settings').put({ key: 'seeded', value: true });
    wtx.objectStore('settings').put({ key: 'firstUseAt', value: now });
    wtx.objectStore('settings').put({ key: 'savingsGoalPct', value: 0 });
    state.settings = { seeded: true, firstUseAt: now, savingsGoalPct: 0 };
    await done(wtx);
  }
}

// ---------- Escritura ----------
/** Guarda (crea o reemplaza) un registro. La memoria se actualiza después de confirmar la escritura. */
export async function put(store, obj) {
  if (!obj.id) obj.id = uid();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(obj);
  await done(tx);
  const list = state[store];
  const i = list.findIndex((x) => x.id === obj.id);
  if (i >= 0) list[i] = obj; else list.push(obj);
  return obj;
}

export async function remove(store, id) {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await done(tx);
  state[store] = state[store].filter((x) => x.id !== id);
}

export async function setSetting(key, value) {
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value });
  await done(tx);
  state.settings[key] = value;
}

// ---------- Respaldo ----------
export function exportAll() {
  return {
    app: 'gasto-rapido',
    schema: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      expenses: state.expenses, incomes: state.incomes, categories: state.categories,
      paymentMethods: state.paymentMethods, quickExpenses: state.quickExpenses,
      recurring: state.recurring, settings: state.settings
    }
  };
}

export function validateBackup(obj) {
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string';
  const id = x => text(x) && x.length > 0;
  const amount = x => Number.isSafeInteger(x) && x > 0;
  const necessity = x => ['necesario', 'prescindible'].includes(x);
  const date = x => {
    if (!text(x) || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
    const d = new Date(x + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === x;
  };
  if (!record(obj) || obj.app !== 'gasto-rapido' || !record(obj.data)) return 'No es un respaldo de Gasto Rápido.';
  if (obj.schema !== DB_VERSION) return 'Versión de respaldo incompatible.';
  for (const store of LIST_STORES) {
    const rows = obj.data[store];
    if (!Array.isArray(rows)) return `Falta la sección "${store}".`;
    if (rows.some(x => !record(x) || !id(x.id)) || new Set(rows.map(x => x.id)).size !== rows.length)
      return `Identificadores inválidos o duplicados en "${store}".`;
  }
  const d = obj.data;
  const category = (key, type) => d.categories.some(c => c.id === key && c.type === type);
  // El historial puede conservar IDs de métodos eliminados.
  const payment = key => key == null || id(key);
  if (d.categories.some(c => !text(c.name) || !text(c.icon) || !['gasto', 'ingreso'].includes(c.type) ||
      !Number.isFinite(c.order) || typeof c.archived !== 'boolean' || !/^#[0-9a-f]{6}$/i.test(c.color) ||
      (c.type === 'gasto' && !necessity(c.defaultNecessity)) ||
      (c.monthlyBudget != null && !amount(c.monthlyBudget)))) return 'Categorías inválidas.';
  if (d.paymentMethods.some(p => !text(p.name) || !Number.isFinite(p.order))) return 'Métodos de pago inválidos.';
  for (const [store, type] of [['expenses', 'gasto'], ['incomes', 'ingreso']]) {
    if (d[store].some(x => !amount(x.amount) || !date(x.date) || !category(x.categoryId, type) ||
        (x.note != null && !text(x.note)) || (x.createdAt != null && !text(x.createdAt)) ||
        (type === 'gasto' && (!necessity(x.necessity) || !payment(x.paymentMethodId)))))
      return 'El respaldo tiene movimientos con datos inválidos.';
  }
  if (d.quickExpenses.some(x => !text(x.name) || !amount(x.amount) || !category(x.categoryId, 'gasto') ||
      !necessity(x.necessity) || !payment(x.paymentMethodId))) return 'Gastos rápidos inválidos.';
  if (d.recurring.some(x => !text(x.name) || !amount(x.amount) || !category(x.categoryId, 'gasto') ||
      !necessity(x.necessity) || !payment(x.paymentMethodId) || !Number.isInteger(x.dayOfMonth) ||
      x.dayOfMonth < 1 || x.dayOfMonth > 31 || (x.lastConfirmedMonth != null &&
      (!text(x.lastConfirmedMonth) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(x.lastConfirmedMonth))))) return 'Pagos recurrentes inválidos.';
  if (!record(d.settings)) return 'Ajustes inválidos.';
  const goal = d.settings.savingsGoalPct;
  if (goal != null && (!Number.isFinite(goal) || goal < 0 || goal > 100)) return 'Meta de ahorro inválida.';
  return null;
}

/** Reemplaza TODO el contenido por el del respaldo. */
export async function replaceAll(obj) {
  const err = validateBackup(obj);
  if (err) throw new Error(err);
  const tx = db.transaction(Object.keys(KEYS), 'readwrite');
  for (const s of LIST_STORES) {
    tx.objectStore(s).clear();
    for (const row of obj.data[s]) tx.objectStore(s).put(row);
  }
  tx.objectStore('settings').clear();
  const settings = { ...(obj.data.settings || {}), seeded: true };
  for (const [key, value] of Object.entries(settings)) tx.objectStore('settings').put({ key, value });
  await done(tx);
  for (const s of LIST_STORES) state[s] = obj.data[s];
  state.settings = settings;
}

// ---------- Consultas comunes ----------
export const catById = (id) => state.categories.find((c) => c.id === id);
export const payById = (id) => state.paymentMethods.find((p) => p.id === id);
export const catsOf = (type, includeArchived = false) =>
  state.categories
    .filter((c) => c.type === type && (includeArchived || !c.archived))
    .sort((a, b) => a.order - b.order);

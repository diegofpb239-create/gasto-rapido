// Lógica pura (sin DOM ni base de datos): fácil de probar.
import { daysInMonth } from './util.js';

export const inMonth = (list, key) => list.filter((x) => x.date.startsWith(key));
export const sum = (list) => list.reduce((a, x) => a + x.amount, 0);

/** Map categoryId → total en centavos */
export function byCategory(list) {
  const m = new Map();
  for (const x of list) m.set(x.categoryId, (m.get(x.categoryId) || 0) + x.amount);
  return m;
}

export function necessityTotals(list) {
  let necesario = 0, prescindible = 0;
  for (const x of list) {
    if (x.necessity === 'prescindible') prescindible += x.amount;
    else necesario += x.amount;
  }
  return { necesario, prescindible };
}

/**
 * Avisos de presupuesto al registrar un gasto.
 * Devuelve 80, 100, 'over' (ya estaba excedido y sigue subiendo) o null.
 */
export function budgetAlert(before, after, budget) {
  if (!budget || budget <= 0 || after <= before) return null;
  const b = before / budget, a = after / budget;
  if (b >= 1) return 'over';
  if (a >= 1) return 100;
  if (b < 0.8 && a >= 0.8) return 80;
  return null;
}

/** Color de barra según avance */
export function budgetLevel(spent, budget) {
  const r = budget > 0 ? spent / budget : 0;
  return r >= 1 ? 'danger' : r >= 0.8 ? 'warn' : 'ok';
}

/** Meta de ahorro como % del ingreso del mes */
export function savingsProgress(income, expenses, pct) {
  const target = Math.round(income * (pct / 100));
  const saved = income - expenses;
  const ratio = target > 0 ? Math.max(0, Math.min(1, saved / target)) : 0;
  return { target, saved, ratio, met: target > 0 && saved >= target };
}

/** Recurrentes cuyo día ya llegó este mes y que no se han confirmado */
export function pendingRecurring(recurring, today) {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const dim = daysInMonth(month);
  return recurring.filter(
    (r) => r.lastConfirmedMonth !== month && day >= Math.min(r.dayOfMonth, dim)
  );
}

/** ¿Toca avisar del respaldo? (7 días desde el último o desde el primer gasto) */
export function backupDue(settings, hasData, nowMs = Date.now()) {
  if (!hasData) return false;
  const DAY = 86400000;
  const last = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : null;
  const first = settings.firstUseAt ? Date.parse(settings.firstUseAt) : nowMs;
  const ref = last ?? first;
  return nowMs - ref >= 7 * DAY;
}

/** Comparación categoría por categoría contra el mes anterior */
export function compareMonths(curMap, prevMap) {
  const ids = new Set([...curMap.keys(), ...prevMap.keys()]);
  const rows = [];
  for (const id of ids) {
    const cur = curMap.get(id) || 0;
    const prev = prevMap.get(id) || 0;
    const delta = cur - prev;
    rows.push({ id, cur, prev, delta, pct: prev > 0 ? delta / prev : null });
  }
  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// Plan de presupuesto (viene del Excel "Mi plan de dinero"), lista de deseos y recordatorios.
import { state, put, setSetting, catById, colorFor } from './db.js';
import { uid, todayStr, money, curMonth } from './util.js';
import { inMonth, sum, preSaveCheck, dueWishes, paydayDue, daysBetween } from './logic.js';

// Montos en centavos. Las categorías "fuera del plan" avisan con cualquier gasto.
export const PLAN = [
  { id: 'gasolina', name: 'Gasolina', icon: '⛽', nec: 'necesario', budget: 400000 },
  { id: 'lavado', name: 'Lavado de auto', icon: '🧽', nec: 'prescindible', budget: 30000 },
  { id: 'celular', name: 'Celular/internet', icon: '📱', nec: 'necesario', budget: 100000 },
  { id: 'suscripciones', name: 'Suscripciones', icon: '🔁', nec: 'prescindible', budget: 70000 },
  { id: 'gimnasio', name: 'Gimnasio/deporte', icon: '🏋️', nec: 'necesario', budget: 70000 },
  { id: 'salud', name: 'Salud', icon: '🩺', nec: 'necesario', budget: 25000 },
  { id: 'cuidado', name: 'Cuidado personal', icon: '💈', nec: 'necesario', budget: 45000 },
  { id: 'pareja', name: 'Salidas en pareja', icon: '💑', nec: 'prescindible', budget: 240000 },
  { id: 'fechas', name: 'Regalos y fechas', icon: '🎁', nec: 'prescindible', budget: 72500 }
];
export const OUT_OF_PLAN = ['comida_fuera', 'cafe', 'super', 'ropa', 'entretenimiento'];
export const PLAN_SAVINGS_PCT = 50;
export const PLAN_PAY_TRANSFER = 673750; // la mitad del ahorro mensual de $13,475
export const WAIT_DAYS = 30;

// ---------- Aplicar el plan ----------
export async function applyPlan() {
  const maxOrder = () => Math.max(-1, ...state.categories.filter((c) => c.type === 'gasto').map((c) => c.order));
  for (const p of PLAN) {
    const cur = catById(p.id);
    if (cur) {
      await put('categories', { ...cur, monthlyBudget: p.budget, outOfPlan: false, archived: false });
    } else {
      const order = maxOrder() + 1;
      await put('categories', {
        id: p.id, name: p.name, type: 'gasto', icon: p.icon, defaultNecessity: p.nec, order,
        archived: false, monthlyBudget: p.budget, outOfPlan: false, color: colorFor(order)
      });
    }
  }
  for (const id of OUT_OF_PLAN) {
    const cur = catById(id);
    if (cur) await put('categories', { ...cur, monthlyBudget: null, outOfPlan: true });
  }
  await setSetting('savingsGoalPct', PLAN_SAVINGS_PCT);
  if (!state.settings.payTransfer) await setSetting('payTransfer', PLAN_PAY_TRANSFER);
  if (!state.settings.paydays) await setSetting('paydays', [15, 31]);
  await setSetting('planAppliedAt', new Date().toISOString());
}

// ---------- Totales del mes ----------
export const plannedCats = () =>
  state.categories.filter((c) => c.type === 'gasto' && !c.archived && c.monthlyBudget > 0);
export const totalBudget = () => plannedCats().reduce((a, c) => a + c.monthlyBudget, 0);

/** Categorías pasadas de su presupuesto o con gasto fuera del plan, en un mes. */
export function overview(month = curMonth()) {
  const exp = inMonth(state.expenses, month);
  const by = new Map();
  for (const x of exp) by.set(x.categoryId, (by.get(x.categoryId) || 0) + x.amount);
  const over = plannedCats().filter((c) => (by.get(c.id) || 0) > c.monthlyBudget);
  const outCats = state.categories.filter((c) => c.type === 'gasto' && c.outOfPlan && (by.get(c.id) || 0) > 0);
  const outTotal = outCats.reduce((a, c) => a + by.get(c.id), 0);
  return { spent: sum(exp), budget: totalBudget(), over, outCats, outTotal, by };
}

// ---------- Revisión antes de guardar ----------
export function checkExpense(rec) {
  const cat = catById(rec.categoryId);
  const month = rec.date.slice(0, 7);
  const exp = inMonth(state.expenses, month);
  const before = sum(exp.filter((x) => x.categoryId === rec.categoryId));
  const r = preSaveCheck({ cat, before, amount: rec.amount, totalBudget: totalBudget(), totalSpentBefore: sum(exp) });
  if (!r) return null;
  const name = cat ? cat.name : 'Esta categoría';
  if (r.kind === 'out') {
    return { ...r, title: 'Gasto fuera de tu plan', text: `${name} no está en tu presupuesto (tu plan es $0 aquí). Estos ${money(rec.amount)} salen directo de tu ahorro.` };
  }
  if (r.kind === 'over') {
    return { ...r, title: 'Te pasas del presupuesto', text: `${name}: con esto llegas a ${money(r.after)} de ${money(r.budget)}. Te pasas por ${money(r.excess)}.` };
  }
  return { ...r, title: 'Te pasas del presupuesto del mes', text: `Con esto tus gastos del mes llegan a ${money(r.after)} de ${money(r.budget)} planeados.` };
}

// ---------- Lista de deseos ----------
const wishes = () => (Array.isArray(state.settings.wishlist) ? state.settings.wishlist : []);
export const wishlist = () => [...wishes()].sort((a, b) => (a.decision ? 1 : 0) - (b.decision ? 1 : 0) || a.date.localeCompare(b.date));
export async function addWish({ name, amount, categoryId = null }) {
  const w = { id: uid(), name: name || 'Algo que quería', amount, categoryId, date: todayStr(), decision: null };
  await setSetting('wishlist', [...wishes(), w]);
  return w;
}
export async function decideWish(id, decision) {
  await setSetting('wishlist', wishes().map((w) => (w.id === id ? { ...w, decision, decidedAt: todayStr() } : w)));
}
export async function deleteWish(id) {
  await setSetting('wishlist', wishes().filter((w) => w.id !== id));
}
export const wishesDue = () => dueWishes(wishes(), todayStr(), WAIT_DAYS);
export const daysLeft = (w) => Math.max(0, WAIT_DAYS - daysBetween(w.date, todayStr()));
export const savedByWishes = () => wishes().filter((w) => w.decision === 'skipped').reduce((a, w) => a + w.amount, 0);
export const decideDate = (w) => {
  const [y, m, d] = w.date.split('-').map(Number);
  return new Date(y, m - 1, d + WAIT_DAYS).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

// ---------- Recordatorios dentro de la app ----------
export function paydayReminder() {
  if (state.settings.remindPayday === false) return null;
  const key = paydayDue(todayStr(), state.settings.paydays || [15, 31]);
  if (!key || state.settings.paydayDismissed === key) return null;
  return { key, amount: state.settings.payTransfer || 0 };
}
export function sundayReminder() {
  if (state.settings.remindSunday === false) return null;
  const t = todayStr();
  if (new Date().getDay() !== 0 || state.settings.sundayDismissed === t) return null;
  return { key: t };
}

// Resumen del mes: balance, meta de ahorro, prescindibles, gráfica por categoría,
// comparación contra el mes anterior y presupuestos.
import { state, catById } from './db.js';
import { esc, money, moneyWhole, curMonth, shiftMonth, monthLabel, $, $$ } from './util.js';
import { inMonth, sum, byCategory, necessityTotals, savingsProgress, compareMonths, budgetLevel } from './logic.js';
import { donut } from './charts.js';
import { overview } from './plan.js';

const view = { month: curMonth() };
let root = null;

const pct = (n) => `${Math.round(n * 100)}%`;

export function renderSummary(container, { goToSettings } = {}) {
  root = container;
  const exp = inMonth(state.expenses, view.month);
  const inc = inMonth(state.incomes, view.month);
  const prevExp = inMonth(state.expenses, shiftMonth(view.month, -1));
  const totalExp = sum(exp), totalInc = sum(inc), balance = totalInc - totalExp;
  const atMax = view.month >= curMonth();

  const cur = byCategory(exp);
  const prev = byCategory(prevExp);
  const nec = necessityTotals(exp);
  const goal = Number(state.settings.savingsGoalPct) || 0;

  root.innerHTML = `
    <h1 class="page-title">Resumen</h1>
    <div class="monthbar">
      <button type="button" id="prev" aria-label="Mes anterior">‹</button>
      <span class="m">${esc(monthLabel(view.month))}</span>
      <button type="button" id="next" aria-label="Mes siguiente" ${atMax ? 'disabled' : ''}>›</button>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="l">Ingresos</div><div class="v num">${esc(moneyWhole(totalInc))}</div></div>
      <div class="kpi"><div class="l">Gastos</div><div class="v num">${esc(moneyWhole(totalExp))}</div></div>
      <div class="kpi"><div class="l">Balance</div><div class="v num ${balance < 0 ? 'neg' : 'pos'}">${balance < 0 ? '−' : ''}${esc(moneyWhole(Math.abs(balance)))}</div></div>
    </div>

    ${savingsHtml(totalInc, totalExp, goal)}
    ${prescindiblesHtml(exp, totalExp, nec)}
    ${donutHtml(cur, totalExp)}
    ${compareHtml(cur, prev, totalExp, sum(prevExp))}
    ${budgetsHtml(cur, view.month)}
  `;

  $('#prev', root).onclick = () => { view.month = shiftMonth(view.month, -1); renderSummary(root, { goToSettings }); };
  $('#next', root).onclick = () => { if (!atMax) { view.month = shiftMonth(view.month, 1); renderSummary(root, { goToSettings }); } };
  const g = $('#goSettings', root);
  if (g) g.onclick = () => goToSettings && goToSettings();
}

function savingsHtml(income, expenses, goal) {
  if (!goal) {
    return `<div class="card"><h3>Meta de ahorro</h3>
      <div class="muted">Aún no defines tu meta (% de tus ingresos que quieres ahorrar).</div>
      <button type="button" class="btn block" id="goSettings" style="margin-top:10px">Definir meta en Ajustes</button></div>`;
  }
  if (!income) {
    return `<div class="card"><h3>Meta de ahorro · ${goal}%</h3><div class="muted">Registra tus ingresos del mes para calcular cuánto deberías ahorrar.</div></div>`;
  }
  const s = savingsProgress(income, expenses, goal);
  const status = s.met
    ? `<b style="color:var(--good)">¡Meta cumplida!</b> Llevas ${esc(money(s.saved))} ahorrados.`
    : s.saved < 0
      ? `<b style="color:var(--danger)">Vas en negativo:</b> gastaste ${esc(money(-s.saved))} más de lo que ingresó.`
      : `Llevas <b>${esc(money(s.saved))}</b>; te faltan <b>${esc(money(s.target - s.saved))}</b>.`;
  return `<div class="card"><h3>Meta de ahorro · ${goal}% de tus ingresos</h3>
    <div class="row between" style="margin-bottom:8px"><span class="big">${esc(moneyWhole(Math.max(s.saved, 0)))}</span><span class="muted">de ${esc(moneyWhole(s.target))}</span></div>
    <div class="bar"><i class="${s.met ? '' : s.ratio < 0.5 ? 'warn' : ''}" style="width:${Math.round(s.ratio * 100)}%"></i></div>
    <div style="margin-top:8px;font-size:.92rem">${status}</div></div>`;
}

function prescindiblesHtml(exp, total, nec) {
  if (!total) return '';
  const share = nec.prescindible / total;
  // Las categorías donde más se va en gastos prescindibles
  const m = new Map();
  for (const x of exp) if (x.necessity === 'prescindible') m.set(x.categoryId, (m.get(x.categoryId) || 0) + x.amount);
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<div class="card"><h3>Gastos prescindibles</h3>
    <div class="row between"><span class="big" style="color:var(--warn)">${esc(moneyWhole(nec.prescindible))}</span><span class="muted">${pct(share)} de tus gastos</span></div>
    <div class="split"><i style="width:${share * 100}%;background:var(--warn)"></i><i style="width:${(1 - share) * 100}%;background:var(--good)"></i></div>
    <div class="row between muted" style="font-size:.82rem"><span>✂ Prescindible ${esc(moneyWhole(nec.prescindible))}</span><span>✓ Necesario ${esc(moneyWhole(nec.necesario))}</span></div>
    ${top.length ? `<div class="legend" style="margin-top:10px">${top.map(([id, v]) => {
      const c = catById(id);
      return `<div class="li"><span>${esc(c ? c.icon : '')}</span><span class="grow">${esc(c ? c.name : 'Sin categoría')}</span><span class="val">${esc(money(v))}</span></div>`;
    }).join('')}</div>` : ''}</div>`;
}

function donutHtml(cur, total) {
  if (!total) return `<div class="card"><h3>Gasto por categoría</h3><div class="empty" style="padding:16px">Aún no hay gastos este mes.</div></div>`;
  const data = [...cur.entries()].map(([id, value]) => {
    const c = catById(id);
    return { label: c ? c.name : 'Sin categoría', value, color: c ? c.color : '#888', icon: c ? c.icon : '' };
  }).sort((a, b) => b.value - a.value);
  return `<div class="card"><h3>Gasto por categoría</h3>
    <div class="donut-wrap">${donut(data, { centerTop: moneyWhole(total), centerBottom: 'gastado' })}</div>
    <div class="legend">${data.map((d) => `<div class="li"><span class="dot" style="background:${esc(d.color)}"></span><span class="grow ellipsis">${esc(d.icon)} ${esc(d.label)}</span><span class="pct">${pct(d.value / total)}</span><span class="val">${esc(money(d.value))}</span></div>`).join('')}</div></div>`;
}

function compareHtml(cur, prev, total, prevTotal) {
  if (!total && !prevTotal) return '';
  if (!prevTotal) {
    return `<div class="card"><h3>Contra el mes anterior</h3><div class="muted">No hay gastos del mes anterior para comparar.</div></div>`;
  }
  const rows = compareMonths(cur, prev).filter((r) => r.delta !== 0).slice(0, 8);
  const d = total - prevTotal;
  const dLine = `<div class="row between" style="margin-bottom:10px"><span>Total gastado</span>
    <b class="num" style="color:${d > 0 ? 'var(--danger)' : 'var(--good)'}">${d > 0 ? '▲ +' : d < 0 ? '▼ −' : ''}${esc(money(Math.abs(d)))} ${prevTotal ? `(${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d) / prevTotal * 100)}%)` : ''}</b></div>`;
  return `<div class="card"><h3>Contra el mes anterior</h3>${dLine}
    <div class="cmp">${rows.map((r) => {
      const c = catById(r.id);
      const up = r.delta > 0;
      return `<span class="ellipsis">${esc(c ? c.icon : '')} ${esc(c ? c.name : 'Sin categoría')}</span>
        <span class="d ${up ? 'up' : 'down'}">${up ? '▲ +' : '▼ −'}${esc(money(Math.abs(r.delta)))}</span>
        <span class="p">${r.pct === null ? 'nuevo' : (up ? '+' : '−') + Math.round(Math.abs(r.pct) * 100) + '%'}</span>`;
    }).join('')}</div></div>`;
}

function budgetsHtml(cur, month) {
  const cats = state.categories.filter((c) => c.type === 'gasto' && c.monthlyBudget > 0 && !c.archived);
  if (!cats.length) return '';
  const ov = overview(month);
  const tRatio = ov.budget > 0 ? ov.spent / ov.budget : 0;
  const tLvl = budgetLevel(ov.spent, ov.budget);
  const left = ov.budget - ov.spent;
  const total = `<div class="plan-total"><div class="row between" style="margin-bottom:6px"><b>Total del mes</b>
      <span class="num"><b>${esc(money(ov.spent))}</b> / ${esc(money(ov.budget))}</span></div>
    <div class="bar"><i class="${tLvl === 'ok' ? '' : tLvl}" style="width:${Math.min(100, Math.floor(tRatio * 100))}%"></i></div>
    <div class="muted" style="font-size:.85rem;margin-top:6px">${left >= 0 ? `Te quedan <b style="color:var(--good)">${esc(money(left))}</b> este mes` : `<b style="color:var(--danger)">Te pasaste por ${esc(money(-left))}</b>`}</div>
    ${ov.outCats.length ? `<div class="outplan"><b style="color:var(--danger)">🚫 Fuera del plan: ${esc(money(ov.outTotal))}</b>${ov.outCats.map((c) =>
      `<div class="li"><span>${esc(c.icon)} ${esc(c.name)}</span><span class="num">${esc(money(ov.by.get(c.id)))}</span></div>`).join('')}</div>` : ''}</div>`;
  return `<div class="card"><h3>Tu plan del mes</h3>${total}${cats.map((c) => {
    const spent = cur.get(c.id) || 0;
    const ratio = spent / c.monthlyBudget;
    const lvl = budgetLevel(spent, c.monthlyBudget);
    return `<div class="bud"><div class="top"><span>${esc(c.icon)} ${esc(c.name)}</span>
      <span class="num"><b>${esc(money(spent))}</b> / ${esc(money(c.monthlyBudget))} · ${Math.floor(ratio * 100)}%</span></div>
      <div class="bar"><i class="${lvl === 'ok' ? '' : lvl}" style="width:${Math.min(100, Math.floor(ratio * 100))}%"></i></div></div>`;
  }).join('')}</div>`;
}

// Lista de movimientos del mes, con filtros, edición y borrado con "Deshacer".
import { state, put, remove, catById, payById, catsOf } from './db.js';
import { esc, money, toCents, fromCents, curMonth, shiftMonth, monthLabel, dayLabel, todayStr, $, $$ } from './util.js';
import { toast, openSheet, closeSheet, field, options, ask } from './ui.js';
import { inMonth, sum } from './logic.js';

const view = { month: curMonth(), type: 'todos', cat: '' };
let root = null;

export function renderMovements(container) {
  root = container;
  const all = [
    ...state.expenses.map((x) => ({ ...x, kind: 'gasto' })),
    ...state.incomes.map((x) => ({ ...x, kind: 'ingreso' }))
  ];
  let list = inMonth(all, view.month);
  if (view.type !== 'todos') list = list.filter((x) => x.kind === (view.type === 'gastos' ? 'gasto' : 'ingreso'));
  if (view.cat) list = list.filter((x) => x.categoryId === view.cat);
  list.sort((a, b) => (b.date.localeCompare(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const catOpts = [...catsOf('gasto', true), ...catsOf('ingreso', true)].map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }));
  const days = new Map();
  for (const x of list) (days.get(x.date) || days.set(x.date, []).get(x.date)).push(x);

  const atMax = view.month >= curMonth();
  root.innerHTML = `
    <h1 class="page-title">Movimientos</h1>
    <div class="monthbar">
      <button type="button" id="prev" aria-label="Mes anterior">‹</button>
      <span class="m">${esc(monthLabel(view.month))}</span>
      <button type="button" id="next" aria-label="Mes siguiente" ${atMax ? 'disabled' : ''}>›</button>
    </div>
    <div class="seg" style="margin-bottom:10px">
      ${['todos', 'gastos', 'ingresos'].map((t) => `<button type="button" data-t="${t}" class="${view.type === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
    <div class="filters"><select id="fcat" aria-label="Filtrar por categoría">${options(catOpts, view.cat, { blank: 'Todas las categorías' })}</select></div>
    ${list.length === 0 ? `<div class="empty">Sin movimientos en este periodo.</div>` :
      [...days.entries()].map(([d, items]) => {
        const net = sum(items.filter((i) => i.kind === 'gasto'));
        return `<div class="day"><span>${esc(dayLabel(d))}</span><span class="num">${net ? '−' + esc(money(net)) : ''}</span></div>` +
          items.map(itemHtml).join('');
      }).join('')}
  `;

  $('#prev', root).onclick = () => { view.month = shiftMonth(view.month, -1); renderMovements(root); };
  $('#next', root).onclick = () => { if (!atMax) { view.month = shiftMonth(view.month, 1); renderMovements(root); } };
  $$('[data-t]', root).forEach((b) => (b.onclick = () => { view.type = b.dataset.t; renderMovements(root); }));
  $('#fcat', root).onchange = (e) => { view.cat = e.target.value; renderMovements(root); };
  $$('.item', root).forEach((b) => (b.onclick = () => openEditor(b.dataset.kind, b.dataset.id)));
}

function itemHtml(x) {
  const c = catById(x.categoryId);
  const pay = x.paymentMethodId ? (payById(x.paymentMethodId) || {}).name : '';
  const sub = [pay, x.note].filter(Boolean).join(' · ');
  const inc = x.kind === 'ingreso';
  return `<button type="button" class="item" data-kind="${x.kind}" data-id="${esc(x.id)}">
    <span class="ic">${esc(c ? c.icon : '❔')}</span>
    <span class="grow"><div class="t ellipsis">${esc(c ? c.name : 'Sin categoría')}${!inc && x.necessity === 'prescindible' ? '<span class="badge">prescindible</span>' : ''}</div>
      <div class="s ellipsis">${esc(sub) || '&nbsp;'}</div></span>
    <span class="a num ${inc ? 'in' : ''}">${inc ? '+' : '−'}${esc(money(x.amount))}</span>
  </button>`;
}

// ---------- Edición ----------
export function openEditor(kind, id) {
  const store = kind === 'gasto' ? 'expenses' : 'incomes';
  const rec = state[store].find((x) => x.id === id);
  if (!rec) return;
  const isG = kind === 'gasto';
  const catOpts = catsOf(kind, true).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}${c.archived ? ' (archivada)' : ''}` }));
  const payOpts = state.paymentMethods.map((p) => ({ value: p.id, label: p.name }));
  let necessity = rec.necessity || 'necesario';

  const body = openSheet(`
    ${field('Monto', `<input type="text" inputmode="decimal" id="eAmt" value="${esc(fromCents(rec.amount))}">`)}
    ${field('Categoría', `<select id="eCat">${options(catOpts, rec.categoryId)}</select>`)}
    ${isG ? `<div class="seg nec" id="eNec" style="margin-bottom:12px">
      <button type="button" data-nec="necesario" class="${necessity === 'necesario' ? 'on' : ''}">✓ Necesario</button>
      <button type="button" data-nec="prescindible" class="${necessity === 'prescindible' ? 'on' : ''}">✂ Prescindible</button></div>
    ${field('Método de pago', `<select id="ePay">${options(payOpts, rec.paymentMethodId || '', { blank: 'Sin método' })}</select>`)}` : ''}
    ${field('Nota', `<input type="text" id="eNote" maxlength="120" value="${esc(rec.note || '')}">`)}
    ${field('Fecha', `<input type="date" id="eDate" value="${esc(rec.date)}" max="${todayStr()}">`)}
    <div class="sheet-actions">
      <button type="button" class="btn danger" id="eDel">Eliminar</button>
      <button type="button" class="btn primary" id="eSave">Guardar</button>
    </div>`, { title: isG ? 'Editar gasto' : 'Editar ingreso' });

  $$('#eNec button', body).forEach((b) => (b.onclick = () => {
    necessity = b.dataset.nec;
    $$('#eNec button', body).forEach((x) => x.classList.toggle('on', x === b));
  }));

  $('#eSave', body).onclick = async () => {
    const cents = toCents($('#eAmt', body).value);
    if (!cents) { toast('Escribe un monto válido'); return; }
    const date = $('#eDate', body).value || rec.date;
    const next = { ...rec, amount: cents, categoryId: $('#eCat', body).value, note: $('#eNote', body).value.trim(), date };
    if (isG) { next.necessity = necessity; next.paymentMethodId = $('#ePay', body).value || null; }
    await put(store, next);
    closeSheet();
    toast('Cambios guardados');
    renderMovements(root);
  };

  $('#eDel', body).onclick = async () => {
    const copy = { ...rec };
    await remove(store, rec.id);
    closeSheet();
    renderMovements(root);
    toast('Movimiento eliminado', {
      action: 'Deshacer', duration: 6000,
      onAction: async () => { await put(store, copy); renderMovements(root); toast('Restaurado'); }
    });
  };
}

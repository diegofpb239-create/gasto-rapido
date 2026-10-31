// Pantalla de captura: monto → categoría → Guardar.
import { state, put, remove, catById, catsOf } from './db.js';
import { esc, money, moneyWhole, toCents, todayStr, uid, $, $$ } from './util.js';
import { toast, openSheet, closeSheet, vibrate, choose } from './ui.js';
import { inMonth, sum, byCategory, budgetAlert, pendingRecurring, backupDue } from './logic.js';
import { doBackup, hasData, requestPersistence } from './backup.js';
import { checkExpense, overview, addWish, wishesDue, paydayReminder, sundayReminder, decideDate } from './plan.js';
import { openWishlist } from './wishes.js';
import { setSetting } from './db.js';

const go = (view) => document.dispatchEvent(new CustomEvent('gr:navigate', { detail: view }));

// El formulario vive fuera de render() para no perder lo escrito al cambiar de pestaña.
const form = {
  type: 'gasto',
  amount: '',
  catId: null,
  necessity: 'prescindible',
  necTouched: false,
  payId: null,
  note: '',
  date: null, // null = hoy
  moreOpen: false
};
let root = null;

export function setCaptureType(type) {
  if (type === 'gasto' || type === 'ingreso') {
    if (form.type !== type) { form.type = type; form.catId = null; form.necTouched = false; }
  }
}

// ---------- Monto ----------
const MAX_INT = 9;
function pressKey(k) {
  let a = form.amount;
  if (k === 'back') a = a.slice(0, -1);
  else if (k === '.') { if (!a.includes('.')) a = (a === '' ? '0' : a) + '.'; }
  else {
    const [i, d] = a.split('.');
    if (a.includes('.')) { if (d.length >= 2) return; }
    else if (i.length >= MAX_INT) return;
    a = a === '0' ? k : a + k;
  }
  form.amount = a;
  paintAmount();
}

function fmtAmount(a) {
  if (a === '') return '0';
  const [i, d] = a.split('.');
  const int = Number(i).toLocaleString('es-MX');
  return a.includes('.') ? `${int}.${d ?? ''}` : int;
}

function paintAmount() {
  const el = $('#amt', root);
  if (!el) return;
  el.classList.toggle('zero', form.amount === '' || toCents(form.amount) === 0);
  el.innerHTML = `<span class="cur">$</span>${fmtAmount(form.amount)}`;
  $('#save', root).disabled = !(toCents(form.amount) > 0 && form.catId);
}

// ---------- Pintado ----------
function categoriesHtml() {
  const cats = catsOf(form.type);
  return cats.map((c) =>
    `<button type="button" class="cat ${form.catId === c.id ? 'on' : ''}" data-cat="${esc(c.id)}">` +
    `<span class="ic">${esc(c.icon)}</span><span>${esc(c.name)}</span></button>`
  ).join('') +
    `<button type="button" class="cat add" data-act="newcat"><span class="ic">＋</span><span>Nueva</span></button>`;
}

function quickHtml() {
  if (form.type !== 'gasto' || state.quickExpenses.length === 0) return '';
  return state.quickExpenses.map((q) => {
    const c = catById(q.categoryId);
    return `<button type="button" class="chip" data-quick="${esc(q.id)}">${esc(c ? c.icon : '•')} ${esc(q.name)} <b>${esc(moneyWhole(q.amount))}</b></button>`;
  }).join('');
}

function bannersHtml() {
  const out = [];
  const pay = paydayReminder();
  if (pay) {
    out.push(`<button type="button" class="banner" data-act="payday">💸 <span><b>Quincena:</b> págate primero${pay.amount ? ` — pasa <b>${esc(moneyWhole(pay.amount))}</b> a tus ahorros` : ''}. Hoy y mañana, nada fuera del plan. <span class="muted">(toca para marcar hecho)</span></span></button>`);
  }
  const ov = overview();
  const nOver = ov.over.length + ov.outCats.length;
  if (nOver) {
    const extra = ov.outTotal ? ` · ${esc(moneyWhole(ov.outTotal))} fuera del plan` : '';
    out.push(`<button type="button" class="banner bad" data-act="goSummary">🚨 <span><b>${nOver}</b> categoría${nOver > 1 ? 's' : ''} pasada${nOver > 1 ? 's' : ''} del presupuesto${extra}</span></button>`);
  } else if (ov.budget > 0 && ov.spent > 0) {
    const ratio = ov.spent / ov.budget;
    if (ratio >= 0.8) out.push(`<button type="button" class="banner warn" data-act="goSummary">⚠️ <span>Llevas <b>${Math.round(ratio * 100)}%</b> de tu presupuesto del mes</span></button>`);
  }
  const due = wishesDue();
  if (due.length) {
    out.push(`<button type="button" class="banner" data-act="wishes">🛍️ <span><b>${due.length}</b> deseo${due.length > 1 ? 's' : ''} ya cumplió 30 días: ¿todavía lo quieres?</span></button>`);
  }
  const sun = sundayReminder();
  if (sun) out.push(`<button type="button" class="banner" data-act="sunday">📊 <span><b>Domingo de revisión:</b> mira en qué se fue tu dinero esta semana</span></button>`);
  const pend = pendingRecurring(state.recurring, todayStr());
  if (pend.length) {
    out.push(`<button type="button" class="banner" data-act="recurring">🔔 <span><b>${pend.length}</b> pago${pend.length > 1 ? 's' : ''} recurrente${pend.length > 1 ? 's' : ''} por confirmar</span></button>`);
  }
  if (backupDue(state.settings, hasData())) {
    out.push(`<button type="button" class="banner warn" data-act="backup">💾 <span>Toca hacer tu <b>respaldo semanal</b> — un toque</span></button>`);
  }
  return out.join('');
}

function moreSummary() {
  const pay = form.payId ? (state.paymentMethods.find((p) => p.id === form.payId) || {}).name : null;
  const parts = [form.date && form.date !== todayStr() ? form.date : 'Hoy'];
  if (pay) parts.push(pay);
  if (form.note) parts.push('nota');
  return parts.join(' · ');
}

export function renderCapture(container) {
  root = container;
  const isGasto = form.type === 'gasto';
  root.innerHTML = `
  <section class="capture">
    <div class="banners">${bannersHtml()}</div>
    <div class="seg" role="tablist" aria-label="Tipo de movimiento">
      <button type="button" data-type="gasto" class="${isGasto ? 'on' : ''}">Gasto</button>
      <button type="button" data-type="ingreso" class="${!isGasto ? 'on' : ''}">Ingreso</button>
    </div>
    <div class="amount-wrap"><div id="amt" class="amount zero"></div></div>
    <div class="quick" id="quick">${quickHtml()}</div>
    <div class="cats" id="cats">${categoriesHtml()}</div>
    ${isGasto ? `<div class="seg nec" id="nec">
      <button type="button" data-nec="necesario" class="${form.necessity === 'necesario' ? 'on' : ''}">✓ Necesario</button>
      <button type="button" data-nec="prescindible" class="${form.necessity === 'prescindible' ? 'on' : ''}">✂ Prescindible</button>
    </div>` : ''}
    <button type="button" class="more-toggle" id="moreToggle"><span>Más detalles · <span id="moreSum">${esc(moreSummary())}</span></span><span>${form.moreOpen ? '▴' : '▾'}</span></button>
    <div class="more ${form.moreOpen ? 'open' : ''}" id="more">
      ${isGasto ? `<div class="chips" id="pays">${payChipsHtml()}</div>` : ''}
      <div class="two">
        <input type="text" id="note" placeholder="Nota (opcional)" maxlength="120" value="${esc(form.note)}" aria-label="Nota">
        <input type="date" id="date" value="${esc(form.date || todayStr())}" max="${todayStr()}" aria-label="Fecha">
      </div>
    </div>
    <div class="keypad" id="keypad">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) =>
        `<button type="button" data-key="${k}" aria-label="${k === 'back' ? 'Borrar' : k === '.' ? 'Punto decimal' : k}">${k === 'back' ? '⌫' : k}</button>`).join('')}
    </div>
    <button type="button" class="save" id="save" disabled>Guardar ${isGasto ? 'gasto' : 'ingreso'}</button>
  </section>`;
  paintAmount();
  bind();
}

function payChipsHtml() {
  const chips = [`<button type="button" class="chip ${!form.payId ? 'on' : ''}" data-pay="">Sin método</button>`];
  for (const p of [...state.paymentMethods].sort((a, b) => a.order - b.order)) {
    chips.push(`<button type="button" class="chip ${form.payId === p.id ? 'on' : ''}" data-pay="${esc(p.id)}">${esc(p.name)}</button>`);
  }
  return chips.join('');
}

// ---------- Eventos ----------
function bind() {
  root.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t)) return;

    if (t.dataset.key) { pressKey(t.dataset.key); return; }

    if (t.dataset.type) {
      setCaptureType(t.dataset.type);
      form.payId = null;
      renderCapture(root);
      return;
    }
    if (t.dataset.cat) {
      form.catId = t.dataset.cat;
      const cat = catById(form.catId);
      if (form.type === 'gasto' && !form.necTouched && cat && cat.defaultNecessity) {
        form.necessity = cat.defaultNecessity;
        $$('#nec button', root).forEach((b) => b.classList.toggle('on', b.dataset.nec === form.necessity));
      }
      $$('#cats .cat', root).forEach((b) => b.classList.toggle('on', b.dataset.cat === form.catId));
      paintAmount();
      vibrate(8);
      return;
    }
    if (t.dataset.nec) {
      form.necessity = t.dataset.nec;
      form.necTouched = true;
      $$('#nec button', root).forEach((b) => b.classList.toggle('on', b.dataset.nec === form.necessity));
      return;
    }
    if (t.dataset.pay !== undefined && t.closest('#pays')) {
      form.payId = t.dataset.pay || null;
      $('#pays', root).innerHTML = payChipsHtml();
      $('#moreSum', root).textContent = moreSummary();
      return;
    }
    if (t.dataset.quick) { saveQuick(t.dataset.quick); return; }
    if (t.id === 'moreToggle') {
      form.moreOpen = !form.moreOpen;
      $('#more', root).classList.toggle('open', form.moreOpen);
      t.lastElementChild.textContent = form.moreOpen ? '▴' : '▾';
      return;
    }
    if (t.id === 'save') { save(); return; }
    if (t.dataset.act === 'recurring') { openRecurringSheet(); return; }
    if (t.dataset.act === 'backup') { doBackup().then((ok) => ok && renderCapture(root)); return; }
    if (t.dataset.act === 'newcat') { openNewCategory(); return; }
    if (t.dataset.act === 'goSummary') { go('summary'); return; }
    if (t.dataset.act === 'wishes') { openWishlist(refreshBanners); return; }
    if (t.dataset.act === 'payday') {
      const p = paydayReminder();
      if (p) setSetting('paydayDismissed', p.key).then(() => { toast('¡Bien! Ahorro de la quincena hecho ✔'); refreshBanners(); });
      return;
    }
    if (t.dataset.act === 'sunday') {
      const s = sundayReminder();
      if (s) setSetting('sundayDismissed', s.key).then(() => go('summary'));
      return;
    }
  };

  const note = $('#note', root);
  if (note) note.oninput = () => { form.note = note.value; $('#moreSum', root).textContent = moreSummary(); };
  const date = $('#date', root);
  if (date) date.onchange = () => {
    form.date = date.value && date.value !== todayStr() ? date.value : null;
    $('#moreSum', root).textContent = moreSummary();
  };
}

// Teclado físico (útil al probar en computadora). Se ignora si se escribe en un campo.
document.addEventListener('keydown', (e) => {
  if (!root || !root.isConnected || !$('#keypad', root)) return;
  if (document.querySelector('#sheet-root.open')) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement && document.activeElement.tagName)) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === '.' || e.key === ',') pressKey('.');
  else if (e.key === 'Backspace') pressKey('back');
  else if (e.key === 'Enter') { const s = $('#save', root); if (s && !s.disabled) save(); }
});

// ---------- Guardado ----------
function budgetMessage(cat, before, after, date) {
  if (cat.outOfPlan) return `🚫 ${cat.name} está fuera de tu plan: este mes llevas ${money(after)} aquí.`;
  const lvl = budgetAlert(before, after, cat.monthlyBudget);
  if (!lvl) return null;
  const left = cat.monthlyBudget - after;
  if (lvl === 'over') return `⚠️ ${cat.name}: ya pasaste tu presupuesto (${money(after)} de ${money(cat.monthlyBudget)}).`;
  if (lvl === 100) return `🚨 ${cat.name}: llegaste al 100% de tu presupuesto (${money(cat.monthlyBudget)}).`;
  return `⚠️ ${cat.name}: ya usaste el 80% de tu presupuesto. Te quedan ${money(Math.max(left, 0))}.`;
}

async function insertExpense(rec) {
  const cat = catById(rec.categoryId);
  const month = rec.date.slice(0, 7);
  const before = sum(inMonth(state.expenses, month).filter((x) => x.categoryId === rec.categoryId));
  await put('expenses', rec);
  const after = before + rec.amount;
  const warn = cat ? budgetMessage(cat, before, after, rec.date) : null;
  const label = cat ? cat.name : 'Gasto';
  toast(`Guardado ${money(rec.amount)} · ${label}${warn ? '\n' + warn : ''}`, {
    action: 'Deshacer',
    kind: warn ? 'warn' : '',
    duration: warn ? 7000 : 4000,
    onAction: async () => { await remove('expenses', rec.id); toast('Gasto deshecho'); refreshBanners(); }
  });
  vibrate(20);
  requestPersistence();
}

/** Revisa el plan antes de guardar. Devuelve 'save', 'cancel' o 'wish'. */
async function guard(rec) {
  const w = checkExpense(rec);
  if (!w) return 'save';
  vibrate([40, 60, 40]);
  const r = await choose(w.title, w.text, [
    { label: 'No lo compro · a mi Lista de deseos', value: 'wish', kind: 'primary' },
    { label: 'Ya lo gasté · registrarlo', value: 'save', kind: 'danger' },
    { label: 'Cancelar', value: 'cancel' }
  ]);
  return r || 'cancel';
}

async function toWishlist(rec) {
  const cat = catById(rec.categoryId);
  const wish = await addWish({ name: rec.note || (cat ? cat.name : 'Gasto'), amount: rec.amount, categoryId: rec.categoryId });
  toast(`Anotado en tu Lista de deseos. Decides el ${decideDate(wish)} ✔`, { duration: 5000 });
  refreshBanners();
}

async function save() {
  const cents = toCents(form.amount);
  if (!cents) { shake(); toast('Escribe un monto'); return; }
  if (!form.catId) { toast('Elige una categoría'); return; }
  const date = form.date || todayStr();
  const btn = $('#save', root);
  btn.disabled = true;
  try {
    if (form.type === 'gasto') {
      const rec = {
        id: uid(), amount: cents, categoryId: form.catId, necessity: form.necessity,
        paymentMethodId: form.payId, note: form.note.trim(), date, createdAt: new Date().toISOString()
      };
      const g = await guard(rec);
      if (g === 'cancel') { btn.disabled = false; return; }
      if (g === 'wish') await toWishlist(rec);
      else await insertExpense(rec);
    } else {
      const rec = { id: uid(), amount: cents, categoryId: form.catId, note: form.note.trim(), date, createdAt: new Date().toISOString() };
      await put('incomes', rec);
      const c = catById(form.catId);
      toast(`Ingreso guardado ${money(cents)} · ${c ? c.name : ''}`, {
        action: 'Deshacer', onAction: async () => { await remove('incomes', rec.id); toast('Ingreso deshecho'); }
      });
      vibrate(20);
      requestPersistence();
    }
  } catch (e) {
    toast('No se pudo guardar: ' + (e.message || e), { kind: 'bad', duration: 7000 });
    btn.disabled = false;
    return;
  }
  // Reinicia para el siguiente gasto (conserva el tipo y el método de pago usado).
  form.amount = ''; form.catId = null; form.note = ''; form.date = null; form.necTouched = false;
  renderCapture(root);
}

async function saveQuick(id) {
  const q = state.quickExpenses.find((x) => x.id === id);
  if (!q) return;
  try {
    const rec = {
      id: uid(), amount: q.amount, categoryId: q.categoryId, necessity: q.necessity,
      paymentMethodId: q.paymentMethodId || null, note: q.name, date: todayStr(), createdAt: new Date().toISOString()
    };
    const g = await guard(rec);
    if (g === 'cancel') return;
    if (g === 'wish') await toWishlist(rec);
    else { await insertExpense(rec); refreshBanners(); }
  } catch (e) {
    toast('No se pudo guardar: ' + (e.message || e), { kind: 'bad' });
  }
}

function shake() {
  const a = $('#amt', root);
  a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
  vibrate([30, 40, 30]);
}

function refreshBanners() {
  const b = $('.banners', root);
  if (b && root.isConnected) b.innerHTML = bannersHtml();
}

// ---------- Hoja: recurrentes pendientes ----------
function openRecurringSheet() {
  const pend = pendingRecurring(state.recurring, todayStr());
  if (!pend.length) { closeSheet(); refreshBanners(); return; }
  const body = openSheet(
    pend.map((r) => {
      const c = catById(r.categoryId);
      return `<div class="card" data-r="${esc(r.id)}">
        <div class="row"><span style="font-size:1.4rem">${esc(c ? c.icon : '🔁')}</span>
          <div class="grow"><b>${esc(r.name)}</b><div class="muted" style="font-size:.85rem">${esc(c ? c.name : '')} · día ${r.dayOfMonth}</div></div>
          <input type="text" inputmode="decimal" value="${(r.amount / 100).toString()}" style="width:110px;text-align:right" aria-label="Monto de ${esc(r.name)}">
        </div>
        <div class="sheet-actions"><button type="button" class="btn" data-skip>Omitir este mes</button><button type="button" class="btn primary" data-ok>Registrar</button></div>
      </div>`;
    }).join(''),
    { title: 'Pagos recurrentes por confirmar' }
  );
  body.onclick = async (e) => {
    const card = e.target.closest('[data-r]');
    if (!card) return;
    const r = state.recurring.find((x) => x.id === card.dataset.r);
    if (!r) return;
    const month = todayStr().slice(0, 7);
    if (e.target.closest('[data-skip]')) {
      await put('recurring', { ...r, lastConfirmedMonth: month });
    } else if (e.target.closest('[data-ok]')) {
      const cents = toCents($('input', card).value);
      if (!cents) { toast('Escribe un monto válido'); return; }
      await insertExpense({
        id: uid(), amount: cents, categoryId: r.categoryId, necessity: r.necessity,
        paymentMethodId: r.paymentMethodId || null, note: r.name, date: todayStr(), createdAt: new Date().toISOString()
      });
      await put('recurring', { ...r, lastConfirmedMonth: month });
    } else return;
    openRecurringSheet();
    refreshBanners();
  };
}

// ---------- Hoja: nueva categoría sin salir de la captura ----------
function openNewCategory() {
  const type = form.type;
  const body = openSheet(`
    <label class="field"><span>Nombre</span><input type="text" id="ncName" maxlength="30" placeholder="Ej. Salud"></label>
    <label class="field"><span>Ícono (un emoji)</span><input type="text" id="ncIcon" maxlength="4" value="🏷️"></label>
    ${type === 'gasto' ? `<div class="seg nec" id="ncNec" style="margin-bottom:12px">
      <button type="button" data-nec="necesario" class="on">✓ Necesario</button>
      <button type="button" data-nec="prescindible">✂ Prescindible</button></div>` : ''}
    <div class="sheet-actions"><button type="button" class="btn" id="ncCancel">Cancelar</button><button type="button" class="btn primary" id="ncSave">Crear</button></div>`,
    { title: type === 'gasto' ? 'Nueva categoría de gasto' : 'Nueva categoría de ingreso' });
  let nec = 'necesario';
  $$('#ncNec button', body).forEach((b) => (b.onclick = () => {
    nec = b.dataset.nec;
    $$('#ncNec button', body).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#ncCancel', body).onclick = closeSheet;
  $('#ncSave', body).onclick = async () => {
    const name = $('#ncName', body).value.trim();
    if (!name) { toast('Escribe un nombre'); return; }
    const order = Math.max(-1, ...state.categories.filter((c) => c.type === type).map((c) => c.order)) + 1;
    const cat = await put('categories', {
      id: 'c_' + uid().slice(0, 8), name, type, icon: $('#ncIcon', body).value.trim() || '🏷️',
      defaultNecessity: type === 'gasto' ? nec : null, order, archived: false, monthlyBudget: null,
      color: ['#2dd4bf', '#f97316', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#22c55e', '#ef4444', '#06b6d4', '#84cc16', '#f59e0b', '#8b5cf6'][order % 12]
    });
    form.catId = cat.id;
    if (type === 'gasto') { form.necessity = nec; form.necTouched = false; }
    closeSheet();
    renderCapture(root);
  };
}

// Ajustes: meta de ahorro, categorías y presupuestos, métodos de pago,
// gastos de un toque, pagos recurrentes y respaldo.
import { state, put, remove, setSetting, catById, catsOf, colorFor } from './db.js';
import { esc, money, toCents, fromCents, uid, shortDate, $, $$ } from './util.js';
import { toast, openSheet, closeSheet, field, options, ask } from './ui.js';
import { doBackup, pickAndImport, persistenceStatus, requestPersistence } from './backup.js';
import { applyPlan, wishlist, totalBudget, PLAN, OUT_OF_PLAN } from './plan.js';
import { openWishlist } from './wishes.js';

let root = null;
let rerender = () => {};

const necSeg = (id, value) => `<div class="seg nec" id="${id}" style="margin-bottom:12px">
  <button type="button" data-nec="necesario" class="${value === 'necesario' ? 'on' : ''}">✓ Necesario</button>
  <button type="button" data-nec="prescindible" class="${value === 'prescindible' ? 'on' : ''}">✂ Prescindible</button></div>`;
const bindNec = (body, id, get, set) => $$(`#${id} button`, body).forEach((b) => (b.onclick = () => {
  set(b.dataset.nec);
  $$(`#${id} button`, body).forEach((x) => x.classList.toggle('on', x === b));
}));
const row = (icon, title, sub, act) => `<button type="button" class="li" data-act="${act}">
  <span class="ic">${esc(icon)}</span><span class="grow"><div>${esc(title)}</div>${sub ? `<div class="muted" style="font-size:.82rem">${esc(sub)}</div>` : ''}</span><span class="chev">›</span></button>`;

export async function renderSettings(container) {
  root = container;
  rerender = () => renderSettings(root);
  const goal = Number(state.settings.savingsGoalPct) || 0;
  const last = state.settings.lastBackupAt ? shortDate(state.settings.lastBackupAt) : 'nunca';
  const persisted = await persistenceStatus();

  root.innerHTML = `
    <h1 class="page-title">Ajustes</h1>
    <div class="section-h">Mi plan</div>
    <div class="list">
      ${row('📋', 'Aplicar mi presupuesto', state.settings.planAppliedAt ? `Aplicado el ${shortDate(state.settings.planAppliedAt)} · ${money(totalBudget())} al mes` : 'Carga los montos de tu Excel', 'plan')}
      ${row('🛍️', 'Lista de deseos', `${wishlist().filter((w) => !w.decision).length} esperando · regla de 30 días`, 'wishes')}
      ${row('⏰', 'Recordatorios', 'Quincena, revisión de domingo y avisos en el teléfono', 'reminders')}
    </div>
    <div class="section-h">Ahorro y presupuestos</div>
    <div class="list">
      ${row('🎯', 'Meta de ahorro', goal ? `${goal}% de tus ingresos` : 'Sin definir', 'goal')}
      ${row('🏷️', 'Categorías y presupuestos', `${catsOf('gasto').length} de gasto · ${catsOf('ingreso').length} de ingreso`, 'cats')}
    </div>
    <div class="section-h">Captura rápida</div>
    <div class="list">
      ${row('⚡', 'Gastos de un toque', `${state.quickExpenses.length} configurados`, 'quick')}
      ${row('💳', 'Métodos de pago', state.paymentMethods.map((p) => p.name).join(', ') || 'Ninguno', 'pays')}
      ${row('🔁', 'Pagos recurrentes', `${state.recurring.length} configurados`, 'rec')}
    </div>
    <div class="section-h">Datos</div>
    <div class="list">
      ${row('💾', 'Hacer respaldo ahora', `Último respaldo: ${last}`, 'backup')}
      ${row('♻️', 'Restaurar desde un respaldo', 'Reemplaza todos los datos', 'import')}
      ${persisted
        ? `<div class="li"><span class="ic">🔒</span><span class="grow"><div>Almacenamiento protegido</div><div class="muted" style="font-size:.82rem">Chrome no borrará tus datos automáticamente</div></div></div>`
        : row('🔓', 'Proteger los datos en el teléfono', 'Pide a Chrome que no los borre', 'persist')}
    </div>
    <p class="muted" style="text-align:center;font-size:.8rem">Gasto Rápido v1 · tus datos solo viven en este teléfono</p>
  `;

  root.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    ({
      goal: openGoal, cats: openCategories, quick: openQuick, pays: openPays, rec: openRecurring,
      plan: openPlan, wishes: () => openWishlist(rerender), reminders: openReminders,
      backup: async () => { if (await doBackup()) rerender(); },
      import: () => pickAndImport(() => location.reload()),
      persist: async () => {
        const ok = await requestPersistence();
        toast(ok ? 'Datos protegidos ✔' : 'Chrome no lo concedió. Instala la app en la pantalla de inicio y vuelve a intentar.', { duration: 6000 });
        rerender();
      }
    })[b.dataset.act]();
  };
}

// ---------- Mi plan ----------
function openPlan() {
  const outNames = OUT_OF_PLAN.map((id) => catById(id)).filter(Boolean).map((c) => `${c.icon} ${c.name}`).join(', ');
  const body = openSheet(`
    <p class="muted" style="margin-top:0;font-size:.88rem">Pone en la app los montos de tu Excel. Puedes ajustar cualquiera después en Categorías y presupuestos.</p>
    <div class="list">${PLAN.map((p) => `<div class="li"><span class="ic">${esc(p.icon)}</span><span class="grow">${esc(p.name)}</span><b class="num">${esc(money(p.budget))}</b></div>`).join('')}
      <div class="li"><span class="ic">∑</span><span class="grow"><b>Total</b></span><b class="num">${esc(money(PLAN.reduce((a, p) => a + p.budget, 0)))}</b></div></div>
    ${outNames ? `<p style="font-size:.9rem">🚫 <b>Fuera del plan</b> (te avisa con cualquier gasto): ${esc(outNames)}.</p>` : ''}
    <p style="font-size:.9rem">🎯 Meta de ahorro: <b>50%</b> de tus ingresos.</p>
    <div class="sheet-actions"><button type="button" class="btn" id="c">Cancelar</button><button type="button" class="btn primary" id="s">Aplicar</button></div>`,
    { title: 'Aplicar mi presupuesto' });
  $('#c', body).onclick = closeSheet;
  $('#s', body).onclick = async () => {
    await applyPlan();
    closeSheet(); rerender(); toast('Presupuesto aplicado ✔');
  };
}

// ---------- Recordatorios ----------
function openReminders() {
  const s = state.settings;
  const days = s.paydays || [15, 31];
  const body = openSheet(`
    <label class="row" style="margin-bottom:10px"><input type="checkbox" id="rp" ${s.remindPayday === false ? '' : 'checked'}><span>Aviso de quincena: págate primero y regla de 48 horas</span></label>
    <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${field('Día de pago 1', `<input type="number" id="d1" min="1" max="31" inputmode="numeric" value="${days[0] || ''}">`)}
      ${field('Día de pago 2 (31 = fin de mes)', `<input type="number" id="d2" min="1" max="31" inputmode="numeric" value="${days[1] || ''}">`)}
    </div>
    ${field('Cuánto pasar a ahorro cada quincena', `<input type="text" id="pt" inputmode="decimal" value="${s.payTransfer ? esc(fromCents(s.payTransfer)) : ''}" placeholder="Ej. 6737.50">`)}
    <label class="row" style="margin-bottom:14px"><input type="checkbox" id="rs" ${s.remindSunday === false ? '' : 'checked'}><span>Revisión de domingo</span></label>
    <div class="card"><h3>Avisos en el teléfono (con la app cerrada)</h3>
      <p style="font-size:.88rem;margin:0">La app no tiene servidor, así que los avisos a hora fija los pones en <b>MacroDroid</b>:</p>
      <ol style="font-size:.88rem;padding-left:20px;margin:8px 0 0">
        <li>Nueva macro → Disparador: <b>Día/Hora</b> (ej. todos los días 9:00 pm).</li>
        <li>Acción: <b>Mostrar notificación</b> "¿Ya registraste tus gastos de hoy?".</li>
        <li>Al tocarla: <b>Abrir sitio web</b> con el enlace de la app y <code>?view=capture</code> al final.</li>
        <li>Repite para el día de pago (días ${esc(String(days[0] || 15))} y ${esc(String(days[1] || 31))}) y el domingo, con <code>?view=summary</code>.</li>
      </ol></div>
    <div class="sheet-actions"><button type="button" class="btn" id="c">Cancelar</button><button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: 'Recordatorios' });
  $('#c', body).onclick = closeSheet;
  $('#s', body).onclick = async () => {
    const d1 = Math.round(Number($('#d1', body).value)), d2 = Math.round(Number($('#d2', body).value));
    const valid = (d) => d >= 1 && d <= 31;
    if (!valid(d1) || ($('#d2', body).value && !valid(d2))) { toast('Los días de pago van del 1 al 31'); return; }
    const pt = $('#pt', body).value.trim();
    const ptc = pt ? toCents(pt) : 0;
    if (pt && !ptc) { toast('Escribe un monto válido'); return; }
    await setSetting('paydays', [d1, ...(valid(d2) ? [d2] : [])]);
    await setSetting('payTransfer', ptc);
    await setSetting('remindPayday', $('#rp', body).checked);
    await setSetting('remindSunday', $('#rs', body).checked);
    closeSheet(); rerender(); toast('Recordatorios guardados ✔');
  };
}

// ---------- Meta de ahorro ----------
function openGoal() {
  const body = openSheet(`
    ${field('Porcentaje de tus ingresos que quieres ahorrar cada mes', `<input type="number" id="g" inputmode="numeric" min="0" max="100" step="1" value="${Number(state.settings.savingsGoalPct) || ''}" placeholder="Ej. 20">`)}
    <p class="muted" style="font-size:.85rem">Verás el avance en Resumen: ingresos del mes menos gastos, contra esta meta. Pon 0 para desactivarla.</p>
    <div class="sheet-actions"><button type="button" class="btn" id="c">Cancelar</button><button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: 'Meta de ahorro' });
  $('#c', body).onclick = closeSheet;
  $('#s', body).onclick = async () => {
    const v = Math.round(Number($('#g', body).value));
    if (!Number.isFinite(v) || v < 0 || v > 100) { toast('Escribe un número entre 0 y 100'); return; }
    await setSetting('savingsGoalPct', v);
    closeSheet(); rerender(); toast(v ? `Meta: ahorrar ${v}% de tus ingresos` : 'Meta desactivada');
  };
}

// ---------- Categorías ----------
function openCategories() {
  const list = (type) => catsOf(type, true).map((c) => `<button type="button" class="li" data-cat="${esc(c.id)}">
    <span class="ic">${esc(c.icon)}</span>
    <span class="grow"><div style="${c.archived ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(c.name)}</div>
    <div class="muted" style="font-size:.8rem">${type === 'gasto' ? (c.defaultNecessity === 'prescindible' ? '✂ Prescindible' : '✓ Necesario') + (c.monthlyBudget ? ` · presupuesto ${esc(money(c.monthlyBudget))}` : '') : 'Ingreso'}${c.archived ? ' · archivada' : ''}</div></span>
    <span class="chev">›</span></button>`).join('');
  const body = openSheet(`
    <div class="section-h" style="margin-top:0">Gastos</div><div class="list">${list('gasto')}</div>
    <button type="button" class="btn block" data-new="gasto" style="margin-bottom:14px">＋ Nueva categoría de gasto</button>
    <div class="section-h">Ingresos</div><div class="list">${list('ingreso')}</div>
    <button type="button" class="btn block" data-new="ingreso">＋ Nueva categoría de ingreso</button>`,
    { title: 'Categorías y presupuestos' });
  body.onclick = (e) => {
    const c = e.target.closest('[data-cat]'); const n = e.target.closest('[data-new]');
    if (c) editCategory(catById(c.dataset.cat));
    else if (n) editCategory(null, n.dataset.new);
  };
}

function editCategory(cat, type) {
  const isNew = !cat;
  const t = cat ? cat.type : type;
  let nec = (cat && cat.defaultNecessity) || 'necesario';
  const body = openSheet(`
    ${field('Nombre', `<input type="text" id="n" maxlength="30" value="${esc(cat ? cat.name : '')}">`)}
    ${field('Ícono (un emoji)', `<input type="text" id="i" maxlength="4" value="${esc(cat ? cat.icon : '🏷️')}">`)}
    ${t === 'gasto' ? `<span class="muted" style="font-size:.8rem">Marca por defecto</span>${necSeg('nec', nec)}
      ${field('Presupuesto mensual (opcional)', `<input type="text" id="b" inputmode="decimal" placeholder="Sin presupuesto" value="${cat && cat.monthlyBudget ? esc(fromCents(cat.monthlyBudget)) : ''}">`)}
      <label class="row" style="margin-bottom:14px"><input type="checkbox" id="o" ${cat && cat.outOfPlan ? 'checked' : ''}><span>Fuera de mi plan (avisarme con cualquier gasto)</span></label>` : ''}
    ${!isNew ? `<label class="row" style="margin-bottom:14px"><input type="checkbox" id="a" ${cat.archived ? 'checked' : ''}><span>Archivar (ocultar al capturar; el historial se conserva)</span></label>` : ''}
    <div class="sheet-actions"><button type="button" class="btn" id="c">Volver</button><button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: isNew ? 'Nueva categoría' : 'Editar categoría' });
  bindNec(body, 'nec', null, (v) => (nec = v));
  $('#c', body).onclick = openCategories;
  $('#s', body).onclick = async () => {
    const name = $('#n', body).value.trim();
    if (!name) { toast('Escribe un nombre'); return; }
    const order = isNew ? Math.max(-1, ...state.categories.filter((c) => c.type === t).map((c) => c.order)) + 1 : cat.order;
    await put('categories', {
      ...(cat || { id: 'c_' + uid().slice(0, 8), type: t, color: colorFor(order) }),
      name, icon: $('#i', body).value.trim() || '🏷️', order,
      defaultNecessity: t === 'gasto' ? nec : null,
      monthlyBudget: t === 'gasto' && !$('#o', body).checked ? (toCents($('#b', body).value) || null) : null,
      outOfPlan: t === 'gasto' ? $('#o', body).checked : false,
      archived: !isNew && $('#a', body).checked
    });
    openCategories(); rerender();
  };
}

// ---------- Métodos de pago ----------
function openPays() {
  const body = openSheet(`
    <div class="list">${[...state.paymentMethods].sort((a, b) => a.order - b.order).map((p) =>
      `<button type="button" class="li" data-p="${esc(p.id)}"><span class="ic">💳</span><span class="grow">${esc(p.name)}</span><span class="chev">›</span></button>`).join('')}</div>
    <button type="button" class="btn block" data-new>＋ Nuevo método de pago</button>`, { title: 'Métodos de pago' });
  body.onclick = (e) => {
    const p = e.target.closest('[data-p]');
    if (p) editPay(state.paymentMethods.find((x) => x.id === p.dataset.p));
    else if (e.target.closest('[data-new]')) editPay(null);
  };
}
function editPay(p) {
  const body = openSheet(`
    ${field('Nombre', `<input type="text" id="n" maxlength="40" value="${esc(p ? p.name : '')}" placeholder="Ej. Débito BBVA">`)}
    <div class="sheet-actions">${p ? '<button type="button" class="btn danger" id="d">Eliminar</button>' : '<button type="button" class="btn" id="c">Volver</button>'}<button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: p ? 'Editar método' : 'Nuevo método de pago' });
  const c = $('#c', body); if (c) c.onclick = openPays;
  const d = $('#d', body);
  if (d) d.onclick = async () => {
    if (await ask(`¿Eliminar "${p.name}"? Los gastos ya registrados se conservan sin método.`, { ok: 'Eliminar', danger: true })) {
      await remove('paymentMethods', p.id); openPays(); rerender();
    }
  };
  $('#s', body).onclick = async () => {
    const name = $('#n', body).value.trim();
    if (!name) { toast('Escribe un nombre'); return; }
    await put('paymentMethods', p ? { ...p, name } : { id: 'p_' + uid().slice(0, 8), name, order: Math.max(-1, ...state.paymentMethods.map((x) => x.order)) + 1 });
    openPays(); rerender();
  };
}

// ---------- Gastos de un toque ----------
function openQuick() {
  const body = openSheet(`
    <p class="muted" style="font-size:.88rem;margin-top:0">Un toque en la pantalla de captura los guarda al instante con la fecha de hoy.</p>
    <div class="list">${state.quickExpenses.map((q) => {
      const c = catById(q.categoryId);
      return `<button type="button" class="li" data-q="${esc(q.id)}"><span class="ic">${esc(c ? c.icon : '⚡')}</span>
        <span class="grow"><div>${esc(q.name)}</div><div class="muted" style="font-size:.8rem">${esc(c ? c.name : '')}</div></span>
        <b class="num">${esc(money(q.amount))}</b><span class="chev">›</span></button>`;
    }).join('') || '<div class="li muted">Aún no hay ninguno</div>'}</div>
    <button type="button" class="btn block" data-new>＋ Nuevo gasto de un toque</button>`, { title: 'Gastos de un toque' });
  body.onclick = (e) => {
    const q = e.target.closest('[data-q]');
    if (q) editQuick(state.quickExpenses.find((x) => x.id === q.dataset.q));
    else if (e.target.closest('[data-new]')) editQuick(null);
  };
}
function editQuick(q) {
  let nec = q ? q.necessity : 'prescindible';
  const cats = catsOf('gasto').map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }));
  const pays = state.paymentMethods.map((p) => ({ value: p.id, label: p.name }));
  const body = openSheet(`
    ${field('Nombre', `<input type="text" id="n" maxlength="24" value="${esc(q ? q.name : '')}" placeholder="Ej. Café">`)}
    ${field('Monto', `<input type="text" id="a" inputmode="decimal" value="${q ? esc(fromCents(q.amount)) : ''}" placeholder="0.00">`)}
    ${field('Categoría', `<select id="c">${options(cats, q ? q.categoryId : cats[0] && cats[0].value)}</select>`)}
    ${necSeg('nec', nec)}
    ${field('Método de pago', `<select id="p">${options(pays, q ? q.paymentMethodId || '' : '', { blank: 'Sin método' })}</select>`)}
    <div class="sheet-actions">${q ? '<button type="button" class="btn danger" id="d">Eliminar</button>' : '<button type="button" class="btn" id="b">Volver</button>'}<button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: q ? 'Editar gasto de un toque' : 'Nuevo gasto de un toque' });
  bindNec(body, 'nec', null, (v) => (nec = v));
  const b = $('#b', body); if (b) b.onclick = openQuick;
  const d = $('#d', body);
  if (d) d.onclick = async () => { await remove('quickExpenses', q.id); openQuick(); rerender(); };
  $('#s', body).onclick = async () => {
    const name = $('#n', body).value.trim(); const amount = toCents($('#a', body).value);
    if (!name || !amount) { toast('Escribe nombre y monto'); return; }
    await put('quickExpenses', {
      ...(q || { id: 'q_' + uid().slice(0, 8) }), name, amount,
      categoryId: $('#c', body).value, necessity: nec, paymentMethodId: $('#p', body).value || null
    });
    openQuick(); rerender();
  };
}

// ---------- Recurrentes ----------
function openRecurring() {
  const body = openSheet(`
    <p class="muted" style="font-size:.88rem;margin-top:0">Cuando llega el día, la app te avisa en Captura y tú confirmas el monto real con un toque.</p>
    <div class="list">${state.recurring.map((r) => {
      const c = catById(r.categoryId);
      return `<button type="button" class="li" data-r="${esc(r.id)}"><span class="ic">${esc(c ? c.icon : '🔁')}</span>
        <span class="grow"><div>${esc(r.name)}</div><div class="muted" style="font-size:.8rem">Día ${r.dayOfMonth} de cada mes</div></span>
        <b class="num">${esc(money(r.amount))}</b><span class="chev">›</span></button>`;
    }).join('') || '<div class="li muted">Aún no hay ninguno</div>'}</div>
    <button type="button" class="btn block" data-new>＋ Nuevo pago recurrente</button>`, { title: 'Pagos recurrentes' });
  body.onclick = (e) => {
    const r = e.target.closest('[data-r]');
    if (r) editRecurring(state.recurring.find((x) => x.id === r.dataset.r));
    else if (e.target.closest('[data-new]')) editRecurring(null);
  };
}
function editRecurring(r) {
  let nec = r ? r.necessity : 'necesario';
  const cats = catsOf('gasto').map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }));
  const body = openSheet(`
    ${field('Nombre', `<input type="text" id="n" maxlength="40" value="${esc(r ? r.name : '')}" placeholder="Ej. Netflix">`)}
    ${field('Monto habitual', `<input type="text" id="a" inputmode="decimal" value="${r ? esc(fromCents(r.amount)) : ''}" placeholder="0.00">`)}
    ${field('Categoría', `<select id="c">${options(cats, r ? r.categoryId : cats[0] && cats[0].value)}</select>`)}
    ${field('Día del mes', `<input type="number" id="d" inputmode="numeric" min="1" max="31" value="${r ? r.dayOfMonth : ''}" placeholder="1 a 31">`)}
    ${necSeg('nec', nec)}
    <div class="sheet-actions">${r ? '<button type="button" class="btn danger" id="x">Eliminar</button>' : '<button type="button" class="btn" id="b">Volver</button>'}<button type="button" class="btn primary" id="s">Guardar</button></div>`,
    { title: r ? 'Editar pago recurrente' : 'Nuevo pago recurrente' });
  bindNec(body, 'nec', null, (v) => (nec = v));
  const b = $('#b', body); if (b) b.onclick = openRecurring;
  const x = $('#x', body);
  if (x) x.onclick = async () => { await remove('recurring', r.id); openRecurring(); rerender(); };
  $('#s', body).onclick = async () => {
    const name = $('#n', body).value.trim(); const amount = toCents($('#a', body).value);
    const day = Math.round(Number($('#d', body).value));
    if (!name || !amount) { toast('Escribe nombre y monto'); return; }
    if (!(day >= 1 && day <= 31)) { toast('El día debe ser entre 1 y 31'); return; }
    await put('recurring', {
      ...(r || { id: 'r_' + uid().slice(0, 8), lastConfirmedMonth: null }),
      name, amount, categoryId: $('#c', body).value, necessity: nec, dayOfMonth: day
    });
    openRecurring(); rerender();
  };
}

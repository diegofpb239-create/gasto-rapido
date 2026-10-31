// Hoja de la Lista de deseos (regla de 30 días).
import { esc, money, toCents, todayStr, $ } from './util.js';
import { openSheet, closeSheet, toast, field } from './ui.js';
import { wishlist, addWish, decideWish, deleteWish, daysLeft, decideDate, savedByWishes, WAIT_DAYS } from './plan.js';

export function openWishlist(onChange = () => {}) {
  const list = wishlist();
  const saved = savedByWishes();
  const item = (w) => {
    const left = daysLeft(w);
    const status = w.decision === 'skipped' ? 'Decidiste no comprarlo 👍'
      : w.decision === 'bought' ? 'Lo compraste'
      : left > 0 ? `Faltan ${left} día${left === 1 ? '' : 's'} · decides el ${decideDate(w)}`
      : 'Ya puedes decidir';
    const acts = !w.decision
      ? (left > 0
        ? `<div class="acts"><button type="button" class="btn" data-skip="${esc(w.id)}">Ya no lo quiero</button></div>`
        : `<div class="acts"><button type="button" class="btn" data-skip="${esc(w.id)}">Ya no lo quiero</button><button type="button" class="btn primary" data-buy="${esc(w.id)}">Sí lo compro</button></div>`)
      : `<div class="acts"><button type="button" class="btn" data-del="${esc(w.id)}">Quitar de la lista</button></div>`;
    return `<div class="wish ${w.decision ? 'done' : ''}"><b class="ellipsis">${esc(w.name)}</b><b class="num">${esc(money(w.amount))}</b>
      <span class="muted" style="font-size:.82rem;grid-column:1/-1">${esc(status)}</span>${acts}</div>`;
  };
  const body = openSheet(`
    <p class="muted" style="margin-top:0;font-size:.88rem">Lo que no estaba en tu plan espera ${WAIT_DAYS} días aquí. Si después lo sigues queriendo, lo planeas.</p>
    ${saved ? `<div class="card"><h3>Te has ahorrado</h3><span class="big" style="color:var(--good)">${esc(money(saved))}</span></div>` : ''}
    <div class="list">${list.length ? list.map(item).join('') : '<div class="li muted">Tu lista está vacía.</div>'}</div>
    ${field('¿Qué quieres comprar?', '<input type="text" id="wn" maxlength="60" placeholder="Ej. Audífonos">')}
    ${field('Precio', '<input type="text" id="wa" inputmode="decimal" placeholder="0.00">')}
    <div class="sheet-actions"><button type="button" class="btn" id="wc">Cerrar</button><button type="button" class="btn primary" id="ws">Agregar</button></div>`,
    { title: 'Lista de deseos' });

  const refresh = () => { onChange(); openWishlist(onChange); };
  body.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'wc') { closeSheet(); return; }
    if (b.id === 'ws') {
      const name = $('#wn', body).value.trim(); const amount = toCents($('#wa', body).value);
      if (!name || !amount) { toast('Escribe qué es y su precio'); return; }
      await addWish({ name, amount });
      toast(`Anotado. Decides el ${decideDate({ date: todayStr() })}`);
      refresh(); return;
    }
    if (b.dataset.skip) { await decideWish(b.dataset.skip, 'skipped'); toast('Bien. Ese dinero se queda en tu ahorro ✔'); refresh(); return; }
    if (b.dataset.buy) { await decideWish(b.dataset.buy, 'bought'); toast('Regístralo en Captura cuando lo compres'); refresh(); return; }
    if (b.dataset.del) { await deleteWish(b.dataset.del); refresh(); }
  };
}

// Arranque de la app y navegación entre pantallas.
import { load } from './db.js';
import { $, $$, esc } from './util.js';
import { toast } from './ui.js';
import { renderCapture, setCaptureType } from './capture.js';
import { renderMovements } from './movements.js';
import { renderSummary } from './summary.js';
import { renderSettings } from './settings.js';

const viewEl = document.getElementById('view');
let current = 'capture';

const VIEWS = {
  capture: (el) => renderCapture(el),
  movements: (el) => renderMovements(el),
  summary: (el) => renderSummary(el, { goToSettings: () => show('settings') }),
  settings: (el) => renderSettings(el)
};

export function show(name) {
  if (!VIEWS[name]) name = 'capture';
  current = name;
  viewEl.className = name === 'capture' ? 'fixed' : '';
  viewEl.scrollTop = 0;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  VIEWS[name](viewEl);
}

async function start() {
  try {
    await load();
  } catch (e) {
    viewEl.innerHTML = `<div class="card"><h3>No se pudo abrir la base de datos</h3>
      <p>${esc(e && e.message || e)}</p>
      <p class="muted">Si estás en modo incógnito o con el almacenamiento bloqueado, ábrela en una pestaña normal de Chrome.</p></div>`;
    return;
  }

  $$('#nav button').forEach((b) => (b.onclick = () => show(b.dataset.view)));
  document.addEventListener('gr:navigate', (e) => show(e.detail));

  // Accesos directos del ícono (manifest "shortcuts"): ?view=capture&type=ingreso
  const q = new URLSearchParams(location.search);
  if (q.get('type')) setCaptureType(q.get('type'));
  show(q.get('view') || 'capture');
  if (q.has('view') || q.has('type')) history.replaceState(null, '', location.pathname);

  // Al volver a la app (otro día, otra pestaña) se refresca lo que depende de la fecha.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !document.querySelector('#sheet-root.open')) {
      if (current === 'capture' || current === 'summary') show(current);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { toast('No se pudo activar el modo sin conexión. Reabre la app con internet.', { kind: 'warn', duration: 7000 }); });
  }
}

window.addEventListener('error', (e) => toast('Error: ' + (e.message || 'desconocido'), { kind: 'bad', duration: 6000 }));
window.addEventListener('unhandledrejection', (e) => toast('Error: ' + ((e.reason && e.reason.message) || e.reason || 'desconocido'), { kind: 'bad', duration: 6000 }));

start();

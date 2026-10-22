// Componentes de interfaz compartidos: avisos (toast), hoja inferior y diálogo de confirmación.
import { esc } from './util.js';

// ---------- Toast ----------
export function toast(message, { action, onAction, kind = '', duration = 4500 } = {}) {
  const root = document.getElementById('toast-root');
  while (root.children.length >= 2) root.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="msg">${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  const kill = () => el.remove();
  if (action) {
    el.querySelector('button').onclick = () => { kill(); onAction && onAction(); };
  }
  root.appendChild(el);
  setTimeout(kill, duration);
  return kill;
}

// ---------- Hoja inferior ----------
let sheetOpen = false;
const sheetRoot = () => document.getElementById('sheet-root');

/** Abre (o reemplaza el contenido de) la hoja. Devuelve el contenedor del cuerpo. */
export function openSheet(html, { title = '' } = {}) {
  const root = sheetRoot();
  root.innerHTML =
    `<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true">` +
    `<div class="sheet-grab"></div>${title ? `<h2>${esc(title)}</h2>` : ''}` +
    `<div class="sheet-body">${html}</div></div>`;
  root.classList.add('open');
  if (!sheetOpen) {
    history.pushState({ sheet: 1 }, '');
    sheetOpen = true;
  }
  root.querySelector('.backdrop').onclick = closeSheet;
  return root.querySelector('.sheet-body');
}

function hideSheet() {
  sheetOpen = false;
  const root = sheetRoot();
  root.classList.remove('open');
  root.innerHTML = '';
}

export function closeSheet() {
  if (!sheetOpen) return;
  if (history.state && history.state.sheet) history.back(); // dispara popstate → hideSheet
  else hideSheet();
}

// El botón "atrás" de Android cierra la hoja en lugar de salir de la app.
window.addEventListener('popstate', () => { if (sheetOpen) hideSheet(); });

// ---------- Confirmación ----------
export function ask(message, { ok = 'Aceptar', cancel = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    root.innerHTML =
      `<div class="dialog" role="alertdialog"><p>${esc(message)}</p>` +
      `<div class="sheet-actions"><button class="btn" data-r="0">${esc(cancel)}</button>` +
      `<button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    root.classList.add('open');
    const finish = (v) => { root.classList.remove('open'); root.innerHTML = ''; resolve(v); };
    root.querySelectorAll('button').forEach((b) => (b.onclick = () => finish(b.dataset.r === '1')));
    root.onclick = (e) => { if (e.target === root) finish(false); };
  });
}

// ---------- Utilidades de formulario ----------
export const field = (label, inner) => `<label class="field"><span>${esc(label)}</span>${inner}</label>`;
export const options = (items, selected, { blank } = {}) =>
  (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
  items.map((i) => `<option value="${esc(i.value)}" ${i.value === selected ? 'selected' : ''}>${esc(i.label)}</option>`).join('');
export const vibrate = (ms = 15) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* sin vibración */ } };

// Respaldo e importación en JSON. Usa el menú "Compartir" de Android para guardar en Drive.
import { state, exportAll, replaceAll, setSetting, validateBackup } from './db.js';
import { todayStr } from './util.js';
import { toast, ask } from './ui.js';

/** Genera el respaldo y lo comparte/descarga. Devuelve true si quedó guardado. */
export async function doBackup() {
  const json = JSON.stringify(exportAll(), null, 2);
  const name = `gasto-rapido-${todayStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Respaldo Gasto Rápido' });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false; // el usuario cerró el menú de compartir
    toast('No se pudo crear el respaldo: ' + (e.message || e), { kind: 'bad' });
    return false;
  }
  await setSetting('lastBackupAt', new Date().toISOString());
  toast('Respaldo guardado ✔');
  return true;
}

/** Abre el selector de archivos y reemplaza los datos por los del respaldo. */
export function pickAndImport(onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); }
    catch { toast('El archivo no es un JSON válido.', { kind: 'bad' }); return; }
    const err = validateBackup(obj);
    if (err) { toast(err, { kind: 'bad', duration: 6000 }); return; }
    const n = obj.data.expenses.length + obj.data.incomes.length;
    const ok = await ask(
      `Se reemplazarán TODOS los datos actuales por el respaldo (${n} movimientos, creado el ${obj.exportedAt ? obj.exportedAt.slice(0, 10) : 'fecha desconocida'}). ¿Continuar?`,
      { ok: 'Restaurar', danger: true }
    );
    if (!ok) return;
    try {
      await replaceAll(obj);
      toast('Datos restaurados ✔');
      onDone && onDone();
    } catch (e) {
      toast('No se pudo restaurar: ' + (e.message || e), { kind: 'bad', duration: 6000 });
    }
  };
  input.click();
}

/** Pide a Chrome que no borre los datos si hay poco espacio. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (_) { /* no disponible */ }
  return false;
}

export async function persistenceStatus() {
  try {
    if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted();
  } catch (_) { /* no disponible */ }
  return false;
}

export const hasData = () => state.expenses.length + state.incomes.length > 0;

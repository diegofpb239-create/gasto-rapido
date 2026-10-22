// Gráficas SVG sin dependencias.
import { esc } from './util.js';

/**
 * Dona. data = [{label, value, color}], centerTop y centerBottom son los textos del centro.
 * Se dibuja con arcos (stroke-dasharray) sobre un círculo.
 */
export function donut(data, { size = 200, stroke = 30, centerTop = '', centerBottom = '' } = {}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  const gap = data.length > 1 ? 2 : 0; // separación visual entre segmentos
  const arcs = total > 0
    ? data.filter((d) => d.value > 0).map((d) => {
        const len = (d.value / total) * c;
        const seg = Math.max(len - gap, 0.5);
        const svg = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${esc(d.color)}" stroke-width="${stroke}" ` +
          `stroke-dasharray="${seg} ${c - seg}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(d.label)}</title></circle>`;
        offset += len;
        return svg;
      }).join('')
    : '';
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Gasto por categoría">` +
    `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${stroke}"/>` +
    arcs +
    `<text x="${cx}" y="${cx - 2}" text-anchor="middle" font-size="22" font-weight="800">${esc(centerTop)}</text>` +
    `<text x="${cx}" y="${cx + 20}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${esc(centerBottom)}</text>` +
    `</svg>`;
}

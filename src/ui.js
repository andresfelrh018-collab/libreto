// Utilidades de interfaz: escape de HTML, iconos SVG, portadas e insignias.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto del catálogo antes de insertarlo como HTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Solo deja pasar URLs http(s); cualquier otra cosa se descarta. */
export const safeUrl = (u) => {
  if (typeof u !== 'string' || !u.trim()) return '';
  try {
    const url = new URL(u, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};

const svg = (body, { size = 24, fill = 'none', stroke = 'currentColor', sw = 2.2 } = {}) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  home: (s) => svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', { size: s, fill: 'currentColor', stroke: 'none' }),
  homeOutline: (s) => svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', { size: s }),
  search: (s, sw) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', { size: s, sw }),
  library: (s, sw) => svg('<path d="M5 4v16M10 4v16M15 6l4 13"/>', { size: s, sw }),
  back: () => svg('<path d="M15 5l-7 7 7 7"/>', { sw: 2.4 }),
  heart: (filled) =>
    svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', {
      size: 26,
      fill: filled ? 'var(--accent)' : 'none',
      stroke: filled ? 'var(--accent)' : 'currentColor',
      sw: 2,
    }),
  heartSolid: (s = 22) =>
    svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', { size: s, fill: '#fff', stroke: 'none' }),
  more: () => svg('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>', { size: 26, fill: '#B3B3B3', stroke: 'none' }),
  play: (s = 26, color = 'currentColor') => svg('<path d="M7 4.5v15l13-7.5z"/>', { size: s, fill: color, stroke: 'none' }),
  pause: (s = 26) => svg('<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>', { size: s, fill: 'currentColor', stroke: 'none' }),
  eq: () => svg('<path d="M4 10v4h2V10zM9 6v12h2V6zM14 8v8h2V8zM19 11v2h2v-2z"/>', { size: 16, fill: 'var(--accent)', stroke: 'none' }),
  check: () => svg('<path d="M5 12l5 5 9-10"/>', { size: 16 }),
};

/** Etiqueta corta y clase de color para la insignia de licencia. */
export function licenseBadge(serie) {
  const lic = serie.licencia || '';
  const isPD = /dominio p[uú]blico|public domain|cc0/i.test(lic);
  const label = isPD ? 'Dominio público' : lic;
  return `<span class="badge ${isPD ? 'badge--pd' : 'badge--cc'}">${esc(label)}</span>`;
}

/** Insignia "+18" (vacía si el título no tiene clasificación). */
export const ratingBadge = (s) => (s.clasificacion ? `<span class="badge badge--rating" aria-label="Para mayores de ${esc(s.clasificacion.replace('+', ''))} años">${esc(s.clasificacion)}</span>` : '');

export const isPublicDomain = (serie) => /dominio p[uú]blico|public domain|cc0/i.test(serie.licencia || '');

export const TIPO = { serie: 'Serie', pelicula: 'Película', corto: 'Corto' };

/**
 * Portada cuadrada. Si hay imagen la muestra; si falla o no existe, queda el
 * degradado del color de la serie con el título encima.
 */
export function cover(serie, { cls = '', showTitle = true } = {}) {
  const src = safeUrl(serie.portada);
  const img = src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('cover--img');this.remove()">`
    : '';
  const rating = serie.clasificacion && showTitle ? `<span class="cover__rating">${ratingBadge(serie)}</span>` : '';
  return `<div class="cover ${src ? 'cover--img' : ''} ${cls}" style="--c:${esc(serie.color || '#555')}">${img}${rating}${
    showTitle ? `<div class="cover__title">${esc(serie.titulo)}</div>` : ''
  }</div>`;
}

/** 7450 → "2 h 4 min", 942 → "16 min" */
export function fmtDur(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${Math.max(m, 1)} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Oscurece un color hex (para el mini reproductor y degradados). */
export function shade(hex, factor = 0.6) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#333333';
  const n = parseInt(m[1], 16);
  const ch = (s) => Math.round(((n >> s) & 255) * factor).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Minúsculas y sin tildes: "Película" → "pelicula". */
export const norm = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const licCorta = (s) => (isPublicDomain(s) ? 'Dominio público' : s.licencia);

/** Fila de lista (Biblioteca y Buscar): miniatura de 64 px, título, tipo y licencia. */
export function row(s, extra = '') {
  return `<li><a class="row" href="#/serie/${esc(s.id)}">
    ${cover(s, { cls: 'row__thumb', showTitle: false })}
    <span class="row__text">
      <span class="row__title">${esc(s.titulo)}</span>
      <span class="row__meta">${ratingBadge(s)}${esc([TIPO[s.tipo], licCorta(s)].filter(Boolean).join(' · '))}${extra ? ` · ${esc(extra)}` : ''}</span>
    </span>
  </a></li>`;
}

/** Tarjeta de cuadrícula (vista alternativa de Biblioteca). */
export function tile(s) {
  return `<li><a class="tile" href="#/serie/${esc(s.id)}">${cover(s)}<span class="tile__meta">${esc(TIPO[s.tipo] || '')} · ${esc(licCorta(s))}</span></a></li>`;
}

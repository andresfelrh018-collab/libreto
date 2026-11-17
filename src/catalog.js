// Carga y valida catalog.json. Agregar contenido = editar public/catalog.json.
import { getProgress } from './storage.js';
import { fmtDur } from './ui.js';

let cache = null;

const REQUIRED = ['id', 'titulo', 'licencia', 'url_licencia', 'fuente', 'url_fuente'];

export async function loadCatalog() {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${res.status})`);
  const data = await res.json();
  const series = (data.series || []).filter((s) => {
    const missing = REQUIRED.filter((k) => !s[k]);
    const ok = !missing.length && Array.isArray(s.episodios) && s.episodios.length > 0;
    // Regla legal: sin licencia o fuente, el título no se muestra.
    if (!ok) console.warn(`[catálogo] Se omite "${s.id || s.titulo}": falta ${missing.join(', ') || 'episodios'}`);
    return ok;
  });
  series.forEach((s) => s.episodios.sort((a, b) => a.numero - b.numero));
  cache = { ...data, series, byId: new Map(series.map((s) => [s.id, s])) };
  return cache;
}

/**
 * Episodio con el que continuar una serie: el último empezado sin terminar,
 * o el siguiente al último visto, o el primero.
 */
export function nextEpisode(serie) {
  let lastSeen = null;
  let lastAt = 0;
  for (const ep of serie.episodios) {
    const p = getProgress(serie.id, ep.numero);
    if (p && p.at > lastAt) {
      lastAt = p.at;
      lastSeen = { ep, p };
    }
  }
  if (!lastSeen) return serie.episodios[0];
  if (!lastSeen.p.visto) return lastSeen.ep;
  const i = serie.episodios.indexOf(lastSeen.ep);
  return serie.episodios[i + 1] || serie.episodios[0];
}

/** Texto de estado: "Visto · 14 min", "Quedan 9 min" o la duración. */
export function episodeState(serie, ep) {
  const p = getProgress(serie.id, ep.numero);
  const dur = ep.duracion_seg || p?.d || 0;
  if (p?.visto) return { visto: true, enCurso: false, texto: `Visto · ${fmtDur(dur)}` };
  if (p && p.t > 10) return { visto: false, enCurso: true, texto: `Quedan ${fmtDur(Math.max(dur - p.t, 60))}` };
  return { visto: false, enCurso: false, texto: fmtDur(dur) };
}


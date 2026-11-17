// Estado local en localStorage: favoritos, progreso por episodio y último visto.
// Todo envuelto en try/catch: en modo privado o con almacenamiento bloqueado la
// app sigue funcionando, solo que sin recordar nada.

const KEY = 'libreto:v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      favoritos: Array.isArray(data.favoritos) ? data.favoritos : [],
      progreso: data.progreso && typeof data.progreso === 'object' ? data.progreso : {},
      ultimo: data.ultimo || null,
      edad: data.edad === true,
    };
  } catch {
    return { favoritos: [], progreso: {}, ultimo: null, edad: false };
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible */
  }
}

const epKey = (serieId, num) => `${serieId}#${num}`;

/* ---- Favoritos ---- */
export const isFav = (id) => state.favoritos.includes(id);
export function toggleFav(id) {
  state.favoritos = isFav(id) ? state.favoritos.filter((x) => x !== id) : [id, ...state.favoritos];
  save();
  return isFav(id);
}
export const favoritos = () => [...state.favoritos];

/* ---- Progreso ---- */
/** @returns {{t:number, d:number, visto:boolean, at:number} | null} */
export const getProgress = (serieId, num) => state.progreso[epKey(serieId, num)] || null;

export function setProgress(serieId, num, t, d) {
  const visto = d > 0 && t / d >= 0.95;
  state.progreso[epKey(serieId, num)] = { t: Math.floor(t), d: Math.floor(d), visto, at: Date.now() };
  state.ultimo = { serieId, num, at: Date.now() };
  save();
}

export const ultimo = () => state.ultimo;

/** Series con actividad, de la más reciente a la más antigua. */
export function recientes() {
  const by = new Map();
  for (const [k, v] of Object.entries(state.progreso)) {
    const id = k.slice(0, k.lastIndexOf('#'));
    by.set(id, Math.max(by.get(id) || 0, v.at || 0));
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/* ---- Contenido +18 ---- */
export const edadConfirmada = () => state.edad;
export function confirmarEdad() {
  state.edad = true;
  save();
}

/* ---- Preferencias de vista (no críticas) ---- */
export function pref(key, fallback) {
  try {
    return localStorage.getItem(`libreto:pref:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function setPref(key, value) {
  try {
    localStorage.setItem(`libreto:pref:${key}`, value);
  } catch {
    /* sin almacenamiento */
  }
}

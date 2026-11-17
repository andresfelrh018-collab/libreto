// Tu biblioteca: favoritos y lo que has visto, con filtros, orden y vista.
import { esc, row, tile, icons, norm } from '../ui.js';
import { favoritos, recientes, getProgress, pref, setPref } from '../storage.js';
import { PERFIL } from '../config.js';

const FILTROS = [
  { id: 'favoritos', label: 'Favoritos' },
  { id: 'serie', label: 'Series' },
  { id: 'pelicula', label: 'Películas' },
  { id: 'vistos', label: 'Ya vistos' },
];

const ORDEN = { recientes: 'Recientes', az: 'A-Z' };

const ic = {
  sort: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/></svg>',
  grid: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
};

/** Estado de avance de un título: cuántos episodios vistos y si hay uno en curso. */
function avance(s) {
  let vistos = 0;
  let enCurso = null;
  for (const e of s.episodios) {
    const p = getProgress(s.id, e.numero);
    if (p?.visto) vistos++;
    else if (p && p.t > 10 && !enCurso) enCurso = e;
  }
  return { vistos, enCurso, completo: vistos === s.episodios.length };
}

function etiquetaAvance(s, a) {
  if (a.completo) return 'Visto';
  if (a.enCurso) return s.tipo === 'serie' ? `Ep. ${a.enCurso.numero} en curso` : 'En curso';
  if (a.vistos) return `${a.vistos} de ${s.episodios.length} vistos`;
  return '';
}

/** Lo que entra en la biblioteca: favoritos + títulos con actividad, por recencia. */
function itemsBiblioteca(cat) {
  const ids = [...recientes(), ...favoritos()];
  return [...new Set(ids)].map((id) => cat.byId.get(id)).filter(Boolean);
}

export function renderLibrary(view, cat, params = {}) {
  let filtro = FILTROS.some((f) => f.id === params.filtro) ? params.filtro : null;
  let orden = pref('orden', 'recientes');
  let vista = pref('vista', 'lista');

  function paint() {
    const favs = new Set(favoritos());
    let items = itemsBiblioteca(cat);
    if (filtro === 'favoritos') items = items.filter((s) => favs.has(s.id));
    else if (filtro === 'serie') items = items.filter((s) => s.tipo === 'serie');
    else if (filtro === 'pelicula') items = items.filter((s) => s.tipo === 'pelicula' || s.tipo === 'corto');
    else if (filtro === 'vistos') items = items.filter((s) => avance(s).vistos > 0);
    if (orden === 'az') items = [...items].sort((a, b) => norm(a.titulo).localeCompare(norm(b.titulo), 'es'));

    const vacio = !itemsBiblioteca(cat).length
      ? `<div class="empty"><p>Aún no tienes nada aquí. Toca el corazón en una serie para guardarla; lo que empieces a ver también aparecerá en esta lista.</p><a class="btn" href="#/">Explorar el catálogo</a></div>`
      : `<p class="empty">No hay títulos con este filtro.</p>`;

    const lista = !items.length
      ? vacio
      : vista === 'cuadricula'
        ? `<ul class="tiles">${items.map(tile).join('')}</ul>`
        : `<ul class="rows">${items.map((s) => row(s, etiquetaAvance(s, avance(s)))).join('')}</ul>`;

    view.innerHTML = `
      <div class="lib">
        <header class="lib__head">
          <span class="avatar" aria-hidden="true">${esc(PERFIL.inicial)}</span>
          <h1 class="lib__title">Tu biblioteca</h1>
          <a class="icon-btn" href="#/buscar" aria-label="Buscar">${icons.search(24)}</a>
        </header>
        <div class="lib__chips" role="group" aria-label="Filtrar biblioteca">
          ${FILTROS.map((f) => `<button type="button" class="chip" data-f="${f.id}" aria-pressed="${f.id === filtro}">${f.label}</button>`).join('')}
        </div>
        <div class="lib__bar">
          <button type="button" class="lib__sort" data-orden aria-label="Ordenar: ${ORDEN[orden]}. Cambiar orden">${ic.sort}${ORDEN[orden]}</button>
          <button type="button" class="icon-btn lib__view" data-vista aria-label="${vista === 'lista' ? 'Ver como cuadrícula' : 'Ver como lista'}">${vista === 'lista' ? ic.grid : ic.list}</button>
        </div>
        ${lista}
      </div>`;

    view.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        filtro = filtro === b.dataset.f ? null : b.dataset.f; // tocar de nuevo quita el filtro
        history.replaceState(null, '', filtro ? `#/biblioteca/${filtro}` : '#/biblioteca');
        paint();
        view.querySelector(`[data-f="${b.dataset.f}"]`).focus();
      })
    );
    view.querySelector('[data-orden]').addEventListener('click', () => {
      orden = orden === 'recientes' ? 'az' : 'recientes';
      setPref('orden', orden);
      paint();
      view.querySelector('[data-orden]').focus();
    });
    view.querySelector('[data-vista]').addEventListener('click', () => {
      vista = vista === 'lista' ? 'cuadricula' : 'lista';
      setPref('vista', vista);
      paint();
      view.querySelector('[data-vista]').focus();
    });
  }

  paint();
}

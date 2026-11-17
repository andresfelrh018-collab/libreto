// Buscar: por título (también autor, género y sinopsis) y filtro por género.
import { esc, row, norm, icons } from '../ui.js';

// Se conserva mientras la app esté abierta, para volver atrás sin perder la búsqueda.
let query = '';
let genero = null;

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Géneros del catálogo con su número de títulos y un color para el mosaico. */
function generos(cat) {
  const map = new Map();
  for (const s of cat.series) {
    for (const g of s.generos || []) {
      const e = map.get(g) || { id: g, n: 0, color: s.color };
      e.n++;
      map.set(g, e);
    }
  }
  const lista = [...map.values()].sort((a, b) => b.n - a.n || a.id.localeCompare(b.id, 'es'));
  const adultos = cat.series.filter((s) => s.clasificacion === '+18');
  if (adultos.length) lista.unshift({ id: ADULTOS, n: adultos.length, color: '#7A2E3A' });
  return lista;
}

const ADULTOS = '+18';
const etiquetaGenero = (g) => (g === ADULTOS ? '+18 · Adultos' : cap(g));
const tieneGenero = (s, g) => (g === ADULTOS ? s.clasificacion === '+18' : (s.generos || []).includes(g));

/** Puntaje: el título pesa más que autor/género, y estos más que la sinopsis. */
function puntaje(s, q) {
  if (!q) return 1;
  const words = q.split(/\s+/).filter(Boolean);
  const titulo = norm(s.titulo);
  const otros = norm([s.autor, ...(s.generos || []), s.clasificacion === '+18' ? '+18 adultos adulto mayores' : '', s.aviso, ...s.episodios.map((e) => e.titulo)].join(' '));
  const sinopsis = norm(s.sinopsis);
  let total = 0;
  for (const w of words) {
    if (titulo.startsWith(w)) total += 10;
    else if (titulo.includes(w)) total += 6;
    else if (otros.includes(w)) total += 3;
    else if (sinopsis.includes(w)) total += 1;
    else return 0; // todas las palabras deben aparecer
  }
  return total;
}

function resultados(cat) {
  const q = norm(query.trim());
  return cat.series
    .filter((s) => !genero || tieneGenero(s, genero))
    .map((s) => ({ s, p: puntaje(s, q) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.s.titulo.localeCompare(b.s.titulo, 'es'))
    .map((x) => x.s);
}

export function renderSearch(view, cat) {
  const gens = generos(cat);

  view.innerHTML = `
    <div class="lib search">
      <header class="lib__head"><h1 class="lib__title">Buscar</h1></header>
      <form class="search__form" role="search" data-form>
        <label class="search__field">
          <span class="sr-only">Buscar por título, autor o género</span>
          ${icons.search(20)}
          <input type="search" data-q placeholder="¿Qué quieres ver?" autocomplete="off" enterkeyhint="search" value="${esc(query)}">
        </label>
        <button type="button" class="search__clear" data-clear aria-label="Borrar búsqueda" ${query ? '' : 'hidden'}>Borrar</button>
      </form>
      <div class="lib__chips" role="group" aria-label="Filtrar por género" data-gen-chips></div>
      <div data-results aria-live="polite"></div>
    </div>`;

  const input = view.querySelector('[data-q]');
  const results = view.querySelector('[data-results]');
  const chips = view.querySelector('[data-gen-chips]');
  const clear = view.querySelector('[data-clear]');

  function paintChips() {
    chips.hidden = !query && !genero;
    chips.innerHTML = gens
      .map((g) => `<button type="button" class="chip" data-gen="${esc(g.id)}" aria-pressed="${g.id === genero}">${esc(etiquetaGenero(g.id))}</button>`)
      .join('');
  }

  function paintResults() {
    clear.hidden = !query;
    if (!query && !genero) {
      results.innerHTML = `<h2 class="search__sub">Explorar por género</h2>
        <ul class="genres">${gens
          .map((g) => `<li><button type="button" class="genre" data-gen="${esc(g.id)}" style="--g:${esc(g.color || '#555')}">
              <span class="genre__name">${esc(etiquetaGenero(g.id))}</span><span class="genre__n">${g.n} ${g.n === 1 ? 'título' : 'títulos'}</span>
            </button></li>`)
          .join('')}</ul>`;
      return;
    }
    const list = resultados(cat);
    const que = [query && `«${query}»`, genero && etiquetaGenero(genero)].filter(Boolean).join(' en ');
    results.innerHTML = list.length
      ? `<p class="search__count">${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}</p><ul class="rows">${list.map((s) => row(s)).join('')}</ul>`
      : `<p class="empty">No encontramos nada para ${esc(que)}. Prueba con otra palabra o quita el filtro de género.</p>`;
  }

  const paint = () => {
    paintChips();
    paintResults();
  };

  input.addEventListener('input', () => {
    query = input.value;
    paint();
  });
  view.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    input.blur(); // cierra el teclado en el celular
  });
  clear.addEventListener('click', () => {
    query = '';
    input.value = '';
    paint();
    input.focus();
  });
  // En la raíz de esta pantalla (no en #view, que es permanente y acumularía escuchadores).
  view.querySelector('.search').addEventListener('click', (e) => {
    const b = e.target.closest('[data-gen]');
    if (!b) return;
    genero = genero === b.dataset.gen ? null : b.dataset.gen;
    paint();
    chips.querySelector(`[data-gen="${CSS.escape(b.dataset.gen)}"]`)?.focus();
  });

  paint();
  // Campo activo al entrar (en escritorio; en iPhone el teclado solo abre con un toque).
  input.focus({ preventScroll: true });
}

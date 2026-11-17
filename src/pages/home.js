import { esc, cover, isPublicDomain, TIPO, icons } from '../ui.js';
import { favoritos, recientes } from '../storage.js';
import { PERFIL } from '../config.js';
import { mountInstallCard } from '../install.js';

const FILTROS = [
  { id: 'todo', label: 'Todo' },
  { id: 'serie', label: 'Series' },
  { id: 'adultos', label: '+18' },
  { id: 'pelicula', label: 'Películas' },
  { id: 'corto', label: 'Cortos' },
];

const esAdulto = (s) => s.clasificacion === '+18';
const esModerno = (s) => parseInt(s.anio, 10) >= 2000;
const pasaFiltro = (s) => filtro === 'todo' || (filtro === 'adultos' ? esAdulto(s) : s.tipo === filtro);
let filtro = 'todo';

function saludo(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const hablaEspanol = (s) => s.idioma === 'es' || s.subtitulado === 'es' ||
  s.episodios.some((e) => (e.subtitulos || []).some((t) => t.idioma?.startsWith('es')));

const meta = (s) => [s.anio, s.generos?.[0] && cap(s.generos[0])].filter(Boolean).join(' · ');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function card(s) {
  return `<a class="card" href="#/serie/${esc(s.id)}">
    ${cover(s)}
    <span class="card__text"><span class="card__title">${esc(s.titulo)}</span><span class="card__meta">${esc(meta(s))}</span></span>
  </a>`;
}

function shelf(title, list) {
  if (!list.length) return '';
  return `<section class="shelf" aria-label="${esc(title)}">
    <h2 class="section-title">${esc(title)}</h2>
    <div class="shelf__row">${list.map(card).join('')}</div>
  </section>`;
}

function quickItem(s) {
  return `<a class="quick__item" href="#/serie/${esc(s.id)}">
    ${cover(s, { cls: 'quick__thumb', showTitle: false })}
    <span class="quick__label">${esc(s.titulo)}</span>
  </a>`;
}

/** Accesos rápidos 2 × 3: continuar viendo, favoritos y últimos títulos. */
function quickGrid(cat, visibles) {
  const ids = new Set(visibles.map((s) => s.id));
  const pick = [];
  const add = (s) => s && ids.has(s.id) && !pick.includes(s) && pick.push(s);
  recientes().forEach((id) => add(cat.byId.get(id)));
  const favTile = `<a class="quick__item" href="#/biblioteca/favoritos">
      <span class="quick__thumb quick__fav">${icons.heartSolid()}</span>
      <span class="quick__label">Mis favoritos${favoritos().length ? ` · ${favoritos().length}` : ''}</span>
    </a>`;
  favoritos().forEach((id) => add(cat.byId.get(id)));
  visibles.forEach(add);
  const items = pick.slice(0, 5).map(quickItem);
  items.splice(Math.min(1, items.length), 0, favTile);
  return `<div class="quick">${items.join('')}</div>`;
}

export function renderHome(view, cat) {
  const visibles = cat.series.filter(pasaFiltro);
  const glow = (cat.byId.get(recientes()[0]) || visibles[0] || {}).color;

  view.innerHTML = `
    <div class="home" style="${glow ? `--glow:${esc(glow)}` : ''}">
      <div class="home__glow" aria-hidden="true"></div>
      <header class="home__head">
        <span class="avatar" aria-hidden="true">${esc(PERFIL.inicial)}</span>
        <div role="group" aria-label="Filtrar por tipo" style="display:flex;gap:10px">
          ${FILTROS.map((f) => `<button type="button" class="chip" data-filtro="${f.id}" aria-pressed="${f.id === filtro}">${f.label}</button>`).join('')}
        </div>
      </header>
      <h1 class="home__hello">${saludo()}</h1>
      ${visibles.length ? quickGrid(cat, visibles) : `<p class="empty">No hay ${esc(TIPO[filtro]?.toLowerCase() || 'títulos')}s en el catálogo todavía.</p>`}
      <div data-install-slot></div>
      ${shelf('Series modernas', visibles.filter((s) => esModerno(s) && s.tipo === 'serie'))}
      ${shelf('Para adultos (+18)', visibles.filter(esAdulto))}
      ${shelf('Películas y cortos modernos', visibles.filter((s) => esModerno(s) && s.tipo !== 'serie'))}
      ${shelf('En español', visibles.filter(hablaEspanol))}
      ${shelf('Clásicos de dominio público', visibles.filter(isPublicDomain))}
      ${shelf('Creative Commons', visibles.filter((s) => !isPublicDomain(s)))}
    </div>`;

  mountInstallCard(view.querySelector('[data-install-slot]'));

  view.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      renderHome(view, cat);
      view.querySelector(`[data-filtro="${filtro}"]`)?.focus();
    })
  );
}

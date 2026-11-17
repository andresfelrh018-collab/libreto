import './styles.css';
import { route, start, currentPath } from './router.js';
import { loadCatalog } from './catalog.js';
import { ultimo, getProgress } from './storage.js';
import { esc, cover, icons, shade } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderSerie } from './pages/serie.js';
import { renderLibrary } from './pages/library.js';
import { renderSearch } from './pages/search.js';
import { renderPlayer } from './player.js';
import { initInstall } from './install.js';

const view = document.getElementById('view');
const mini = document.getElementById('mini');
const tabbar = document.getElementById('tabbar');

route('/', renderHome);
route('/serie/:id', renderSerie);
route('/ver/:id/:num', renderPlayer);
route('/buscar', renderSearch);
route('/biblioteca', renderLibrary);
route('/biblioteca/:filtro', renderLibrary);

const TABS = [
  { path: '/', label: 'Inicio', icon: (on) => (on ? icons.home(24) : icons.homeOutline(24)) },
  { path: '/buscar', label: 'Buscar', icon: (on) => icons.search(24, on ? 2.8 : 2.2) },
  { path: '/biblioteca', label: 'Biblioteca', icon: (on) => icons.library(24, on ? 2.8 : 2.2) },
];

function renderTabbar(path) {
  const active = path.startsWith('/buscar') ? '/buscar' : path.startsWith('/biblioteca') ? '/biblioteca' : '/';
  tabbar.innerHTML = TABS.map((t) => {
    const on = t.path === active;
    return `<a class="tab" href="#${t.path}" ${on ? 'aria-current="page"' : ''}>${t.icon(on)}${t.label}</a>`;
  }).join('');
}

/** Mini reproductor: el último episodio en curso, encima de la barra inferior. */
function renderMini(cat, path) {
  const u = ultimo();
  const s = u && cat.byId.get(u.serieId);
  const ep = s?.episodios.find((e) => e.numero === u.num);
  const p = ep && getProgress(s.id, ep.numero);
  if (!ep || !p || p.visto || path.startsWith('/ver/')) {
    mini.innerHTML = '';
    return;
  }
  const pct = p.d ? Math.min(100, (p.t / p.d) * 100) : 0;
  const sub = s.tipo === 'serie' ? `Episodio ${ep.numero} · ${ep.titulo}` : 'Continuar viendo';
  mini.innerHTML = `<a class="mini" href="#/ver/${esc(s.id)}/${ep.numero}" style="--mini-bg:${esc(shade(s.color, 0.55))}" aria-label="Continuar ${esc(s.titulo)}, ${esc(sub)}">
    ${cover(s, { cls: 'mini__thumb', showTitle: false })}
    <span class="mini__text"><span class="mini__title">${esc(s.titulo)}</span><br><span class="mini__sub">${esc(sub)}</span></span>
    <span aria-hidden="true">${icons.play(26, '#fff')}</span>
    <span class="mini__bar" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></span>
  </a>`;
}

async function boot() {
  let cat;
  try {
    cat = await loadCatalog();
  } catch (err) {
    view.innerHTML = `<div class="stub"><h1>No se pudo cargar el catálogo</h1><p>${esc(err.message)}</p><button class="btn" type="button" onclick="location.reload()">Reintentar</button></div>`;
    return;
  }
  let first = true;
  let cleanup = null;
  start((handler, params, path) => {
    if (!first) sessionStorage.setItem('libreto:nav', '1');
    first = false;
    cleanup?.(); // p. ej. el reproductor guarda el avance y suelta el video
    cleanup = handler(view, cat, params) || null;
    document.body.classList.toggle('is-player', path.startsWith('/ver/'));
    renderTabbar(path);
    renderMini(cat, path);
    window.scrollTo(0, 0);
    // Mueve el foco a la nueva pantalla, salvo que ella ya lo haya puesto (p. ej. el buscador).
    if (!view.contains(document.activeElement) || document.activeElement === document.body) view.focus({ preventScroll: true });
  });
  // Al volver a la pestaña, refresca el mini reproductor.
  addEventListener('pageshow', () => renderMini(cat, currentPath()));
}

initInstall();
boot();

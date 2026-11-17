import { esc, cover, licenseBadge, ratingBadge, safeUrl, icons, TIPO, fmtDur } from '../ui.js';
import { isFav, toggleFav } from '../storage.js';
import { nextEpisode, episodeState } from '../catalog.js';

const IDIOMA = { es: 'Español', en: 'Inglés', sv: 'Sueco', zxx: 'Sin diálogos' };

function link(url, text) {
  const u = safeUrl(url);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : esc(text);
}

function episodios(s, actual) {
  if (s.episodios.length === 1 && s.tipo !== 'serie') {
    const ep = s.episodios[0];
    const st = episodeState(s, ep);
    return `<ol class="eps" aria-label="Video">
      <li><a class="ep ${st.enCurso ? 'ep--current' : ''}" href="#/ver/${esc(s.id)}/${ep.numero}">
        <span class="ep__num">${st.enCurso ? icons.eq() : st.visto ? icons.check() : icons.play(16, 'var(--text-2)')}</span>
        <span class="ep__body"><span class="ep__title">${esc(TIPO[s.tipo] || 'Ver')} completa</span><br><span class="ep__state">${esc(st.texto)}</span></span>
      </a></li></ol>`;
  }
  return `<ol class="eps" aria-label="Episodios">${s.episodios
    .map((ep) => {
      const st = episodeState(s, ep);
      const current = ep === actual && st.enCurso;
      return `<li><a class="ep ${current ? 'ep--current' : ''}" href="#/ver/${esc(s.id)}/${ep.numero}" ${current ? 'aria-current="true"' : ''}>
        <span class="ep__num">${current ? `${icons.eq()}<span class="sr-only">En curso: </span>` : ep.numero}</span>
        <span class="ep__body"><span class="ep__title">${esc(ep.titulo)}</span><br><span class="ep__state">${esc(st.texto)}</span></span>
      </a></li>`;
    })
    .join('')}</ol>`;
}

function subsTexto(s) {
  if (s.subtitulado === 'es') return ', subtítulos en español incrustados';
  const langs = [...new Set(s.episodios.flatMap((e) => (e.subtitulos || []).map((t) => t.etiqueta || t.idioma)))];
  return langs.length ? `, subtítulos: ${langs.join(', ').toLowerCase()}` : '';
}

function creditos(s) {
  const fuenteEp = s.episodios.filter((e) => e.url_fuente);
  return `<section class="credits" id="creditos" aria-labelledby="creditos-t">
    <h2 id="creditos-t">Créditos y licencia</h2>
    <dl>
      <dt>Licencia</dt><dd>${link(s.url_licencia, s.licencia)}</dd>
      ${s.autor ? `<dt>Autor</dt><dd>${esc(s.autor)}</dd>` : ''}
      <dt>Fuente</dt><dd>${link(s.url_fuente, s.fuente)}</dd>
      ${s.idioma ? `<dt>Idioma</dt><dd>${esc(IDIOMA[s.idioma] || s.idioma)}${subsTexto(s)}</dd>` : ''}
    </dl>
    ${s.atribucion ? `<p><strong>Atribución:</strong> ${esc(s.atribucion)}</p>` : ''}
    ${s.nota_licencia ? `<p>${esc(s.nota_licencia)}</p>` : ''}
    ${fuenteEp.length > 1 ? `<p>Archivos originales: ${fuenteEp.map((e) => link(e.url_fuente, `Ep. ${e.numero}`)).join(' · ')}</p>` : ''}
  </section>`;
}

export function renderSerie(view, cat, { id }) {
  const s = cat.byId.get(id);
  if (!s) {
    view.innerHTML = `<div class="stub"><h1>No encontramos ese título</h1><p>Puede que se haya retirado del catálogo.</p><a class="btn" href="#/">Volver al inicio</a></div>`;
    return;
  }
  const actual = nextEpisode(s);
  const total = s.episodios.reduce((a, e) => a + (e.duracion_seg || 0), 0);
  const cuenta = s.tipo === 'serie' ? `${s.episodios.length} episodios` : fmtDur(total);
  const fav = isFav(s.id);

  view.innerHTML = `
    <article class="serie" style="--c:${esc(s.color || '#6A4F1A')}">
      <div class="serie__glow" aria-hidden="true"></div>
      <div class="serie__top">
        <a class="icon-btn" href="#/" aria-label="Volver" data-back>${icons.back()}</a>
      </div>
      <div class="serie__cover">${cover(s)}</div>
      <div class="serie__info">
        <h1 class="serie__title">${esc(s.titulo)}</h1>
        <p class="serie__syn">${esc(s.sinopsis || '')}</p>
        ${s.aviso ? `<p class="serie__warn"><strong>${esc(s.clasificacion || 'Aviso')}:</strong> ${esc(s.aviso)}</p>` : ''}
        <div class="serie__meta">${ratingBadge(s)}${licenseBadge(s)}<span>${esc([s.fuente, s.anio, cuenta].filter(Boolean).join(' · '))}</span></div>
      </div>
      <div class="serie__actions">
        <div class="serie__actions-left">
          <button type="button" class="icon-btn" data-fav aria-pressed="${fav}" aria-label="${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${icons.heart(fav)}</button>
          <a class="icon-btn" href="#/serie/${esc(s.id)}" data-creditos aria-label="Créditos y licencia">${icons.more()}</a>
        </div>
        <a class="play-btn" href="#/ver/${esc(s.id)}/${actual.numero}" aria-label="Reproducir ${esc(s.tipo === 'serie' ? `episodio ${actual.numero}` : s.titulo)}">${icons.play(26, 'var(--on-accent)')}</a>
      </div>
      ${episodios(s, actual)}
      ${creditos(s)}
    </article>`;

  view.querySelector('[data-back]').addEventListener('click', (e) => {
    // Si llegamos desde dentro de la app, volver atrás conserva el scroll.
    if (sessionStorage.getItem('libreto:nav')) {
      e.preventDefault();
      history.back();
    }
  });
  view.querySelector('[data-creditos]').addEventListener('click', (e) => {
    e.preventDefault();
    view.querySelector('#creditos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const favBtn = view.querySelector('[data-fav]');
  favBtn.addEventListener('click', () => {
    const on = toggleFav(s.id);
    favBtn.setAttribute('aria-pressed', on);
    favBtn.setAttribute('aria-label', on ? 'Quitar de favoritos' : 'Agregar a favoritos');
    favBtn.innerHTML = icons.heart(on);
  });
}

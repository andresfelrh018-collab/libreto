// Reproductor (Fase 2): <video> propio con controles, velocidad, subtítulos,
// continuar viendo y siguiente episodio automático.
//
// El cambio de episodio ocurre en el MISMO <video> (sin volver a renderizar
// la página): así iOS deja seguir reproduciendo sin un nuevo toque.

import { esc, safeUrl, icons, shade, ratingBadge } from './ui.js';
import { getProgress, setProgress, isFav, toggleFav, edadConfirmada, confirmarEdad } from './storage.js';

const SAVE_EVERY_MS = 5000; // guardar avance cada 5 s
const NEXT_DELAY_S = 3; // siguiente episodio tras 3 s
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const ic = {
  close: () => '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>',
  prev: () => '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 5v14l-9-7zM5 5h2v14H5z"/></svg>',
  next: (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5v14l9-7zM17 5h2v14h-2z"/></svg>`,
  list: () => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  full: () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  speed: () => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13l4-4"/><path d="M4.9 19a9 9 0 1 1 14.2 0"/></svg>',
};

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Descarga un .vtt/.srt y lo devuelve como URL local (blob:), para que el
 *  <video> no necesite crossorigin (Internet Archive no envía CORS). */
async function subtitleBlobUrl(url) {
  const abs = safeUrl(new URL(url, document.baseURI).href);
  if (!abs) throw new Error('URL de subtítulos no válida');
  const res = await fetch(abs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let text = await res.text();
  if (!/^\uFEFF?WEBVTT/.test(text)) {
    // SRT → VTT
    text = 'WEBVTT\n\n' + text.replace(/\r/g, '').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  }
  return URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
}

function ageGate(view, s) {
  return new Promise((resolve) => {
    view.innerHTML = `<div class="stub age">
      <span class="age__badge">${ratingBadge(s)}</span>
      <h1>Contenido para mayores de 18 años</h1>
      <p><strong>${esc(s.titulo)}</strong>${s.aviso ? `: ${esc(s.aviso)}` : ''}</p>
      <p>¿Tienes 18 años o más?</p>
      <div class="age__actions">
        <button type="button" class="btn" data-si>Sí, continuar</button>
        <a class="btn btn--ghost" href="#/serie/${esc(s.id)}">Volver</a>
      </div>
    </div>`;
    view.querySelector('[data-si]').addEventListener('click', () => {
      confirmarEdad();
      resolve(true);
    });
    view.querySelector('[data-si]').focus();
  });
}

export function renderPlayer(view, cat, { id, num }) {
  const s = cat.byId.get(id);
  let ep = s?.episodios.find((e) => String(e.numero) === String(num));
  if (!s || !ep) {
    view.innerHTML = `<div class="stub"><h1>Episodio no encontrado</h1><a class="btn" href="#/">Volver al inicio</a></div>`;
    return;
  }

  let disposed = false;
  let cleanupPlayer = null;
  const start = () => {
    if (!disposed) cleanupPlayer = mountPlayer(view, s, ep);
  };
  if (s.clasificacion === '+18' && !edadConfirmada()) ageGate(view, s).then(start);
  else start();

  return () => {
    disposed = true;
    cleanupPlayer?.();
  };
}

function mountPlayer(view, s, firstEp) {
  const c1 = s.color || '#6A4F1A';
  view.innerHTML = `
  <section class="player" style="--p1:${esc(c1)};--p2:${esc(shade(c1, 0.4))}" aria-label="Reproductor">
    <header class="player__top">
      <a class="icon-btn" href="#/serie/${esc(s.id)}" aria-label="Cerrar reproductor">${ic.close()}</a>
      <div class="player__from"><span>REPRODUCIENDO DESDE</span><strong>${esc(s.titulo)}</strong></div>
      <button type="button" class="icon-btn" data-speed aria-label="Velocidad de reproducción" aria-haspopup="dialog">${ic.speed()}</button>
    </header>

    <div class="player__stage">
      <video class="player__video" playsinline preload="metadata" aria-label="Video"></video>
      <button type="button" class="player__tap" data-tap aria-label="Reproducir o pausar"></button>
      <button type="button" class="player__full icon-btn" data-full aria-label="Pantalla completa">${ic.full()}</button>
      <div class="player__spinner" data-spinner hidden aria-hidden="true"></div>
      <div class="player__error" data-error hidden role="alert"></div>
    </div>

    <div class="player__head">
      <div class="player__titles"><h1 class="player__title" data-title></h1><p class="player__sub" data-sub></p></div>
      <button type="button" class="icon-btn" data-fav></button>
    </div>

    <div class="player__progress">
      <input type="range" class="seek" data-seek min="0" max="0" step="1" value="0" aria-label="Posición del video">
      <div class="player__times"><span data-cur>0:00</span><span data-dur>0:00</span></div>
    </div>

    <div class="player__controls">
      <button type="button" class="ctl ctl--cc" data-cc aria-pressed="false">CC</button>
      <button type="button" class="ctl" data-prev aria-label="Episodio anterior">${ic.prev()}</button>
      <button type="button" class="ctl ctl--play" data-play aria-label="Reproducir">${icons.play(30, '#121212')}</button>
      <button type="button" class="ctl" data-next aria-label="Episodio siguiente">${ic.next()}</button>
      <button type="button" class="ctl" data-list aria-label="Lista de episodios" aria-haspopup="dialog">${ic.list()}</button>
    </div>

    <div class="upnext" data-upnext hidden role="status">
      ${ic.next(18)}<span data-upnext-text></span>
      <button type="button" data-upnext-cancel>Cancelar</button>
    </div>

    <dialog class="sheet" data-sheet-speed aria-labelledby="sp-t">
      <h2 id="sp-t">Velocidad</h2>
      <div class="sheet__opts">${SPEEDS.map((r) => `<button type="button" data-rate="${r}">${r === 1 ? 'Normal' : `${String(r).replace('.', ',')}×`}</button>`).join('')}</div>
      <button type="button" class="sheet__close" data-close>Cerrar</button>
    </dialog>

    <dialog class="sheet" data-sheet-list aria-labelledby="ep-t">
      <h2 id="ep-t">Episodios</h2>
      <ol class="sheet__eps" data-eps></ol>
      <button type="button" class="sheet__close" data-close>Cerrar</button>
    </dialog>
  </section>`;

  const $ = (sel) => view.querySelector(sel);
  const video = $('video');
  const seek = $('[data-seek]');
  const playBtn = $('[data-play]');
  const ccBtn = $('[data-cc]');
  const favBtn = $('[data-fav]');
  const errBox = $('[data-error]');
  const spinner = $('[data-spinner]');
  const upnext = $('[data-upnext]');
  const sheetSpeed = $('[data-sheet-speed]');
  const sheetList = $('[data-sheet-list]');

  let ep = firstEp;
  let sources = [];
  let srcIndex = 0;
  let lastSave = 0;
  let seeking = false;
  let countdown = null;
  let blobUrls = [];
  let rate = 1;

  const idx = () => s.episodios.indexOf(ep);
  const prevEp = () => s.episodios[idx() - 1];
  const nextEp = () => s.episodios[idx() + 1];

  /* ---------- Guardar avance ---------- */
  function save(force = false) {
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const now = Date.now();
    if (!force && now - lastSave < SAVE_EVERY_MS) return;
    lastSave = now;
    setProgress(s.id, ep.numero, video.currentTime, d);
  }

  /* ---------- Interfaz ---------- */
  function renderFav() {
    const on = isFav(s.id);
    favBtn.innerHTML = icons.heart(on);
    favBtn.setAttribute('aria-pressed', on);
    favBtn.setAttribute('aria-label', on ? 'Quitar de favoritos' : 'Agregar a favoritos');
  }

  function renderPlay() {
    const playing = !video.paused && !video.ended;
    playBtn.innerHTML = playing ? `<span style="color:#121212">${icons.pause(30)}</span>` : icons.play(30, '#121212');
    playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  }

  function renderTimes() {
    const d = video.duration;
    if (Number.isFinite(d)) {
      seek.max = Math.floor(d);
      $('[data-dur]').textContent = fmtTime(d);
    }
    if (!seeking) seek.value = Math.floor(video.currentTime);
    $('[data-cur]').textContent = fmtTime(seeking ? +seek.value : video.currentTime);
    const pct = seek.max > 0 ? (seek.value / seek.max) * 100 : 0;
    seek.style.setProperty('--pct', `${pct}%`);
  }

  function renderHead() {
    const lic = s.licencia;
    $('[data-title]').textContent = ep.titulo;
    $('[data-sub]').textContent = s.tipo === 'serie' ? `Episodio ${ep.numero} · ${lic}` : `${s.anio || ''} · ${lic}`.replace(/^ · /, '');
    $('[data-prev]').disabled = !prevEp();
    $('[data-next]').disabled = !nextEp();
    $('[data-list]').hidden = s.episodios.length < 2;
    renderEpisodeList();
  }

  function renderEpisodeList() {
    $('[data-eps]').innerHTML = s.episodios
      .map((e) => {
        const p = getProgress(s.id, e.numero);
        const estado = e === ep ? 'Reproduciendo' : p?.visto ? 'Visto' : p && p.t > 10 ? `Visto hasta ${fmtTime(p.t)}` : fmtTime(e.duracion_seg);
        return `<li><button type="button" data-goto="${e.numero}" ${e === ep ? 'aria-current="true"' : ''}>
          <span class="sheet__n">${e.numero}</span>
          <span><span class="sheet__t">${esc(e.titulo)}</span><br><span class="sheet__s">${esc(estado)}</span></span>
        </button></li>`;
      })
      .join('');
  }

  function showError(msg) {
    spinner.hidden = true;
    const n = nextEp();
    errBox.innerHTML = `<p>${esc(msg)}</p><div>
      <button type="button" class="btn" data-retry>Reintentar</button>
      ${n ? `<button type="button" class="btn btn--ghost" data-skip>Siguiente</button>` : ''}
    </div>`;
    errBox.hidden = false;
    errBox.querySelector('[data-retry]').addEventListener('click', () => loadEpisode(ep, { autoplay: true }));
    errBox.querySelector('[data-skip]')?.addEventListener('click', () => loadEpisode(n, { autoplay: true }));
  }

  /* ---------- Subtítulos ---------- */
  function clearTracks() {
    video.querySelectorAll('track').forEach((t) => t.remove());
    blobUrls.forEach((u) => URL.revokeObjectURL(u));
    blobUrls = [];
  }

  async function loadSubtitles(forEp) {
    const subs = forEp.subtitulos || [];
    ccBtn.disabled = !subs.length;
    ccBtn.textContent = subs.length ? (subs[0].idioma || 'cc').slice(0, 2).toUpperCase() : 'CC';
    ccBtn.setAttribute('aria-label', subs.length ? `Subtítulos: ${subs[0].etiqueta || subs[0].idioma}` : 'Sin subtítulos');
    ccBtn.setAttribute('aria-pressed', 'false');
    for (const [i, sub] of subs.entries()) {
      try {
        const url = await subtitleBlobUrl(sub.url);
        if (forEp !== ep) return URL.revokeObjectURL(url); // ya cambió de episodio
        blobUrls.push(url);
        const tr = document.createElement('track');
        Object.assign(tr, { kind: 'subtitles', srclang: sub.idioma, label: sub.etiqueta || sub.idioma, src: url });
        video.appendChild(tr);
        if (i === 0) setCaptions(subtitlesOn());
      } catch (err) {
        console.warn('[subtítulos]', sub.url, err);
        if (i === 0) {
          ccBtn.disabled = true;
          ccBtn.setAttribute('aria-label', 'Subtítulos no disponibles');
        }
      }
    }
  }

  const subtitlesOn = () => sessionStorage.getItem('libreto:cc') !== '0';
  function setCaptions(on) {
    const tracks = [...video.textTracks];
    tracks.forEach((t, i) => (t.mode = on && i === 0 ? 'showing' : 'hidden'));
    ccBtn.setAttribute('aria-pressed', String(on && tracks.length > 0));
  }

  /* ---------- Cargar episodio ---------- */
  function loadEpisode(next, { autoplay = true } = {}) {
    if (ep !== next) save(true);
    cancelUpNext();
    ep = next;
    history.replaceState(null, '', `#/ver/${encodeURIComponent(s.id)}/${ep.numero}`);
    errBox.hidden = true;
    spinner.hidden = false;
    renderHead();
    renderFav();

    sources = [ep.video, ep.video_alt].map(safeUrl).filter(Boolean);
    srcIndex = 0;
    clearTracks();
    if (!sources.length) return showError('Este episodio no tiene un enlace de video válido.');
    video.src = sources[0];
    video.playbackRate = rate;

    // Retomar donde quedó (si faltan más de 10 s y va por menos del 95 %).
    const p = getProgress(s.id, ep.numero);
    video.addEventListener(
      'loadedmetadata',
      () => {
        const d = video.duration;
        if (p && p.t > 10 && Number.isFinite(d) && p.t / d < 0.95 && d - p.t > 10) video.currentTime = p.t;
        video.playbackRate = rate;
        renderTimes();
      },
      { once: true }
    );
    loadSubtitles(ep);
    if (autoplay) video.play().catch(() => renderPlay());
  }

  /* ---------- Siguiente episodio ---------- */
  function cancelUpNext() {
    if (countdown) clearInterval(countdown);
    countdown = null;
    upnext.hidden = true;
  }

  function startUpNext() {
    const n = nextEp();
    if (!n) return;
    let left = NEXT_DELAY_S;
    const txt = $('[data-upnext-text]');
    const paint = () => (txt.textContent = `Siguiente: Ep. ${n.numero} · ${n.titulo}, en ${left} s`);
    paint();
    upnext.hidden = false;
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) loadEpisode(n, { autoplay: true });
      else paint();
    }, 1000);
  }

  /* ---------- Eventos del video ---------- */
  const on = (el, type, fn, opts) => {
    el.addEventListener(type, fn, opts);
    offs.push(() => el.removeEventListener(type, fn, opts));
  };
  const offs = [];

  on(video, 'play', renderPlay);
  on(video, 'pause', () => {
    renderPlay();
    save(true);
  });
  on(video, 'playing', () => (spinner.hidden = true));
  on(video, 'waiting', () => (spinner.hidden = false));
  on(video, 'canplay', () => (spinner.hidden = true));
  on(video, 'timeupdate', () => {
    renderTimes();
    save();
  });
  on(video, 'durationchange', renderTimes);
  on(video, 'ended', () => {
    setProgress(s.id, ep.numero, video.duration, video.duration);
    renderPlay();
    renderEpisodeList();
    startUpNext();
  });
  on(video, 'error', () => {
    // Probar el siguiente formato (p. ej. H.264 si WebM no funciona).
    if (srcIndex < sources.length - 1) {
      const t = video.currentTime;
      video.src = sources[++srcIndex];
      video.addEventListener('loadedmetadata', () => t && (video.currentTime = t), { once: true });
      video.play().catch(() => {});
      return;
    }
    showError('No se pudo cargar el video. Puede que el enlace esté caído o que tu conexión haya fallado.');
  });

  /* ---------- Controles ---------- */
  const toggle = () => {
    if (video.paused || video.ended) {
      cancelUpNext();
      video.play().catch(() => {});
    } else video.pause();
  };
  on(playBtn, 'click', toggle);
  on($('[data-tap]'), 'click', toggle);
  on($('[data-prev]'), 'click', () => prevEp() && loadEpisode(prevEp()));
  on($('[data-next]'), 'click', () => nextEp() && loadEpisode(nextEp()));
  on($('[data-upnext-cancel]'), 'click', cancelUpNext);
  on(favBtn, 'click', () => {
    toggleFav(s.id);
    renderFav();
  });
  on(ccBtn, 'click', () => {
    const turnOn = ccBtn.getAttribute('aria-pressed') !== 'true';
    sessionStorage.setItem('libreto:cc', turnOn ? '1' : '0');
    setCaptions(turnOn);
  });
  on(seek, 'input', () => {
    seeking = true;
    renderTimes();
  });
  on(seek, 'change', () => {
    video.currentTime = +seek.value;
    seeking = false;
    save(true);
  });
  on($('[data-full]'), 'click', () => {
    const stage = $('.player__stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.(); // iPhone
  });

  // Hojas: velocidad y lista de episodios (<dialog> nativo, accesible).
  const openSheet = (d) => (d.showModal ? d.showModal() : d.setAttribute('open', ''));
  on($('[data-speed]'), 'click', () => {
    sheetSpeed.querySelectorAll('[data-rate]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.rate === rate)));
    openSheet(sheetSpeed);
  });
  on($('[data-list]'), 'click', () => {
    renderEpisodeList();
    openSheet(sheetList);
  });
  view.querySelectorAll('[data-close]').forEach((b) => on(b, 'click', () => b.closest('dialog').close()));
  [sheetSpeed, sheetList].forEach((d) => on(d, 'click', (e) => e.target === d && d.close())); // tocar fuera cierra
  on(sheetSpeed, 'click', (e) => {
    const b = e.target.closest('[data-rate]');
    if (!b) return;
    rate = +b.dataset.rate;
    video.playbackRate = rate;
    sheetSpeed.close();
  });
  on(sheetList, 'click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    sheetList.close();
    const target = s.episodios.find((x) => String(x.numero) === b.dataset.goto);
    if (target && target !== ep) loadEpisode(target);
  });

  // Teclado (solo mientras el reproductor está abierto).
  on(document, 'keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'k') {
      if (e.target.closest('button, a')) return;
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') video.currentTime += 10;
    else if (e.key === 'ArrowLeft') video.currentTime -= 10;
    else if (e.key === 'c' && !ccBtn.disabled) ccBtn.click();
  });

  // Guardar al salir o al ocultar la app.
  on(window, 'pagehide', () => save(true));
  on(document, 'visibilitychange', () => document.visibilityState === 'hidden' && save(true));

  // Controles de la pantalla de bloqueo (Media Session).
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => nextEp() && loadEpisode(nextEp()));
      navigator.mediaSession.setActionHandler('previoustrack', () => prevEp() && loadEpisode(prevEp()));
    } catch {
      /* no soportado */
    }
  }
  const setMeta = () => {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    const art = safeUrl(s.portada);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ep.titulo,
      artist: s.titulo,
      artwork: art ? [{ src: art }] : [],
    });
  };
  on(video, 'loadedmetadata', setMeta);

  loadEpisode(firstEp, { autoplay: true });

  // Limpieza al salir de la pantalla.
  return () => {
    save(true);
    cancelUpNext();
    offs.forEach((off) => off());
    video.pause();
    video.removeAttribute('src');
    video.load();
    clearTracks();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      } catch {}
    }
  };
}


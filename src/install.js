// Instalación como app (PWA): registro del service worker y aviso para instalar.
import { pref, setPref } from './storage.js';

let deferredPrompt = null; // evento de Chrome/Android para mostrar "Instalar"
const listeners = new Set();

export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setPref('instalar-oculto', '1');
    listeners.forEach((fn) => fn());
  });

  // Solo en la versión compilada: en desarrollo la caché estorbaría.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => console.warn('[sw]', err));
    });
  }
}

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return false;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1); // iPadOS
};

const shareIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Compartir" role="img"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

/** HTML del aviso, o '' si no corresponde mostrarlo. */
function cardHTML() {
  if (isStandalone() || pref('instalar-oculto', '0') === '1') return '';
  const close = `<button type="button" class="install__close" data-install-close aria-label="No volver a mostrar">×</button>`;
  if (deferredPrompt) {
    return `<aside class="install" aria-label="Instalar la app">
      <img src="./icons/icon-192.png" alt="" width="40" height="40">
      <p><strong>Instala Libreto</strong><br>Ábrela desde tu pantalla de inicio, a pantalla completa.</p>
      <button type="button" class="btn install__btn" data-install>Instalar</button>${close}
    </aside>`;
  }
  if (isIOS()) {
    return `<aside class="install" aria-label="Instalar la app">
      <img src="./icons/icon-192.png" alt="" width="40" height="40">
      <p><strong>Instala Libreto en tu iPhone</strong><br>En Safari toca ${shareIcon} <em>Compartir</em> y luego <em>Agregar a inicio</em>.</p>${close}
    </aside>`;
  }
  return '';
}

/** Pinta el aviso dentro de `slot` y lo mantiene al día. */
export function mountInstallCard(slot) {
  if (!slot) return;
  const paint = () => {
    if (!slot.isConnected) return listeners.delete(paint);
    slot.innerHTML = cardHTML();
    slot.querySelector('[data-install-close]')?.addEventListener('click', () => {
      setPref('instalar-oculto', '1');
      slot.innerHTML = '';
    });
    slot.querySelector('[data-install]')?.addEventListener('click', async () => {
      const ev = deferredPrompt;
      if (!ev) return;
      deferredPrompt = null;
      ev.prompt();
      await ev.userChoice.catch(() => null);
      paint();
    });
  };
  listeners.add(paint);
  paint();
}

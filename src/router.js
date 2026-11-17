// Ruteo por hash (#/serie/sintel). Funciona en hosting estático sin
// configurar redirecciones (GitHub Pages, Netlify, Cloudflare Pages).

const routes = [];

/** Registra una ruta. El patrón usa ":param", p. ej. "/serie/:id". */
export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/\/:([a-z]+)/gi, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$'
  );
  routes.push({ re, keys, handler });
}

export const go = (path) => {
  location.hash = '#' + path;
};

export const currentPath = () => decodeURI(location.hash.slice(1)) || '/';

export function start(onChange) {
  const run = () => {
    const path = currentPath();
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) {
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        onChange(r.handler, params, path);
        return;
      }
    }
    go('/');
  };
  addEventListener('hashchange', run);
  run();
}

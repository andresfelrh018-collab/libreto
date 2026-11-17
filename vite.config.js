import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

/** Lista los archivos de public/ que van en la caché inicial (no el catálogo ni los subtítulos). */
function publicFiles(dir = 'public') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...publicFiles(p));
    else out.push(relative('public', p).split('\\').join('/'));
  }
  return out.filter((f) => !f.endsWith('catalog.json') && !f.startsWith('subs/') && !f.startsWith('.'));
}

/** Publica sw.js con la lista exacta de archivos del build y una versión única. */
function serviceWorker() {
  return {
    name: 'libreto-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['./', './index.html', ...Object.keys(bundle), ...publicFiles()]
        .filter((f) => f !== 'sw.js')
        .map((f) => (f.startsWith('./') ? f : `./${f}`));
      const unique = [...new Set(files)];
      const version = createHash('sha256').update(unique.join('|')).digest('hex').slice(0, 10);
      const source = readFileSync('sw.js', 'utf8')
        .replace("const VERSION = '__VERSION__';", `const VERSION = '${version}';`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(unique, null, 2)};`);
      if (source.includes("'__VERSION__'") || source.includes('= __PRECACHE__')) {
        this.error('sw.js: no se pudieron reemplazar __VERSION__ / __PRECACHE__');
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// base relativa: funciona en GitHub Pages (subcarpeta) y en Netlify/Cloudflare
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
});

// Valida public/catalog.json antes de publicar (node scripts/check-catalog.mjs).
// Falla si un título no tiene licencia/fuente, si hay ids repetidos o URLs no https.
import { readFileSync } from 'node:fs';

const cat = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'));
const errores = [];
const ids = new Set();
const REQ = ['id', 'titulo', 'tipo', 'licencia', 'url_licencia', 'fuente', 'url_fuente'];
const https = (u) => typeof u === 'string' && u.startsWith('https://');
const rel = (u) => typeof u === 'string' && !u.includes('://') && !u.startsWith('/');

for (const s of cat.series || []) {
  const n = s.id || s.titulo || '(sin id)';
  for (const k of REQ) if (!s[k]) errores.push(`${n}: falta "${k}"`);
  if (ids.has(s.id)) errores.push(`${n}: id repetido`);
  ids.add(s.id);
  if (!['serie', 'pelicula', 'corto'].includes(s.tipo)) errores.push(`${n}: tipo "${s.tipo}" no válido`);
  for (const k of ['url_licencia', 'url_fuente', 'portada']) if (s[k] && !https(s[k])) errores.push(`${n}: ${k} debe ser https`);
  if (!Array.isArray(s.episodios) || !s.episodios.length) errores.push(`${n}: sin episodios`);
  for (const e of s.episodios || []) {
    if (!https(e.video)) errores.push(`${n} ep ${e.numero}: video debe ser https`);
    if (e.video_alt && !https(e.video_alt)) errores.push(`${n} ep ${e.numero}: video_alt debe ser https`);
    for (const t of e.subtitulos || []) if (!https(t.url) && !rel(t.url)) errores.push(`${n} ep ${e.numero}: subtítulo con URL no válida`);
  }
}

if (errores.length) {
  console.error(`catalog.json tiene ${errores.length} error(es):\n- ` + errores.join('\n- '));
  process.exit(1);
}
console.log(`catalog.json OK: ${cat.series.length} títulos`);

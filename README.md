# Libreto

App web personal para ver series y películas de **dominio público** y **Creative Commons**, sin anuncios, pagos, cuentas ni rastreo. Vite + JavaScript sin framework.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/ para publicar
npm run preview  # sirve dist/ en http://localhost:4173 (con service worker)
```

## App instalable (PWA)

- `public/manifest.webmanifest`: nombre, colores e iconos.
- `sw.js` (raíz): plantilla del service worker. Al compilar, `vite.config.js` le inyecta la lista exacta de archivos y una versión; cada build nueva borra la caché anterior. Solo se registra en la versión compilada, nunca con `npm run dev`.
- Qué guarda: la interfaz (abre sin conexión), `catalog.json` y subtítulos (primero la red, luego la copia) y las fuentes. **Los videos nunca se guardan.**
- Iconos: `python3 scripts/make-icons.py public/icons` los regenera (sin dependencias).
- En el Inicio aparece un aviso para instalar: botón "Instalar" en Android/Chrome e instrucciones en iPhone (Compartir → Agregar a inicio). La "×" lo oculta para siempre.

Para instalarla en el celular hace falta HTTPS (el service worker no funciona por `http://` en la red local), así que la prueba real llega con la Fase 5.

## Agregar contenido

Edita `public/catalog.json`. Cada título **debe** tener `licencia`, `url_licencia`, `fuente` y `url_fuente`; si falta alguno, la app no lo muestra.

Campos de cada título:

| Campo | Para qué sirve |
|---|---|
| `tipo` | `serie`, `pelicula` o `corto` (filtros del inicio) |
| `idioma` | `es`, `en` o `zxx` (sin diálogos). `subtitulado: "es"` si trae subtítulos en español incrustados |
| `color` | Color de respaldo de la portada y del degradado |
| `atribucion` | Texto de atribución exigido por CC BY |
| `clasificacion` | `"+18"` muestra la insignia y pide confirmar la edad antes de reproducir. `aviso` explica por qué |
| `nota_licencia` | Por qué la obra es libre (plantilla de Commons, falta de renovación, etc.) |

Subtítulos (`subtitulos`): `.vtt` o `.srt`, por URL o como archivo en `public/subs/`. La app los descarga y los pasa al video como archivo local.

Cada episodio tiene `video` y, si existe, `video_alt` (otro formato del mismo archivo). Commons ofrece WebM VP9 y una copia H.264 (`.mpeg4.mov`) que funciona en iPhone.

### Reglas para elegir contenido

- En Internet Archive, la etiqueta de licencia la pone quien sube el archivo y **mucho contenido marcado como "dominio público" es pirata**. Acepta solo obras cuyo estado legal se pueda verificar por fuera (película sin renovación de copyright conocida, autor fallecido hace más de 70 años, etc.).
- En Commons, revisa la plantilla de licencia en la página del archivo (`PD-old-70`, `PD-US-expired`, `CC BY`, …).
- Subtítulos de Commons: `https://commons.wikimedia.org/w/api.php?action=timedtext&title=File:<archivo>&lang=es&trackformat=vtt&origin=*`
- Las licencias **NC** (no comercial) se aceptan porque la app es personal, gratuita y sin anuncios. Si algún día se cobra o se ponen anuncios, hay que retirar esos títulos.
- Verifica la licencia en la fuente original del autor: en Internet Archive, *Pioneer One* y *El Cosmonauta* tienen etiquetas distintas a la licencia real.

### Nota técnica: CORS

Internet Archive **no** envía `Access-Control-Allow-Origin`, así que el `<video>` nunca lleva `crossorigin`. Los subtítulos se descargan con `fetch` (Commons y la propia app sí permiten CORS) y se convierten en una URL `blob:` local, así que el `<track>` funciona con videos de cualquier fuente.

## Estado

- [x] Fase 0: catálogo verificado (13 títulos, 4 modernos)
- [x] Fase 1: esqueleto, ruteo, inicio y detalle
- [x] Fase 2: reproductor (velocidad, subtítulos, continuar viendo, siguiente episodio, errores, +18)
- [x] Fase 3: biblioteca (favoritos, filtros, orden, vista) y búsqueda (título, autor, género, sin tildes)
- [x] Fase 4: PWA (manifest, iconos, service worker, aviso de instalación) — falta probar en un celular real
- [ ] Fase 5: publicar

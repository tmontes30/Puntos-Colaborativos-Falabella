# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Sitio estático (GitHub Pages, sin build step) que muestra un mapa interactivo
de los "puntos colaborativos" donde Falabella recibe pedidos de sellers en
Chile. Cualquier seller puede ingresar la dirección de su bodega y ver los
puntos ordenados por distancia aproximada, con horarios, días y si el punto
acepta cualquier seller o solo el asignado.

- Repo: https://github.com/tmontes30/Puntos-Colaborativos-Falabella
- Sitio publicado: https://tmontes30.github.io/Puntos-Colaborativos-Falabella/
- Dashboard de analítica: https://tmontes30.goatcounter.com

## Comandos

```
npm install          # solo necesario para scripts/generate-data.js (dependencia: xlsx/SheetJS)
npm run generate-data # regenera data/points.json desde el Excel en source-data/
npm run serve         # sirve el sitio en http://localhost:8080 (python -m http.server)
```

No hay build step para el sitio en sí — es HTML/CSS/JS plano servido directo.
`npm install` / `generate-data` solo aplican al pipeline de datos.

## Arquitectura

**Pipeline de datos** (`scripts/generate-data.js`, se corre manualmente, no en CI):
1. Lee `source-data/*.xlsx` con SheetJS, por **posición de columna** (no por
   nombre de header) — hubo un bug real donde los headers con tildes no
   hacían match por un problema de normalización Unicode entre el archivo y
   el string literal en el código. Ver columnas fijas A–I en `COLUMNS` dentro
   del script.
2. Geocodifica cada dirección con Nominatim (OSM), 1 req/seg, cacheado en
   `data/geocode-cache.json` (se commitea, así reruns son rápidos).
3. Varias direcciones del Excel vienen con anotaciones sueltas ("Local 21",
   "N° 184", comuna duplicada al final, etc.) que confunden al geocoder —
   `cleanAddress()` intenta una versión limpia como fallback antes de
   rendirse.
4. Lo que sigue sin coordenadas se completa a mano en `data/overrides.json`
   (clave = Código del punto, ver formato ahí). Esto tiene prioridad sobre el
   geocode automático.
5. Escribe `data/points.json` — este archivo es el que consume el sitio
   directamente (`js/app.js` nunca geocodifica los puntos, solo la dirección
   de bodega que ingresa el usuario, en una sola consulta).

**Frontend** (`index.html` + `js/app.js` + `css/style.css`, vanilla JS, sin
framework, Leaflet vía CDN):
- Distancia = Haversine (línea recta), no ruta real — es intencional, para
  mantenerlo sin dependencias de una API de ruteo paga.
- Mapa: tiles claros estándar de OpenStreetMap. **Importante:** en un punto
  se probó un basemap oscuro (CARTO dark_all) para que combinara con el resto
  de la UI, pero se revirtió a pedido del usuario — el mapa oscuro dificulta
  distinguir calles/referencias. La UI (topbar, sidebar, popups, controles)
  sí queda en tema oscuro; solo el mapa se mantiene claro.
- Pines: logo de Falabella (`assets/falabella-icon.png`, fondo blanco
  opaco no transparente) vía `L.icon`, con filtro grayscale CSS para puntos
  `No Operativo`.
- Color de marca: `#AAD500` (verde, sampleado directo del logo), usado como
  variable `--brand` en `css/style.css`.
- Filtros combinables: comuna, solo operativos, solo habilitados sábado
  (`abiertoSabado()` detecta "sábado" en el texto de días de forma
  accent-insensitive, no depende de un enum fijo de valores).
- `localStorage` guarda la última dirección de bodega y la vuelve a buscar
  al cargar la página.
- Analítica: GoatCounter (gratis, sin cookies), script en `index.html` con
  el código de sitio real del dueño. Eventos custom vía `trackEvent()` en
  `app.js` — ver tabla completa en el README ("Analítica de uso"): búsquedas
  de bodega (éxito/no encontrada/error), cambios de cada filtro, y clics en
  puntos (lista o mapa). **Nunca commitear un token de API de GoatCounter al
  repo** (es público) — si se necesita para un dashboard custom, se usa solo
  del lado de quien genera el reporte, nunca embebido en el sitio.

## Convenciones de este proyecto

- Sin build step: cualquier cambio a `index.html`/`css`/`js` se refleja
  directo al recargar, tanto en local (`npm run serve`) como en GitHub Pages.
- `data/points.json`, `data/geocode-cache.json` y `data/overrides.json` se
  commitean (no están en `.gitignore`) — son el estado generado, no
  derivable en CI porque no hay CI.
- Antes de dar por buena una verificación visual/UI, probar con un navegador
  real (Playwright headless funcionó bien para esto en este proyecto) en vez
  de confiar solo en lectura de CSS — ya se encontraron dos bugs reales de
  flexbox así (mapa colapsando a 0px en mobile por `flex-basis` vs `height`).
- Al correr Playwright contra `http://localhost:8080` en este entorno,
  preferir `http://127.0.0.1:8080` — `localhost` tuvo problemas de
  resolución intermitentes. Si el sitio real usa GoatCounter, bloquear las
  requests a `gc.zgo.at` / `goatcounter.com` con `page.route(...).abort()`
  durante pruebas automatizadas para no mandar eventos sintéticos a la
  cuenta real.

## Estado actual / pendiente

- Sitio funcional y publicado, con filtros, tema oscuro (UI) + mapa claro,
  pines con logo, y analítica GoatCounter ya integrada y verificada en vivo.
- Pendiente: el dueño quiere un dashboard custom (más claro que el de
  GoatCounter) armado con la API de GoatCounter — quedó pausado esperando
  que genere un token de API de solo lectura (Settings → API en su cuenta).
  Cuando lo pase, construir el dashboard bajo demanda (no programado/cron,
  así se decidió), sin dejar el token en el repo ni en el código del sitio.

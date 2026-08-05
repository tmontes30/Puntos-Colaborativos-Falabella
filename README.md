# Mapa de Puntos Colaborativos Dropoff

Sitio estático (GitHub Pages) que muestra en un mapa interactivo los puntos
colaborativos donde Falabella recibe pedidos de sellers, y permite a
cualquier seller ingresar la dirección de su bodega para ver los puntos
ordenados por distancia aproximada.

## Cómo funciona

- `data/points.json` contiene los puntos con sus coordenadas ya
  geocodificadas. La página lo carga directamente — **no** geocodifica los
  puntos en el navegador, solo geocodifica la dirección de bodega que
  ingresa el usuario (una sola consulta, vía [Nominatim](https://nominatim.org/)).
- La distancia mostrada es en línea recta (fórmula Haversine), pensada
  como una referencia aproximada, no una distancia de ruta real.
- El mapa usa [Leaflet](https://leafletjs.com/) + tiles de OpenStreetMap,
  sin necesidad de API key.

## Actualizar los datos cuando cambie el Excel/Sheet

1. Reemplaza el archivo en `source-data/` por la versión actualizada del
   Excel (debe mantener las mismas columnas: Codigo, Punto colaborativo,
   Operación, Dirección, Comuna, Hora entrega, Referencia, Recepción, Activo).
2. Instala dependencias si es la primera vez: `npm install`
3. Corre el generador de datos:
   ```
   npm run generate-data
   ```
   Esto geocodifica cada dirección nueva (respetando el límite de 1
   solicitud/segundo de Nominatim) y escribe `data/points.json`. Las
   direcciones ya conocidas se toman del cache (`data/geocode-cache.json`),
   así que reprocesar el archivo es rápido.
4. Si el script reporta puntos sin coordenadas al final, búscalos
   manualmente (por ejemplo en Google Maps) y agrégalos a
   `data/overrides.json` con su Código:
   ```json
   { "PC099": { "lat": -33.4489, "lng": -70.6693 } }
   ```
   Luego vuelve a correr `npm run generate-data`.
5. Commitea los cambios en `data/points.json`, `data/geocode-cache.json` y
   `data/overrides.json` (si aplica) y haz push.

## Correr el sitio en local

No requiere build. Sirve la carpeta con cualquier servidor estático, por
ejemplo:

```
npm run serve
```

y abre `http://localhost:8080`.

## Analítica de uso

El sitio manda analítica a [GoatCounter](https://www.goatcounter.com/) (gratis,
sin cookies, no necesita banner de consentimiento). Dashboard:
**https://tmontes30.goatcounter.com**

Se trackean automáticamente las visitas (pageviews) más estos eventos
personalizados, útiles para medir usabilidad real:

| Evento (path)                          | Cuándo se dispara                                   |
| --------------------------------------- | ---------------------------------------------------- |
| `/event/bodega/exitosa`                 | La búsqueda de dirección de bodega encontró resultado |
| `/event/bodega/no-encontrada`           | Nominatim no encontró la dirección ingresada          |
| `/event/bodega/error`                   | Falló la consulta al servicio de geocodificación      |
| `/event/filtro/comuna/<comuna\|todas>`  | Cambio en el filtro de comuna                         |
| `/event/filtro/activos/<on\|off>`       | Toggle de "solo puntos operativos"                    |
| `/event/filtro/sabado/<on\|off>`        | Toggle de "solo habilitados los sábados"              |
| `/event/punto/<codigo>`                 | Clic en un punto (desde la lista o desde el mapa)     |

En el dashboard de GoatCounter, estos eventos aparecen listados junto a las
páginas normales (activa "Include" para ver eventos si no aparecen por
defecto). Con `/event/punto/<codigo>` puedes ver un ranking de qué puntos
colaborativos consultan más los sellers, y con los eventos de bodega puedes
medir qué tan seguido falla la búsqueda de direcciones.

Si alguna vez necesitas cambiar de cuenta/sitio, el único lugar a editar es
la etiqueta `<script data-goatcounter="...">` en `index.html`.

## Publicar en GitHub Pages

1. Crea un repositorio vacío en GitHub.
2. Desde esta carpeta:
   ```
   git remote add origin <URL-del-repo>
   git branch -M main
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages** → Source: rama `main`, carpeta `/ (root)`.
4. El sitio quedará disponible en `https://<usuario>.github.io/<repo>/`.

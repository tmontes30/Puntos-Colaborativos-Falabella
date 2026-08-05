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

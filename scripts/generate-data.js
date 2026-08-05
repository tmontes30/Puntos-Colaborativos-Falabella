/**
 * Lee source-data/*.xlsx, geocodifica cada dirección (Nominatim/OSM),
 * aplica data/overrides.json y escribe data/points.json.
 *
 * Uso: npm run generate-data
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "source-data");
const CACHE_PATH = path.join(ROOT, "data", "geocode-cache.json");
const OVERRIDES_PATH = path.join(ROOT, "data", "overrides.json");
const OUTPUT_PATH = path.join(ROOT, "data", "points.json");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "mapa-puntos-dropoff-falabella/1.0 (uso interno, contacto: tmontes30@gmail.com)";
const REQUEST_DELAY_MS = 1100; // Nominatim: max 1 req/seg

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  return JSON.parse(raw);
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function findSourceXlsx() {
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (files.length === 0) {
    throw new Error(`No se encontró ningún .xlsx en ${SOURCE_DIR}`);
  }
  return path.join(SOURCE_DIR, files[0]);
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function normalizeAddressKey(direccion, comuna) {
  return `${direccion}, ${comuna}, Chile`.trim().toLowerCase().replace(/\s+/g, " ");
}

// Columnas fijas del Excel (A..I). Se leen por posición en vez de por nombre
// de encabezado para evitar problemas de normalización Unicode con tildes.
const COLUMNS = [
  "codigo",
  "nombre",
  "dias",
  "direccion",
  "comuna",
  "horario",
  "referencia",
  "recepcion",
  "activoRaw",
];

function readRows(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1, defval: "" });

  return rawRows
    .map((cells) => {
      const record = {};
      COLUMNS.forEach((key, i) => {
        record[key] = String(cells[i] ?? "").trim();
      });
      if (!record.codigo || !record.nombre || !record.direccion) return null;

      return {
        codigo: record.codigo,
        nombre: record.nombre,
        dias: record.dias,
        direccion: record.direccion,
        comuna: record.comuna ? titleCase(record.comuna) : "",
        horario: record.horario,
        referencia: record.referencia,
        recepcion: record.recepcion,
        activo: record.activoRaw.toLowerCase() === "operativo",
      };
    })
    .filter(Boolean);
}

async function geocodeQuery(query) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Nominatim respondió ${res.status} para "${query}"`);
  }
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

// Varias direcciones del Excel traen anotaciones sueltas ("Local 21", "N° 184",
// la comuna repetida al final, etc.) que confunden al geocoder. Esta función
// devuelve una versión "limpia" para reintentar cuando la consulta original falla.
function cleanAddress(direccion, comuna) {
  let s = direccion;
  s = s.replace(/N[°ºo]\s*/gi, "");
  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) s = s.substring(0, commaIdx);
  s = s.replace(/\b(local|piso|m[oó]dulo|bodega)\b\s*[\wº°-]*\s*$/i, "");
  const comunaEscaped = comuna.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  s = s.replace(new RegExp(`\\.?\\s*${comunaEscaped}\\.?\\s*$`, "i"), "");
  s = s.replace(/[.,\s]+$/, "");
  return s.trim();
}

async function geocode(direccion, comuna) {
  const original = await geocodeQuery(`${direccion}, ${comuna}, Chile`);
  if (original) return original;

  const cleaned = cleanAddress(direccion, comuna);
  if (cleaned && cleaned !== direccion) {
    await sleep(REQUEST_DELAY_MS);
    const retried = await geocodeQuery(`${cleaned}, ${comuna}, Chile`);
    if (retried) return retried;
  }
  return null;
}

async function main() {
  const xlsxPath = findSourceXlsx();
  console.log(`Leyendo ${xlsxPath}...`);
  const rows = readRows(xlsxPath);
  console.log(`${rows.length} puntos encontrados en el Excel.`);

  const cache = loadJson(CACHE_PATH, {});
  const overrides = loadJson(OVERRIDES_PATH, {});

  const points = [];
  const unresolved = [];

  for (const row of rows) {
    const key = normalizeAddressKey(row.direccion, row.comuna);
    let coords = null;

    if (overrides[row.codigo]) {
      coords = overrides[row.codigo];
    } else if (cache[key]) {
      coords = cache[key];
    } else {
      try {
        coords = await geocode(row.direccion, row.comuna);
      } catch (err) {
        console.warn(`  ! Error geocodificando ${row.codigo}: ${err.message}`);
      }
      cache[key] = coords;
      await sleep(REQUEST_DELAY_MS);
    }

    if (!coords) {
      unresolved.push(row.codigo);
    }

    points.push({
      ...row,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
    });
  }

  saveJson(CACHE_PATH, cache);
  saveJson(OUTPUT_PATH, points);

  console.log(`\nListo. Escrito ${points.length} puntos en ${OUTPUT_PATH}`);
  if (unresolved.length) {
    console.warn(
      `\n${unresolved.length} punto(s) sin coordenadas. Agrega una entrada en data/overrides.json con el Código y {"lat":..., "lng":...} y vuelve a correr el script:\n  ${unresolved.join(", ")}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

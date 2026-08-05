(function () {
  "use strict";

  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const BODEGA_STORAGE_KEY = "mapaPuntosDropoff.bodegaAddress";
  const SANTIAGO_CENTER = [-33.4489, -70.6693];

  const state = {
    points: [],
    bodega: null, // { lat, lng, label }
    markers: new Map(), // codigo -> Leaflet marker
    filters: { comuna: "", soloActivos: true },
  };

  const map = L.map("map").setView(SANTIAGO_CENTER, 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
  }).addTo(map);

  let bodegaMarker = null;

  const listEl = document.getElementById("points-list");
  const countEl = document.getElementById("points-count");
  const comunaSelect = document.getElementById("filter-comuna");
  const activosCheckbox = document.getElementById("filter-activos");
  const bodegaForm = document.getElementById("bodega-form");
  const bodegaInput = document.getElementById("bodega-input");
  const bodegaSubmit = document.getElementById("bodega-submit");
  const bodegaStatus = document.getElementById("bodega-status");
  const itemTemplate = document.getElementById("point-item-template");

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function setStatus(message, kind) {
    bodegaStatus.hidden = !message;
    bodegaStatus.textContent = message || "";
    bodegaStatus.className = "bodega-status" + (kind ? " " + kind : "");
  }

  function popupHtml(point) {
    const esRestringido = /solo seller/i.test(point.recepcion);
    return `
      <div class="popup-title">${escapeHtml(point.nombre)}</div>
      <div class="popup-row"><strong>Código:</strong> ${escapeHtml(point.codigo)}</div>
      <div class="popup-row"><strong>Dirección:</strong> ${escapeHtml(point.direccion)}, ${escapeHtml(point.comuna)}</div>
      ${point.referencia ? `<div class="popup-row"><strong>Referencia:</strong> ${escapeHtml(point.referencia)}</div>` : ""}
      <div class="popup-row"><strong>Días:</strong> ${escapeHtml(point.dias || "-")}</div>
      <div class="popup-row"><strong>Horario:</strong> ${escapeHtml(point.horario || "-")}</div>
      <div class="popup-row ${esRestringido ? "popup-recepcion-restringida" : "popup-recepcion-abierta"}">
        ${escapeHtml(point.recepcion || "-")}
      </div>
      ${!point.activo ? `<div class="popup-row popup-recepcion-restringida">Punto no operativo actualmente</div>` : ""}
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  const pointIcon = L.icon({
    iconUrl: "assets/falabella-icon.png",
    iconSize: [28, 29],
    iconAnchor: [14, 29],
    popupAnchor: [0, -26],
    className: "point-marker-icon",
  });

  const pointIconInactive = L.icon({
    iconUrl: "assets/falabella-icon.png",
    iconSize: [28, 29],
    iconAnchor: [14, 29],
    popupAnchor: [0, -26],
    className: "point-marker-icon point-marker-icon--inactive",
  });

  function buildMarkers() {
    state.points.forEach((point) => {
      if (point.lat == null || point.lng == null) return;
      const marker = L.marker([point.lat, point.lng], {
        icon: point.activo ? pointIcon : pointIconInactive,
      }).addTo(map);
      marker.bindPopup(popupHtml(point));
      state.markers.set(point.codigo, marker);
    });
  }

  function populateComunaFilter() {
    const comunas = Array.from(new Set(state.points.map((p) => p.comuna).filter(Boolean))).sort();
    comunas.forEach((comuna) => {
      const opt = document.createElement("option");
      opt.value = comuna;
      opt.textContent = comuna;
      comunaSelect.appendChild(opt);
    });
  }

  function getFilteredPoints() {
    return state.points.filter((p) => {
      if (state.filters.soloActivos && !p.activo) return false;
      if (state.filters.comuna && p.comuna !== state.filters.comuna) return false;
      return true;
    });
  }

  function renderList() {
    let points = getFilteredPoints();

    if (state.bodega) {
      points = points
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          ...p,
          distanciaKm: haversineKm(state.bodega.lat, state.bodega.lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
    }

    listEl.innerHTML = "";
    countEl.textContent = `${points.length} punto${points.length === 1 ? "" : "s"}`;

    points.forEach((point) => {
      const li = itemTemplate.content.firstElementChild.cloneNode(true);
      li.classList.toggle("is-inactive", !point.activo);
      li.querySelector(".point-item__nombre").textContent = point.nombre;
      li.querySelector(".point-item__direccion").textContent = point.direccion;
      li.querySelector(".point-item__comuna").textContent = point.comuna;
      const distEl = li.querySelector(".point-item__distancia");
      distEl.textContent = point.distanciaKm != null ? `a ${point.distanciaKm.toFixed(1)} km` : "";

      const focusPoint = () => {
        const marker = state.markers.get(point.codigo);
        if (!marker) return;
        map.setView(marker.getLatLng(), 15, { animate: true });
        marker.openPopup();
      };
      li.addEventListener("click", focusPoint);
      li.addEventListener("keypress", (e) => {
        if (e.key === "Enter") focusPoint();
      });

      listEl.appendChild(li);
    });
  }

  function applyMarkerVisibility() {
    const visibleCodigos = new Set(getFilteredPoints().map((p) => p.codigo));
    state.markers.forEach((marker, codigo) => {
      const shouldShow = visibleCodigos.has(codigo);
      const isShown = map.hasLayer(marker);
      if (shouldShow && !isShown) marker.addTo(map);
      if (!shouldShow && isShown) map.removeLayer(marker);
    });
  }

  function refresh() {
    applyMarkerVisibility();
    renderList();
  }

  async function geocodeBodega(direccion) {
    const query = `${direccion}, Chile`;
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("No se pudo consultar el servicio de geocodificación.");
    const results = await res.json();
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), label: results[0].display_name };
  }

  function setBodega(coords, address) {
    state.bodega = coords;
    if (bodegaMarker) map.removeLayer(bodegaMarker);
    bodegaMarker = L.marker([coords.lat, coords.lng], {
      icon: L.divIcon({
        className: "",
        html: '<div style="background:#1d4ed8;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>Tu bodega</strong><br>${escapeHtml(address)}`);

    localStorage.setItem(BODEGA_STORAGE_KEY, address);
    refresh();
    map.setView([coords.lat, coords.lng], 12);
  }

  bodegaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = bodegaInput.value.trim();
    if (!address) return;

    bodegaSubmit.disabled = true;
    setStatus("Buscando dirección...", "");
    try {
      const coords = await geocodeBodega(address);
      if (!coords) {
        setStatus("No pudimos encontrar esa dirección. Intenta agregar comuna o revisa la ortografía.", "error");
        return;
      }
      setBodega(coords, address);
      setStatus(`Bodega ubicada. Mostrando distancias desde: ${address}`, "success");
    } catch (err) {
      setStatus("Ocurrió un error al buscar la dirección. Intenta nuevamente en unos segundos.", "error");
    } finally {
      bodegaSubmit.disabled = false;
    }
  });

  comunaSelect.addEventListener("change", () => {
    state.filters.comuna = comunaSelect.value;
    refresh();
  });

  activosCheckbox.addEventListener("change", () => {
    state.filters.soloActivos = activosCheckbox.checked;
    refresh();
  });

  async function init() {
    const res = await fetch("data/points.json");
    state.points = await res.json();

    buildMarkers();
    populateComunaFilter();
    refresh();

    const savedAddress = localStorage.getItem(BODEGA_STORAGE_KEY);
    if (savedAddress) {
      bodegaInput.value = savedAddress;
      bodegaForm.requestSubmit();
    }
  }

  init();
})();

/* ============================================================
   TOMORROW — Map view
   Leaflet dark tactical map · predicted-crime heatmap ·
   risk rings · station markers · hotspot markers · radar sweep
   ============================================================ */

window.TomorrowMap = (function () {

  const State = window.TomorrowState;
  let map;
  let heatLayer = null;
  const hotspotRefs = {};   // id -> { marker, ring }
  const stationRefs = {};
  let radarEl = null;

  function init() {
    const station = TomorrowApp.getCurrentStation();
    const center = station ? [station.lat, station.lng] : CONFIG.MAP_CENTER;

    map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView(center, station ? 14 : CONFIG.MAP_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO',
      maxZoom: CONFIG.MAP_MAX_ZOOM, subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    placeStations();
    renderHotspots();
    buildRadarSweep();

    TomorrowApp.register('map', { onStationChange });

    // expose for dispatch overlay
    if (window.TomorrowDispatch) TomorrowDispatch.setMap(map);
  }

  function getMap() { return map; }

  // ---------- Stations ----------
  function placeStations() {
    Object.values(stationRefs).forEach(m => map.removeLayer(m));
    CONFIG.STATIONS.forEach(s => {
      const icon = L.divIcon({
        html: `<div class="station-marker">
                 <div class="st-ring"></div>
                 <div class="st-core"><i data-lucide="shield"></i></div>
               </div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18]
      });
      const m = L.marker([s.lat, s.lng], { icon, zIndexOffset: 200 }).addTo(map);
      m.bindPopup(`
        <div class="tac-popup" dir="rtl" style="--rc:#2b8fff">
          <div class="tp-code">POLICE STATION · תחנת משטרה</div>
          <div class="tp-name" style="color:#2b8fff"><i data-lucide="shield"></i><span>${s.name}</span></div>
          <div class="tp-zone"><i data-lucide="map-pin"></i><span>${s.region}</span></div>
          <div class="tp-row">
            <span class="tp-window"><i data-lucide="car-front"></i>${s.cars} ניידות זמינות</span>
          </div>
        </div>`, { className: 'tac-popup-wrap' });
      m.on('popupopen', () => TomorrowApp.renderIcons());
      stationRefs[s.id] = m;
    });
    TomorrowApp.renderIcons();
  }

  // ---------- Hotspots + heatmap ----------
  function makeHotspotMarker(h) {
    const r = CONFIG.RISK[h.risk];
    const ringRadius = 90 + (100 - h.probability) * 4; // higher prob → tighter ring
    const ring = L.circle([h.lat, h.lng], {
      radius: ringRadius,
      color: r.color, fillColor: r.color,
      fillOpacity: 0.10, weight: 1.5, opacity: 0.6,
      dashArray: '4,6', interactive: false,
      className: `risk-ring risk-${h.risk}`
    }).addTo(map);

    const pulse = h.risk <= 2 ? '<div class="hs-pulse"></div><div class="hs-pulse"></div>' : '';
    const icon = L.divIcon({
      html: `<div class="hotspot-marker risk-${h.risk} ${h.dispatched ? 'dispatched' : ''}" style="--rc:${r.color};--rg:${r.glow}">
               ${pulse}
               <div class="hs-core"><i data-lucide="${h.glyph}"></i></div>
               <div class="hs-prob">${h.probability}<span>%</span></div>
             </div>`,
      className: '', iconSize: [44, 44], iconAnchor: [22, 22]
    });
    const m = L.marker([h.lat, h.lng], { icon, zIndexOffset: 400 }).addTo(map);
    m.bindPopup(popupHtml(h), { className: 'tac-popup-wrap' });
    m.on('popupopen', () => TomorrowApp.renderIcons());

    hotspotRefs[h.id] = { marker: m, ring };
  }

  function popupHtml(h) {
    const r = CONFIG.RISK[h.risk];
    return `
      <div class="tac-popup risk-${h.risk}" dir="rtl" style="--rc:${r.color}">
        <div class="tp-code">${h.code} · FORECAST #${h.id}</div>
        <div class="tp-name"><i data-lucide="${h.glyph}"></i><span>${h.crime_name}</span></div>
        <div class="tp-zone"><i data-lucide="map-pin"></i><span>${h.zone}</span></div>
        <div class="tp-row">
          <span class="tp-window"><i data-lucide="clock"></i>${h.window}</span>
          <span class="risk-chip">סיכון ${r.label}</span>
        </div>
        <div class="tp-readout">
          <span class="tp-prob"><b>${h.probability}</b><i>%</i></span>
          <span class="tp-prob-lbl">סבירות מודל</span>
        </div>
        <div class="fc-gauge"><div class="fc-gauge-fill" style="width:${h.probability}%"></div></div>
        ${h.factors.length ? `<div class="tp-factors">${h.factors.map(f => `<span class="factor">${f}</span>`).join('')}</div>` : ''}
        <button class="tp-dispatch" onclick="TomorrowDispatch.dispatchToHotspot(TomorrowState.forecast.find(x=>x.id===${h.id}))">
          <i data-lucide="navigation"></i><span>הזנק ניידת ליעד</span>
        </button>
      </div>`;
  }

  function clearHotspots() {
    Object.values(hotspotRefs).forEach(({ marker, ring }) => {
      map.removeLayer(marker); map.removeLayer(ring);
    });
    for (const k in hotspotRefs) delete hotspotRefs[k];
  }

  function renderHeat(items) {
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (!L.heatLayer) return; // plugin optional
    const pts = items.map(h => [h.lat, h.lng, h.probability / 100]);
    heatLayer = L.heatLayer(pts, {
      radius: 38, blur: 28, maxZoom: 17, minOpacity: 0.25,
      gradient: { 0.0: '#1a6dff', 0.4: '#38e08a', 0.6: '#ffd000', 0.8: '#ff7a18', 1.0: '#ff1f4b' }
    }).addTo(map);
  }

  function renderHotspots() {
    if (!map) return;
    clearHotspots();
    const items = TomorrowPrediction.getVisibleForecast();
    renderHeat(items);
    items.forEach(makeHotspotMarker);
    TomorrowApp.renderIcons();
  }

  function focusHotspot(h) {
    if (!map) return;
    map.flyTo([h.lat, h.lng], 16, { duration: 1 });
    const ref = hotspotRefs[h.id];
    if (ref) ref.marker.openPopup();
  }

  function markDispatched(h) {
    const ref = hotspotRefs[h.id];
    if (ref) {
      const el = ref.marker.getElement()?.querySelector('.hotspot-marker');
      if (el) el.classList.add('dispatched');
    }
  }

  // ---------- Radar sweep overlay (cosmetic SWAT HUD) ----------
  function buildRadarSweep() {
    const wrap = document.getElementById('map').parentElement;
    if (!wrap) return;
    radarEl = document.createElement('div');
    radarEl.className = 'radar-sweep';
    radarEl.innerHTML = '<div class="radar-arm"></div>';
    wrap.appendChild(radarEl);
  }

  function onStationChange() {
    placeStations();
    const station = TomorrowApp.getCurrentStation();
    if (station) map.flyTo([station.lat, station.lng], 14, { duration: 0.8 });
    else map.flyTo(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM, { duration: 0.8 });
    renderHotspots();
  }

  return {
    init, getMap, renderHotspots, focusHotspot, markDispatched,
    placeStations, onStationChange
  };
})();

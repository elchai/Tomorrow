/* ============================================================
   TOMORROW — Map view
   Leaflet dark tactical map · predicted-crime heatmap ·
   risk rings · station markers · hotspot markers
   ============================================================ */

window.TomorrowMap = (function () {

  const State = window.TomorrowState;
  let map;
  let heatLayer = null;
  const hotspotRefs = {};   // id -> { marker, ring }
  const stationRefs = {};

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
    
    // Snapping lat/lng to 150m tactical grid cells
    const cellSizeLat = 0.0014;
    const cellSizeLng = 0.0016;
    const cellLat = Math.floor(h.lat / cellSizeLat) * cellSizeLat;
    const cellLng = Math.floor(h.lng / cellSizeLng) * cellSizeLng;

    const bounds = [
      [cellLat, cellLng],
      [cellLat + cellSizeLat, cellLng + cellSizeLng]
    ];

    const rect = L.rectangle(bounds, {
      color: r.color,
      fillColor: r.color,
      fillOpacity: h.dispatched ? 0.04 : 0.18,
      weight: 1.5,
      opacity: h.dispatched ? 0.3 : 0.85,
      className: `rtm-grid-cell risk-${h.risk}`
    }).addTo(map);

    // DivIcon center marker for the cell data
    const centerLat = cellLat + cellSizeLat / 2;
    const centerLng = cellLng + cellSizeLng / 2;

    const pulse = h.risk <= 2 && !h.dispatched ? '<div class="hs-pulse" style="width:24px; height:24px;"></div>' : '';
    const icon = L.divIcon({
      html: `<div class="hotspot-marker risk-${h.risk} ${h.dispatched ? 'dispatched' : ''}" style="--rc:${r.color};--rg:${r.glow}; width:32px; height:32px;">
               ${pulse}
               <div class="hs-core" style="width:22px; height:22px; border-width:1px;"><i data-lucide="${h.glyph}" style="width:12px; height:12px;"></i></div>
               <div class="hs-prob" style="font-size:9.5px; bottom:-9px;">${h.probability}<span>%</span></div>
             </div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    const m = L.marker([centerLat, centerLng], { icon, zIndexOffset: 400 }).addTo(map);
    m.bindPopup(popupHtml(h), { className: 'tac-popup-wrap' });
    m.on('popupopen', () => TomorrowApp.renderIcons());

    // Bind click on the cell bounds to open the popup too
    rect.on('click', () => m.openPopup());

    hotspotRefs[h.id] = { marker: m, ring: rect };
  }

  function popupHtml(h) {
    const r = CONFIG.RISK[h.risk];
    
    // Structured risk factors analysis (Explainable AI - XAI)
    const baseW = Math.round(CONFIG.FACTORS.base * 20);
    const fitW = h.factors.includes('שעת שיא לעבירה') ? CONFIG.FACTORS.fit : 5;
    const histW = CONFIG.FACTORS.hist;
    const osintW = h.osint ? CONFIG.FACTORS.osint : 0;
    
    let lightingW = h.factors.includes('אזור תאורה ציבורית לקויה') ? 16 : 0;
    let barsW = h.factors.includes('קרבה למוקדי חיכוך / חיי לילה') ? 14 : 0;
    let atmsW = h.factors.includes('קרבה לכספומט / מוקד פיננסי') ? 12 : 0;
    
    const rtmSum = lightingW + barsW + atmsW;

    return `
      <div class="tac-popup risk-${h.risk}" dir="rtl" style="--rc:${r.color}; min-width: 270px; padding: 12px 14px;">
        <div class="tp-code">CELL INDEX · תא סיכון #${h.id}</div>
        <div class="tp-name"><i data-lucide="${h.glyph}"></i><span>תחזית: ${h.crime_name}</span></div>
        <div class="tp-zone"><i data-lucide="map-pin"></i><span>מיקום: ${h.zone}</span></div>
        <div class="tp-row" style="margin-top: 8px; border-bottom: 1px dashed var(--line-soft); padding-bottom: 8px;">
          <span class="tp-window"><i data-lucide="clock"></i>${h.window}</span>
          <span class="risk-chip">רמת סיכון: ${r.label}</span>
        </div>
        
        <!-- Explainable AI (XAI) Risk Breakdown -->
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-dim);">
          <div style="font-weight:700; color:var(--text); margin-bottom:4px;">ניתוח הסברי סיכון (Explainable AI):</div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>משקל סטטיסטי היסטורי (Background):</span>
            <span style="font-family:var(--font-mono); color:#fff;">${baseW + histW}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>התאמה לשעת שיא יומית (Temporal):</span>
            <span style="font-family:var(--font-mono); color:#fff;">${fitW}%</span>
          </div>
          ${osintW ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:2px; color: var(--cyan);">
            <span>אימות מודיעין שטח (OSINT Fusion):</span>
            <span style="font-family:var(--font-mono); font-weight:700;">+${osintW}%</span>
          </div>` : ''}
          ${rtmSum ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:2px; color: var(--low);">
            <span>גורמי שטח מרחביים (RTM Boost):</span>
            <span style="font-family:var(--font-mono); font-weight:700;">+${rtmSum}%</span>
          </div>` : ''}
        </div>

        <div class="tp-readout" style="margin-top:12px; border-top: 1px solid var(--line-soft); padding-top:8px;">
          <span class="tp-prob"><b>${h.probability}</b><i>%</i></span>
          <span class="tp-prob-lbl">הסתברות מצרפית למשמרת</span>
        </div>
        
        <button class="tp-dispatch" onclick="TomorrowDispatch.dispatchToHotspot(TomorrowState.forecast.find(x=>x.id===${h.id}))">
          <i data-lucide="navigation"></i><span>שגר כוח סיור</span>
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

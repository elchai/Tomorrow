/* ============================================================
   TOMORROW — Contextual GIS Risk Layers (RTM - Risk Terrain Modeling)
   Defines tactical background layers showing environmental risk
   multipliers: Nightlife Hubs, Bank ATMs, and Poor Street Lighting.
   These layers render on the Leaflet map and impact the prediction formulas.
   ============================================================ */

window.TomorrowLayers = (function () {

  let map = null;
  const layerGroups = {
    bars: null,
    atms: null,
    dark: null
  };

  // Active status of each layer (true = visible and factored into prediction)
  const activeStatus = {
    bars: true,
    atms: false,
    dark: true
  };

  // 1. Bars & Nightlife Hubs (מוקדי חיכוך / חיי לילה)
  const BARS_DATA = [
    { name: 'אלנבי / רוטשילד', lat: 32.0640, lng: 34.7725 },
    { name: 'דיזנגוף / ירמיהו', lat: 32.0910, lng: 34.7745 },
    { name: 'פלורנטין / ידידיה פרנקל', lat: 32.0565, lng: 34.7710 },
    { name: 'נמל יפו / שוק הפשפשים', lat: 32.0520, lng: 34.7540 },
    { name: 'מתחם הרכבת / יצחק שדה', lat: 32.0620, lng: 34.7870 }
  ];

  // 2. Financial Hubs & ATMs (מוקדים פיננסיים / כספומטים)
  const ATMS_DATA = [
    { name: 'סניף בנק דיסקונט - הרצל', lat: 32.0625, lng: 34.7705 },
    { name: 'כספומט מרכז שוסטר', lat: 32.1265, lng: 34.8020 },
    { name: 'בנק הפועלים - אבן גבירול', lat: 32.0805, lng: 34.7810 },
    { name: 'מרכז מסחרי רמת אביב', lat: 32.1120, lng: 34.7930 },
    { name: 'רכבת השלום כספומט', lat: 32.0735, lng: 34.7925 }
  ];

  // 3. Dark Zones / Poor Street Lighting (תאורת רחוב לקויה / אזורים חשוכים)
  const DARK_ZONES_DATA = [
    { name: 'אזור תעשייה דרומי / שפירא', lat: 32.0495, lng: 34.7815, radius: 240 },
    { name: 'מבואות נווה שאנן מערב', lat: 32.0585, lng: 34.7770, radius: 180 },
    { name: 'פארק דרום (חלקי)', lat: 32.0440, lng: 34.7980, radius: 320 },
    { name: 'מתחם תחנה ישנה (סמטאות)', lat: 32.0550, lng: 34.7830, radius: 160 }
  ];

  function init() {
    map = window.TomorrowMap ? TomorrowMap.getMap() : null;
    if (!map) return;

    // Create Leaflet layer groups
    layerGroups.bars = L.layerGroup();
    layerGroups.atms = L.layerGroup();
    layerGroups.dark = L.layerGroup();

    // Populate layers
    buildBarsLayer();
    buildAtmsLayer();
    buildDarkZonesLayer();

    // Toggle active layers onto map
    for (const key in activeStatus) {
      if (activeStatus[key]) {
        layerGroups[key].addTo(map);
      }
    }

    // Build layers selector modal dynamically
    buildLayersControlUI();

    // Dynamically rebuild layers and modal when language changes
    document.addEventListener('tomorrow-lang-change', () => {
      if (map) {
        layerGroups.bars.clearLayers();
        layerGroups.atms.clearLayers();
        layerGroups.dark.clearLayers();
        
        buildBarsLayer();
        buildAtmsLayer();
        buildDarkZonesLayer();
        
        const oldModal = document.getElementById('layers-modal');
        if (oldModal) oldModal.remove();
        buildLayersControlUI();
      }
    });
  }

  function buildBarsLayer() {
    BARS_DATA.forEach(b => {
      const icon = L.divIcon({
        html: `<div class="rtm-marker bars" style="
          width: 20px; height: 20px; border-radius: 50%;
          background: #ffd000; border: 1.5px solid #000;
          box-shadow: 0 0 8px #ffd000; display:flex; align-items:center; justify-content:center;
          color: #000; font-size: 10px;
        "><i data-lucide="beer" style="width:11px; height:11px; stroke-width:2.5;"></i></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      const popupDir = window.TomorrowI18n ? TomorrowI18n.getMeta().dir : 'ltr';
      L.marker([b.lat, b.lng], { icon })
        .bindPopup(`<div class="tac-popup" dir="${popupDir}" style="--rc:#ffd000; min-width: 180px; padding: 8px 10px 10px;">
           <div style="font-size:9px; color:var(--text-faint); font-weight:700;">${window.T ? T('layers.popup.bars.tag') : 'GIS LAYER · Friction'}</div>
           <div style="font-size:13px; font-weight:700; color:#ffd000; margin-top:3px;"><i data-lucide="beer" style="width:13px; height:13px; margin-inline-end:4px; vertical-align:middle;"></i>${T(b.name)}</div>
           <div style="font-size:11px; color:var(--text-dim); margin-top:5px;">${window.T ? T('layers.popup.bars.desc') : ''}</div>
         </div>`, { className: 'tac-popup-wrap' })
        .on('popupopen', () => TomorrowApp.renderIcons())
        .addTo(layerGroups.bars);
    });
  }

  function buildAtmsLayer() {
    ATMS_DATA.forEach(a => {
      const icon = L.divIcon({
        html: `<div class="rtm-marker atms" style="
          width: 20px; height: 20px; border-radius: 50%;
          background: #00e5ff; border: 1.5px solid #000;
          box-shadow: 0 0 8px #00e5ff; display:flex; align-items:center; justify-content:center;
          color: #000; font-size: 10px;
        "><i data-lucide="banknote" style="width:11px; height:11px; stroke-width:2.5;"></i></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      const popupDir = window.TomorrowI18n ? TomorrowI18n.getMeta().dir : 'ltr';
      L.marker([a.lat, a.lng], { icon })
        .bindPopup(`<div class="tac-popup" dir="${popupDir}" style="--rc:#00e5ff; min-width: 180px; padding: 8px 10px 10px;">
           <div style="font-size:9px; color:var(--text-faint); font-weight:700;">${window.T ? T('layers.popup.atms.tag') : 'GIS LAYER · Financial'}</div>
           <div style="font-size:13px; font-weight:700; color:#00e5ff; margin-top:3px;"><i data-lucide="banknote" style="width:13px; height:13px; margin-inline-end:4px; vertical-align:middle;"></i>${T(a.name)}</div>
           <div style="font-size:11px; color:var(--text-dim); margin-top:5px;">${window.T ? T('layers.popup.atms.desc') : ''}</div>
         </div>`, { className: 'tac-popup-wrap' })
        .on('popupopen', () => TomorrowApp.renderIcons())
        .addTo(layerGroups.atms);
    });
  }

  function buildDarkZonesLayer() {
    DARK_ZONES_DATA.forEach(d => {
      const popupDir = window.TomorrowI18n ? TomorrowI18n.getMeta().dir : 'ltr';
      L.circle([d.lat, d.lng], {
        radius: d.radius,
        color: '#ff1f4b',
        fillColor: '#ff1f4b',
        fillOpacity: 0.05,
        weight: 1.2,
        dashArray: '3,5',
        className: 'rtm-dark-circle'
      })
      .bindPopup(`<div class="tac-popup" dir="${popupDir}" style="--rc:#ff1f4b; min-width: 180px; padding: 8px 10px 10px;">
         <div style="font-size:9px; color:var(--text-faint); font-weight:700;">${window.T ? T('layers.popup.dark.tag') : 'GIS LAYER · Dark'}</div>
         <div style="font-size:13px; font-weight:700; color:#ff1f4b; margin-top:3px;"><i data-lucide="moon" style="width:13px; height:13px; margin-inline-end:4px; vertical-align:middle;"></i>${T(d.name)}</div>
         <div style="font-size:11px; color:var(--text-dim); margin-top:5px;">${window.T ? T('layers.popup.dark.desc') : ''}</div>
       </div>`, { className: 'tac-popup-wrap' })
      .on('popupopen', () => TomorrowApp.renderIcons())
      .addTo(layerGroups.dark);
    });
  }

  function buildLayersControlUI() {
    // Inject layers button in timeline scrubber if not already done
    const timelineHead = document.querySelector('.timeline .tl-head');
    const existingSimBtn = document.getElementById('btn-sim');
    
    if (timelineHead) {
      if (existingSimBtn) {
        // Re-brand and repurpose the sim-btn into a layers toggle button
        existingSimBtn.id = 'btn-layers';
        existingSimBtn.className = 'sim-btn';
        existingSimBtn.style.cssText = 'color: var(--cyan); background: rgba(0, 229, 255, 0.08); border-color: rgba(0, 229, 255, 0.4); display: flex; align-items: center; gap: 6px; cursor:pointer;';
        existingSimBtn.innerHTML = `<i data-lucide="layers"></i><span data-i18n="layers.title">${window.TomorrowI18n ? TomorrowI18n.t('layers.title') : 'Context Layers (RTM)'}</span>`;
        
        // Remove old click handler and replace
        const newBtn = existingSimBtn.cloneNode(true);
        existingSimBtn.parentNode.replaceChild(newBtn, existingSimBtn);
        newBtn.addEventListener('click', toggleLayersModal);
      }
    }

    // Build floating layers control card
    let modal = document.getElementById('layers-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'layers-modal';
      const meta = window.TomorrowI18n ? TomorrowI18n.getMeta() : { dir: 'ltr' };
      modal.style.cssText = `
        position: absolute;
        bottom: 74px;
        left: 50%;
        transform: translateX(-50%);
        width: 280px;
        background: rgba(7, 12, 24, 0.94);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px 14px;
        z-index: 10000;
        box-shadow: 0 8px 30px rgba(0,0,0,0.6);
        display: none;
        direction: ${meta.dir};
        text-align: ${meta.dir === 'rtl' ? 'right' : 'left'};
      `;
      modal.innerHTML = `
        <div style="font-size:12px; font-weight:700; color:#fff; border-bottom:1px solid var(--line-soft); padding-bottom:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <span>${window.T ? T('layers.modalTitle') : 'Environmental information layers (RTM)'}</span>
          <button id="btn-close-layers" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" id="chk-layer-bars" ${activeStatus.bars ? 'checked' : ''} style="accent-color: var(--police);" />
            <span style="width:10px; height:10px; border-radius:50%; background:#ffd000; box-shadow: 0 0 6px #ffd000;"></span>
            <span>${window.T ? T('layers.barsLayer') : 'Friction hotspots (bars)'}</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" id="chk-layer-atms" ${activeStatus.atms ? 'checked' : ''} style="accent-color: var(--police);" />
            <span style="width:10px; height:10px; border-radius:50%; background:#00e5ff; box-shadow: 0 0 6px #00e5ff;"></span>
            <span>${window.T ? T('layers.atmsLayer') : 'Financial hotspots (ATMs)'}</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" id="chk-layer-dark" ${activeStatus.dark ? 'checked' : ''} style="accent-color: var(--police);" />
            <span style="width:10px; height:10px; border-radius:50%; background:#ff1f4b; box-shadow: 0 0 6px #ff1f4b; border:1px dashed #fff;"></span>
            <span>${window.T ? T('layers.darkLayer') : 'Poorly-lit zones (dark)'}</span>
          </label>
        </div>
      `;
      const mapWrap = document.querySelector('.map-wrap');
      if (mapWrap) mapWrap.appendChild(modal);

      // Event listeners for close
      document.getElementById('btn-close-layers').addEventListener('click', toggleLayersModal);

      // Event listeners for checkboxes
      document.getElementById('chk-layer-bars').addEventListener('change', (e) => toggleLayer('bars', e.target.checked));
      document.getElementById('chk-layer-atms').addEventListener('change', (e) => toggleLayer('atms', e.target.checked));
      document.getElementById('chk-layer-dark').addEventListener('change', (e) => toggleLayer('dark', e.target.checked));
      
      TomorrowApp.renderIcons();
    }
  }

  function toggleLayersModal() {
    const modal = document.getElementById('layers-modal');
    if (!modal) return;
    const isVisible = modal.style.display === 'block';
    modal.style.display = isVisible ? 'none' : 'block';
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
  }

  function toggleLayer(key, enable) {
    activeStatus[key] = enable;
    if (!map || !layerGroups[key]) return;

    if (enable) {
      layerGroups[key].addTo(map);
    } else {
      map.removeLayer(layerGroups[key]);
    }

    if (window.TomorrowSounds) TomorrowSounds.uiClick();

    // Trigger prediction recalculation to dynamically shift risk scores based on layer changes!
    if (window.TomorrowPrediction) {
      TomorrowPrediction.regenerate();
    }
  }

  // --- RTM Prediction Multiplier Helpers ---
  function getDistance(lat1, lng1, lat2, lng2) {
    const dLat = lat1 - lat2;
    const dLng = (lng1 - lng2) * Math.cos((lat1 + lat2) * 0.5 * Math.PI / 180);
    return Math.hypot(dLat, dLng) * 111000;
  }

  function checkRTMImpact(lat, lng, hour, crimeKey) {
    const results = {
      boost: 0,
      factors: []
    };

    // 1. Bars / Nightlife Impact (triggers only at night/evening for violent crimes & disorder)
    if (activeStatus.bars && (hour >= 20 || hour <= 4)) {
      const isViolent = ['assault', 'robbery', 'disorder', 'drugs'].includes(crimeKey);
      if (isViolent) {
        let isNear = false;
        BARS_DATA.forEach(b => {
          if (getDistance(lat, lng, b.lat, b.lng) <= 300) isNear = true;
        });
        if (isNear) {
          results.boost += 14;
          results.factors.push('barsNearby');
        }
      }
    }

    // 2. ATMs / Financial Hubs Impact (triggers for robbery and business burglary)
    if (activeStatus.atms) {
      const isTheft = ['robbery', 'theft', 'business'].includes(crimeKey);
      if (isTheft) {
        let isNear = false;
        ATMS_DATA.forEach(a => {
          if (getDistance(lat, lng, a.lat, a.lng) <= 200) isNear = true;
        });
        if (isNear) {
          results.boost += 12;
          results.factors.push('atmsNearby');
        }
      }
    }

    // 3. Dark Zones / Lighting Impact (triggers only in dark hours 22:00 - 05:00)
    if (activeStatus.dark && (hour >= 22 || hour <= 5)) {
      let isInside = false;
      DARK_ZONES_DATA.forEach(d => {
        if (getDistance(lat, lng, d.lat, d.lng) <= d.radius) isInside = true;
      });
      if (isInside) {
        results.boost += 16;
        results.factors.push('poorLighting');
      }
    }

    return results;
  }

  return { init, checkRTMImpact };
})();

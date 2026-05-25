/* ============================================================
   TOMORROW — OSINT layer (Telegram-scan findings)
   Reads classified crime "signals" from Firebase (written by the
   always-on scanner) or, until that's wired, from the bundled demo
   feed signals.sample.json. Renders them as intel markers + log
   entries, and BOOSTS the forecast risk of nearby hotspots so the
   model reacts to real-world reports. Mirrors the 443 ingestion
   pattern (scanner → Firebase → client read).
   ============================================================ */

window.TomorrowOsint = (function () {

  const State = window.TomorrowState;
  const markers = {};
  let layerVisible = true;
  let pollTimer = null;

  function map() { return window.TomorrowMap && TomorrowMap.getMap(); }

  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dφ = toRad(lat2 - lat1), dλ = toRad(lng2 - lng1);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // best URL for a signal: deep-link to the specific message if we have it, else channel.
  // Falls back to deriving `https://t.me/<handle>` from `@handle` if neither was provided.
  function bestUrl(s) {
    if (s.msg_url) return s.msg_url;
    if (s.source_url) return s.source_url;
    if (s.source && s.source.startsWith('@')) return 'https://t.me/' + s.source.slice(1);
    return null;
  }
  function srcLink(s, extraClass = '') {
    const url = bestUrl(s);
    const label = s.source || 'מקור';
    if (!url) return label;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="src-link ${extraClass}" title="פתח את ההודעה בטלגרם">${label}<i data-lucide="external-link"></i></a>`;
  }

  function timeAgo(s) {
    if (s.mins_ago != null) {
      const m = s.mins_ago;
      return m < 60 ? `לפני ${m} דק׳` : `לפני ${Math.round(m / 60)} שע׳`;
    }
    if (s.ts) {
      const m = Math.max(0, Math.round((Date.now() - new Date(s.ts).getTime()) / 60000));
      return m < 60 ? `לפני ${m} דק׳` : `לפני ${Math.round(m / 60)} שע׳`;
    }
    return 'עכשיו';
  }

  // ---------- Load ----------
  async function loadSignals() {
    const url = CONFIG.FIREBASE_URL
      ? `${CONFIG.FIREBASE_URL.replace(/\/$/, '')}/${CONFIG.SIGNALS_PATH}.json`
      : CONFIG.SIGNALS_SAMPLE;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // Firebase returns an object map; sample file wraps in {signals:[...]}
      let list = Array.isArray(data) ? data
        : data.signals ? data.signals
        : Object.values(data).filter(v => v && typeof v === 'object' && v.lat);
      State.signals = list;
      return { list, live: !!CONFIG.FIREBASE_URL };
    } catch (e) {
      console.warn('OSINT load failed:', e.message);
      State.signals = State.signals || [];
      return { list: State.signals, live: false };
    }
  }

  // ---------- Forecast boost ----------
  function applyBoost() {
    const fc = State.forecast || [];
    (State.signals || []).forEach(sig => {
      let best = null, bestD = Infinity;
      fc.forEach(h => {
        const d = distanceMeters(sig.lat, sig.lng, h.lat, h.lng);
        if (d < bestD) { bestD = d; best = h; }
      });
      if (best && bestD <= CONFIG.SIGNAL_BOOST_RADIUS_M && !best.osint) {
        best.osint = true;
        best.osint_source = sig.source;
        best.osint_url = bestUrl(sig);
        best.probability = Math.min(100, best.probability + Math.round(sig.confidence * CONFIG.FACTORS.osint));
        if (sig.risk < best.risk) best.risk = sig.risk;  // a credible report can raise severity
      }
    });
  }

  // ---------- Markers ----------
  function makeMarker(sig) {
    const m = map(); if (!m) return;
    const crime = CONFIG.crimeType(sig.crime);
    const icon = L.divIcon({
      html: `<div class="osint-marker">
               <div class="os-ping"></div>
               <div class="os-core"><i data-lucide="radio-tower"></i></div>
             </div>`,
      className: '', iconSize: [30, 30], iconAnchor: [15, 15]
    });
    const mk = L.marker([sig.lat, sig.lng], { icon, zIndexOffset: 700 }).addTo(m);
    mk.bindPopup(`
      <div class="tac-popup" dir="rtl" style="--rc:#00e5ff">
        <div class="tp-code">OSINT · ${srcLink(sig)}</div>
        <div class="tp-name" style="color:#00e5ff"><i data-lucide="radio-tower"></i><span>${crime.name}</span></div>
        <div class="tp-zone"><i data-lucide="map-pin"></i><span>${sig.zone}</span></div>
        <div class="os-text">"${sig.text_he}"</div>
        
        <!-- NLP entity extraction breakdown -->
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-dim); background: rgba(0, 229, 255, 0.03); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 4px; padding: 6px 8px; line-height: 1.45;">
          <div style="font-weight:700; color:var(--cyan); margin-bottom:4px;">עיבוד ישויות NLP גולמיות:</div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>סיווג אירוע חזוי:</span>
            <span style="font-weight:700; color:#fff;">${crime.name}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>נ״צ גאוגרפי שחולץ:</span>
            <span style="font-family:var(--font-mono); color:#fff;">${sig.lat.toFixed(4)}, ${sig.lng.toFixed(4)}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>מקור היתוך מידע:</span>
            <span style="color:#fff;">פיד מודיעין OSINT</span>
          </div>
        </div>

        <div class="tp-row" style="margin-top: 10px;">
          <span class="tp-window"><i data-lucide="clock"></i>${timeAgo(sig)}</span>
          <span class="risk-chip" style="--rc:#00e5ff">מהימנות ${Math.round(sig.confidence * 100)}%</span>
        </div>
      </div>`, { className: 'tac-popup-wrap' });
    mk.on('popupopen', () => TomorrowApp.renderIcons());
    markers[sig.id] = mk;
  }

  function clearMarkers() {
    const m = map();
    Object.values(markers).forEach(mk => m && m.removeLayer(mk));
    for (const k in markers) delete markers[k];
  }

  function renderMarkers() {
    clearMarkers();
    if (!layerVisible) return;
    (State.signals || []).forEach(makeMarker);
    TomorrowApp.renderIcons();
  }

  function updateCount() {
    const el = document.getElementById('osint-count');
    if (el) el.textContent = (State.signals || []).length;
  }

  function toggle() {
    layerVisible = !layerVisible;
    const btn = document.getElementById('btn-osint');
    if (btn) btn.classList.toggle('off', !layerVisible);
    renderMarkers();
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
  }

  // ---------- Init ----------
  async function init() {
    const { list, live } = await loadSignals();
    applyBoost();
    renderMarkers();
    updateCount();

    // surface each signal in the operational log
    list.slice(0, 8).forEach(sig => {
      const crime = CONFIG.crimeType(sig.crime);
      TomorrowApp.logEvent('osint', sig.risk, `📡 אות OSINT · ${srcLink(sig)}: ${crime.name} ב${sig.zone} (מהימנות ${Math.round(sig.confidence * 100)}%)`);
    });

    // reflect the boost in the forecast + map
    if (window.TomorrowPrediction) TomorrowPrediction.refresh();
    TomorrowApp.toast(`📡 ${list.length} אותות OSINT נטענו ${live ? '(חי · Firebase)' : '(דמו)'}`, 'info', 3500);
    TomorrowApp.register('osint', { onStationChange: renderMarkers });

    // live polling when a Firebase source is configured
    if (live && CONFIG.SIGNAL_REFRESH_MS) {
      clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        await loadSignals(); applyBoost(); renderMarkers(); updateCount();
        if (window.TomorrowPrediction) TomorrowPrediction.refresh();
      }, CONFIG.SIGNAL_REFRESH_MS);
    }
  }

  return { init, toggle, renderMarkers, loadSignals };
})();

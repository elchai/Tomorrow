/* ============================================================
   TOMORROW — Core app
   Global state · localStorage persistence · station selector ·
   clock · toast · intel log · sound effects
   ============================================================ */

window.TomorrowState = {
  current_station_id: null,   // null = all stations / district view
  forecast: [],               // predicted crime hotspots (prediction.js fills this)
  units: [],                  // patrol units
  intel_log: [],              // audit / activity feed
  forecast_hour: null,        // selected hour on the timeline (null = "now")
  active_events: ['protest_kaplan', 'summer_vacation'], // active strategic events by default
  sim: { prevented: 0, occurred: 0 },  // shift-simulation score
  settings: { demo_seconds: 11, onscene_seconds: 7 }
};

window.TomorrowApp = (function () {

  const State = window.TomorrowState;
  let saveTimer = null;

  // ---------- Persistence ----------
  // The blob is wrapped with a schema version + saved-at timestamp. On load we
  // validate both: wrong version → discard (forces fresh state on app upgrade);
  // stale forecast (> FORECAST_TTL_MS) → drop only the forecast slice so the
  // model re-rolls but station selection + settings + sim score survive.
  const SCHEMA_VERSION = 1;
  const FORECAST_TTL_MS = 60 * 60 * 1000;   // 1 hour — see P1 bug fix

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Legacy unversioned blob → discard.
      if (!parsed || typeof parsed !== 'object' || parsed.__version !== SCHEMA_VERSION) {
        console.warn('loadState: schema mismatch — starting fresh');
        return;
      }
      const payload = parsed.state || {};
      // Forecast TTL: stale forecasts hide regressions ("everything 100% covered forever")
      if (parsed.__savedAt && Date.now() - parsed.__savedAt > FORECAST_TTL_MS) {
        delete payload.forecast;          // prediction.init() will re-roll
      }
      // Whitelist known keys to defang any localStorage poisoning from sibling
      // apps that share the elchai.github.io origin (P2-6 sec).
      const allowed = ['current_station_id', 'forecast', 'units', 'intel_log',
                       'forecast_hour', 'active_events', 'sim', 'settings'];
      for (const k of allowed) {
        if (k in payload) State[k] = payload[k];
      }
    } catch (e) { console.warn('loadState failed', e); }
  }

  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const wrapped = { __version: SCHEMA_VERSION, __savedAt: Date.now(), state: State };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(wrapped));
      }
      catch (e) { console.warn('saveState failed', e); }
    }, CONFIG.SYNC_DEBOUNCE_MS);
  }

  // ---------- Station context ----------
  function getCurrentStation() {
    return State.current_station_id ? CONFIG.station(State.current_station_id) : null;
  }

  function setStation(id) {
    State.current_station_id = id || null;
    saveState();
    renderStationChips();
    broadcast('onStationChange');
  }

  // Haversine distance in km between two lat/lng pairs
  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dφ = toRad(lat2 - lat1), dλ = toRad(lng2 - lng1);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Statistical ETA (minutes) for a patrol from one coord to another.
  // Formula: base dispatch overhead + (distance / city patrol speed). See CONFIG.
  function etaMinutes(lat1, lng1, lat2, lng2) {
    const km = distanceKm(lat1, lng1, lat2, lng2);
    return Math.max(1, Math.round(CONFIG.PATROL_BASE_MIN + (km / CONFIG.PATROL_SPEED_KMH) * 60));
  }
  // Convenience: nearest-station ETA to a target point. Returns { eta, station, km }.
  function nearestEta(targetLat, targetLng, preferredStationId) {
    const st = (preferredStationId && CONFIG.station(preferredStationId)) || nearestStation(targetLat, targetLng);
    if (!st) return null;
    const km = distanceKm(st.lat, st.lng, targetLat, targetLng);
    return { eta: etaMinutes(st.lat, st.lng, targetLat, targetLng), station: st, km };
  }

  // Nearest station to a coordinate (used by dispatch)
  function nearestStation(lat, lng) {
    let best = null, bestD = Infinity;
    CONFIG.STATIONS.forEach(s => {
      const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  // ---------- Module registry / broadcast ----------
  const modules = {};
  function register(name, mod) { modules[name] = mod; }
  function broadcast(method, ...args) {
    Object.values(modules).forEach(m => { if (typeof m[method] === 'function') m[method](...args); });
  }

  // ---------- Icons (Lucide) — converts any [data-lucide] into clean line SVGs ----------
  function renderIcons() {
    if (window.lucide && lucide.createIcons) {
      try { lucide.createIcons(); } catch (e) { /* noop */ }
    }
  }

  // ---------- Clock ----------
  function startClock() {
    const el = document.getElementById('hud-clock');
    const dateEl = document.getElementById('hud-date');
    function tick() {
      const now = new Date();
      if (el) el.textContent = now.toLocaleTimeString('he-IL', { hour12: false });
      if (dateEl) dateEl.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Toast ----------
  function toast(msg, kind = 'info', ms = 3200) {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${kind}`;
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, ms);
  }

  // ---------- Intel log ----------
  function logEvent(category, urgency, text) {
    const entry = {
      time: new Date().toLocaleTimeString('he-IL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      category, urgency, text
    };
    State.intel_log.unshift(entry);
    if (State.intel_log.length > 200) State.intel_log.pop();
    renderIntelLog();
    saveState();
  }

  function renderIntelLog() {
    const list = document.getElementById('intel-feed');
    if (!list) return;
    if (State.intel_log.length === 0) {
      list.innerHTML = '<div class="empty-state">אין פעילות מתועדת</div>';
      return;
    }
    list.innerHTML = State.intel_log.slice(0, 40).map(e => `
      <div class="intel-row urgency-${e.urgency}">
        <span class="intel-time">${e.time}</span>
        <span class="intel-text">${e.text}</span>
      </div>
    `).join('');
    renderIcons();   // intel rows may embed lucide icons (e.g. external-link on OSINT source links)
  }

  // ---------- Station chips (header) ----------
  function renderStationChips() {
    const host = document.getElementById('station-chips');
    if (!host) return;
    const current = State.current_station_id;
    const chips = [{ id: null, name: 'כל המרחב' }, ...CONFIG.STATIONS];
    host.innerHTML = chips.map(s => `
      <button class="station-chip ${ (s.id || null) === current ? 'active' : '' }" data-id="${s.id || ''}">
        ${s.name}
      </button>
    `).join('');
    host.querySelectorAll('.station-chip').forEach(btn => {
      btn.addEventListener('click', () => setStation(btn.dataset.id || null));
    });
  }

  // ---------- Boot sequence ----------
  function runBoot(onDone) {
    const boot = document.getElementById('boot');
    const bar = document.getElementById('boot-bar');
    const lines = document.getElementById('boot-lines');
    const steps = [
      'אתחול רשת ניבוי וטעינת שכבות הקשר (RTM)…',
      'הרצת מודל חיזוי 24 שעות + סנכרון מודיעין…',
      'TOMORROW מקוון.'
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (lines && i < steps.length) {
        const d = document.createElement('div');
        d.className = 'boot-line';
        d.textContent = '> ' + steps[i];
        lines.appendChild(d);
      }
      if (bar) bar.style.width = `${Math.min(100, ((i + 1) / steps.length) * 100)}%`;
      i++;
      if (i > steps.length) {
        clearInterval(iv);
        if (boot) {
          boot.classList.add('done');
          setTimeout(() => { boot.style.display = 'none'; if (onDone) onDone(); }, 450);
        } else if (onDone) onDone();
      }
    }, 380);
  }

  // ---------- Threat level (district aggregate) ----------
  function updateThreatLevel() {
    const fc = (window.TomorrowPrediction && TomorrowPrediction.getVisibleForecast()) || [];
    const critical = fc.filter(h => h.risk === 1).length;
    const high = fc.filter(h => h.risk === 2).length;
    const el = document.getElementById('threat-level');
    const dot = document.getElementById('threat-dot');
    if (!el) return;
    let label, cls;
    if (critical >= 2)      { label = 'DTI: רגישות קריטית (Level 1)'; cls = 'critical'; }
    else if (critical >= 1) { label = 'DTI: רגישות גבוהה (Level 2)';  cls = 'high'; }
    else if (high >= 2)     { label = 'DTI: רגישות מוגברת (Level 3)'; cls = 'medium'; }
    else                    { label = 'DTI: רגישות רגילה (Level 4)';  cls = 'low'; }
    el.textContent = label;
    if (dot) dot.className = `threat-dot ${cls}`;
  }

  // ---------- Access gate (cosmetic — see CONFIG.ACCESS_CODE) ----------
  function showLogin(onPass) {
    const overlay = document.getElementById('login');
    if (!overlay) { onPass(); return; }
    // already authenticated this browser session → skip
    if (sessionStorage.getItem('tomorrow_auth') === '1') {
      overlay.style.display = 'none';
      onPass();
      return;
    }
    const input = document.getElementById('login-input');
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    function attempt() {
      if (window.TomorrowSounds) TomorrowSounds.uiClick();
      if (input.value.trim() === String(CONFIG.ACCESS_CODE)) {
        sessionStorage.setItem('tomorrow_auth', '1');
        if (window.TomorrowSounds) TomorrowSounds.online();
        overlay.classList.add('done');
        setTimeout(() => { overlay.style.display = 'none'; onPass(); }, 800);
      } else {
        err.textContent = 'קוד גישה שגוי // ACCESS DENIED';
        input.classList.add('error');
        input.value = '';
        setTimeout(() => { err.textContent = ''; input.classList.remove('error'); }, 2000);
      }
    }
    if (btn) btn.addEventListener('click', attempt);
    if (input) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
      setTimeout(() => input.focus(), 100);
    }
  }

  function renderStrategicEvents() {
    const list = document.getElementById('strategic-events-list');
    if (!list) return;
    
    list.innerHTML = CONFIG.STRATEGIC_EVENTS.map(ev => {
      const active = State.active_events.includes(ev.key);
      return `
        <div class="event-row ${active ? 'active' : ''}" data-key="${ev.key}" style="
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid ${active ? 'rgba(0, 229, 255, 0.3)' : 'var(--line-soft)'};
          border-radius: 6px;
          padding: 8px 10px;
          transition: all 0.2s ease;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12.5px; font-weight:700; color:${active ? '#fff' : 'var(--text-dim)'};">${ev.name}</span>
            <label class="switch" style="position:relative; display:inline-block; width:28px; height:16px;">
              <input type="checkbox" class="event-checkbox" data-key="${ev.key}" ${active ? 'checked' : ''} style="opacity:0; width:0; height:0; cursor:pointer;" />
              <span class="slider-round" style="
                position: absolute; cursor: pointer; inset: 0;
                background-color: ${active ? 'var(--cyan)' : '#4a5568'};
                transition: .2s; border-radius: 10px;
                box-shadow: ${active ? '0 0 8px var(--cyan)' : 'none'};
              ">
                <span class="slider-knob" style="
                  position: absolute; height: 10px; width: 10px;
                  left: ${active ? '15px' : '3px'}; bottom: 3px;
                  background-color: #04070f; transition: .2s; border-radius: 50%;
                "></span>
              </span>
            </label>
          </div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-top:4px; line-height:1.35;">${ev.description}</div>
        </div>
      `;
    }).join('');
    
    list.querySelectorAll('.event-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        if (e.target.checked) {
          if (!State.active_events.includes(key)) {
            State.active_events.push(key);
          }
          const ev = CONFIG.STRATEGIC_EVENTS.find(x => x.key === key);
          logEvent('system', 2, `📅 אירוע אסטרטגי הופעל: ${ev.name}`);
          toast(`📅 אירוע הופעל: ${ev.name}`, 'info');
        } else {
          State.active_events = State.active_events.filter(k => k !== key);
          const ev = CONFIG.STRATEGIC_EVENTS.find(x => x.key === key);
          logEvent('system', 3, `📅 אירוע אסטרטגי הושבת: ${ev.name}`);
          toast(`📅 אירוע הושבת: ${ev.name}`, 'info');
        }
        
        saveState();
        renderStrategicEvents();
        
        // Recalculate and update the forecast dynamically!
        if (window.TomorrowPrediction) {
          TomorrowPrediction.regenerate();
        }
      });
    });
  }

  function startSystem() {
    runBoot(() => {
      if (window.TomorrowPrediction) TomorrowPrediction.init();
      if (window.TomorrowMap) TomorrowMap.init();
      if (window.TomorrowLayers) TomorrowLayers.init();
      if (window.TomorrowDispatch) TomorrowDispatch.init();
      if (window.TomorrowAnalytics) TomorrowAnalytics.init();
      if (window.TomorrowIntel) TomorrowIntel.init();
      if (window.TomorrowLpr) TomorrowLpr.init();
      renderStrategicEvents();
      updateThreatLevel();
      renderIcons();   // convert any remaining static [data-lucide] in the HUD/timeline
      relocateActionButtonsToNavRail();
      if (window.TomorrowSounds) TomorrowSounds.online();
      logEvent('system', 4, '✅ מערכת הניבוי והיתוך המודיעין מקוונת — מודל RTM נטען בהצלחה');
      if (window.TomorrowOsint) TomorrowOsint.init();   // OSINT signals (async) — boosts forecast
    });
  }

  // Move the action buttons that modules injected into the HUD into the side nav-rail,
  // and give them a visible label. Modules don't need to know about the rail's existence.
  function relocateActionButtonsToNavRail() {
    const rail = document.getElementById('nav-rail');
    if (!rail) return;
    const map = [
      { id: 'btn-analytics', label: 'אנליטיקה' },
      { id: 'btn-intel',     label: 'מודיעין'  },
      { id: 'btn-lpr',       label: 'LPR'      }
    ];
    map.forEach(({ id, label }) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.add('nav-rail-btn');
      btn.style.marginInlineEnd = '';
      // icon-only design (FireOps-style): label kept in the `title` attribute as tooltip
      btn.title = label;
      // remove any leftover label span if it was added by a previous build
      btn.querySelector('.nav-rail-label')?.remove();
      // insert ABOVE the .nav-rail-bottom section (which holds the logout button)
      const bottom = rail.querySelector('.nav-rail-bottom');
      if (bottom) rail.insertBefore(btn, bottom); else rail.appendChild(btn);
    });
    renderIcons();   // re-run lucide on moved buttons

    // Mutual exclusion: opening one drawer closes the others.
    // Each rail button click runs the module's own toggle first (bubble);
    // afterward this delegated listener closes any other drawer that's still open,
    // and tells Leaflet to recompute its size so map tiles don't go gray.
    // Per-button mutual-exclusion listener (event delegation on rail fails because
    // lucide replaces children mid-flight and closest() can resolve to detached nodes).
    ['btn-analytics', 'btn-intel', 'btn-lpr'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        // run AFTER the module's own toggle (registered earlier) — close others
        setTimeout(() => closeOtherDrawers(id), 0);
        // after the slide-in animation completes, let Leaflet recompute its size
        setTimeout(() => window.TomorrowMap?.getMap()?.invalidateSize(), 350);
      });
    });
  }

  // Close all drawers EXCEPT the one whose trigger button id is passed (or all of them if no arg).
  function closeOtherDrawers(exceptBtnId) {
    const drawers = [
      { btn: 'btn-analytics', panel: 'analytics-panel', external: () => window.TomorrowAnalytics?.toggle?.() },
      { btn: 'btn-intel',     panel: 'intel-panel',     external: () => window.TomorrowIntel?.close?.() },
      { btn: 'btn-lpr',       panel: 'lpr-panel',       external: () => window.TomorrowLpr?.close?.() }
    ];
    drawers.forEach(({ btn, panel, external }) => {
      if (btn === exceptBtnId) return;
      const el = document.getElementById(panel);
      if (!el) return;
      const looksOpen = el.classList.contains('open')
        || (el.style.right && parseFloat(el.style.right) >= 0);  // analytics uses inline right
      if (looksOpen) external();
    });
  }

  function printPatrolOrder(hId) {
    const h = State.forecast.find(x => x.id === parseInt(hId));
    if (!h) { toast('⚠ מוקד חיזוי לא נמצא', 'warning'); return; }
    
    const r = CONFIG.RISK[h.risk];
    const station = CONFIG.station(h.station_id) || nearestStation(h.lat, h.lng);
    const dateStr = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    
    // Calculate Explainable weights
    const baseW = Math.round(CONFIG.FACTORS.base * 20);
    const fitW = h.factors.includes('שעת שיא לעבירה') ? CONFIG.FACTORS.fit : 5;
    const histW = CONFIG.FACTORS.hist;
    const osintW = h.osint ? CONFIG.FACTORS.osint : 0;
    
    let lightingW = h.factors.includes('אזור תאורה ציבורית לקויה') ? 16 : 0;
    let barsW = h.factors.includes('קרבה למוקדי חיכוך / חיי לילה') ? 14 : 0;
    let atmsW = h.factors.includes('קרבה לכספומט / מוקד פיננסי') ? 12 : 0;
    
    // Strategic events weights
    let eventBoost = 0;
    const activeEvs = CONFIG.STRATEGIC_EVENTS.filter(ev => State.active_events.includes(ev.key));
    const eventFactors = [];
    activeEvs.forEach(ev => {
      const isZoneMatch = ev.zones.length === 0 || ev.zones.includes(h.zone);
      const boostVal = ev.crime_boosts[h.crime] || 0;
      if (isZoneMatch && boostVal > 0) {
        eventBoost += boostVal;
        eventFactors.push(`${ev.name} (+${boostVal}%)`);
      }
    });

    const rtmSum = lightingW + barsW + atmsW;
    
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>פקודת סיור מונחה - תא סיכון #${h.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800&family=Share+Tech+Mono&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Heebo', sans-serif;
            color: #000;
            background: #fff;
            padding: 30px;
            direction: rtl;
            line-height: 1.5;
            position: relative;
            overflow: hidden;
          }
          /* DEMO watermark — diagonal repeating text, visible on screen + print.
             Stops a screenshot from being mistaken for a real police order. */
          body::before {
            content: 'תצוגת דמו · לא לשימוש מבצעי · DEMO · NOT FOR OPERATIONAL USE';
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-32deg);
            font-family: 'Heebo', sans-serif;
            font-weight: 900;
            font-size: 54px;
            color: rgba(255, 31, 75, 0.13);
            letter-spacing: 4px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 9999;
            user-select: none;
          }
          @media print {
            body::before {
              color: rgba(255, 31, 75, 0.18);
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          .header {
            text-align: center;
            border-bottom: 2px double #000;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .emblem {
            font-size: 32px;
            margin-bottom: 5px;
          }
          .header h1 {
            font-size: 22px;
            margin: 5px 0;
            font-weight: 700;
          }
          .header h2 {
            font-size: 16px;
            margin: 0;
            color: #444;
            font-weight: 400;
          }
          .confidential {
            border: 2px solid #ff1f4b;
            color: #ff1f4b;
            display: inline-block;
            padding: 4px 15px;
            font-weight: 800;
            font-size: 14px;
            margin: 10px 0;
            text-transform: uppercase;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .meta-table th, .meta-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
            font-size: 14px;
          }
          .meta-table th {
            background-color: #f5f5f5;
            width: 25%;
            font-weight: 700;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            margin-top: 25px;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          .factor-tag {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 3px 8px;
            border-radius: 4px;
            display: inline-block;
            margin: 4px;
            font-size: 12px;
          }
          .gauge-container {
            border: 1px solid #000;
            background: #f0f0f0;
            height: 20px;
            width: 100%;
            margin: 10px 0;
            position: relative;
          }
          .gauge-fill {
            background: #000;
            height: 100%;
          }
          .gauge-text {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            text-align: center;
            line-height: 20px;
            font-weight: 700;
            color: #000;
            mix-blend-mode: difference;
          }
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .sig-box {
            text-align: center;
            width: 45%;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-top: 40px;
            padding-top: 5px;
            font-size: 13px;
          }
          .bullet-list {
            margin-right: 20px;
            margin-bottom: 15px;
          }
          .bullet-list li {
            margin-bottom: 5px;
            font-size: 14px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
          .print-btn {
            background: #1a6dff;
            color: #fff;
            border: none;
            padding: 10px 20px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 20px;
            display: block;
            margin-left: auto;
          }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">שגר להדפסה ⎙</button>
        
        <div class="header">
          <div class="emblem">🇮🇱</div>
          <h1>מדינת ישראל — משטרת ישראל</h1>
          <h2>מחוז תל אביב • אגף המבצעים • ענף סיור ושיטור מונחה</h2>
          <div class="confidential">תצוגת דמו — לא לשימוש מבצעי</div>
        </div>

        <h1>פקודת נוכחות מונעת מבצעית</h1>
        <p>צו נוכחות מונעת זה מופק על ידי מערכת <b>TOMORROW</b> על בסיס היתוך מודיעיני רב-שכבתי וניתוח סיכון מרחבי-זמני. מטרת הפעילות היא שיבוש ומניעת עבירות פשיעה על ידי יצירת נוכחות משטרתית בולטת בתא המטרה.</p>

        <div class="section-title">פרטי גזרת הסיור ומטרה</div>
        <table class="meta-table">
          <tr>
            <th>מזהה תא סיכון</th>
            <td>#${h.id}</td>
            <th>תחנת אם / מרחב</th>
            <td>${station ? station.name : 'כללי'}</td>
          </tr>
          <tr>
            <th>עבירת יעד עיקרית</th>
            <td><b>${h.crime_name} (${h.code})</b></td>
            <th>טווח שעות פעילות מומלץ</th>
            <td>${h.window}</td>
          </tr>
          <tr>
            <th>נ"צ מרכזי לתא</th>
            <td style="font-family: monospace;">${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}</td>
            <th>שכונה / אזור גזרתי</th>
            <td>${h.zone}</td>
          </tr>
          <tr>
            <th>תאריך הפקה</th>
            <td>${dateStr}</td>
            <th>שעת הפקה</th>
            <td>${timeStr}</td>
          </tr>
        </table>

        <div class="section-title">הסתברות ורמת איום</div>
        <div style="font-size: 15px; margin-bottom: 8px;">
          הסתברות מצרפית לפעילות עבריינית בתא זה במשמרת הנוכחית עומדת על: <b>${h.probability}%</b> (רמת רגישות: <b>${r.label}</b>).
        </div>
        <div class="gauge-container">
          <div class="gauge-fill" style="width: ${h.probability}%;"></div>
          <div class="gauge-text">${h.probability}% סבירות פשיעה צפויה</div>
        </div>

        <div class="section-title">ביסוס ונימוקי מודל החיזוי (שקיפות מודל)</div>
        <ul class="bullet-list">
          <li><b>רקע סטטיסטי היסטורי (נתוני עבר):</b> ${baseW + histW}% השפעה. תא זה מתאפיין בפעילות פלילית מוגברת היסטורית ביממה זו של החודש.</li>
          <li><b>התאמה למחזוריות זמנית (שעות שיא):</b> ${fitW}% השפעה. השעות המוגדרות תואמות סטטיסטית לשעות השיא של ביצוע העבירה.</li>
          ${h.osint ? `<li><b>התראות מודיעין שטח (רשתות חברתיות וערוצים):</b> מהימנות גבוהה מדפי רשתות חברתיות בשעות האחרונות בטווח תא זה.</li>` : ''}
          ${rtmSum > 0 ? `<li><b>נתוני שטח סביבתיים (מוקדי סיכון):</b> קרבה לגורמי סיכון פיזיים גאוגרפיים (תאורה לקויה, מוקדי חיי לילה או כספומטים פיננסיים).</li>` : ''}
          ${eventBoost > 0 ? `<li><b>אירועים אסטרטגיים פעילים:</b> ${eventFactors.join(', ')}.</li>` : ''}
        </ul>

        <div class="section-title">גורמי סיכון פעילים ומאומתים בגזרה</div>
        <div style="margin-bottom: 15px;">
          ${h.factors.map(f => `<span class="factor-tag">${f}</span>`).join('')}
        </div>

        <div class="section-title">הנחיות פעולה וטקטיקה לצוותי הסיור</div>
        <ul class="bullet-list">
          <li><b>בולטות משטרתית (נוכחות גלויה):</b> נסיעה איטית בתוך תא הסיכון עם אורות כחולים מהבהבים (צ'קלקות) למשך 15 דקות לפחות בתוך חלון הזמן המיועד.</li>
          <li><b>פטרול רגלי יזום (סיור רגלי):</b> ירידה מהניידת וביצוע סיורים רגליים בנקודות תורפה ספציפיות כגון כניסות לעסקים, כספומטים, וסמטאות חשוכות.</li>
          <li><b>תשאול ועמידה במחסומים:</b> הקמת מחסום פתע בכניסות/יציאות מהגזרה המלבנית וביצוע בדיקות רכבים חשודים בהתאם לחשד סביר.</li>
          <li><b>שילוב מודיעין בזמן אמת:</b> שמירה על קשר רציף עם פקמ"צ התחנה לקבלת עדכונים שוטפים מערוצי ה-OSINT והיתוך המידע של המערכת.</li>
        </ul>

        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line">חתימת מפקח/קצין תורן תחנה (הנפקת צו)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">חתימת מפקד כוח הסיור (אישור ביצוע פקודה)</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    logEvent('system', 2, `⎙ הונפקה פקודת סיור מונחת מודפסת לתא סיכון #${h.id} (ייצוא רשמי)`);
  }

  // ---------- Init ----------
  function applyVersionLabels() {
    const v = (window.CONFIG && CONFIG.VERSION) || 'v0.6';
    const tag = document.getElementById('version-tag');
    if (tag) tag.textContent = v;
    const foot = document.getElementById('hm-version');
    if (foot) foot.textContent = `TOMORROW ${v} · נבנה ע״י אלחי פיין`;
  }

  function init() {
    loadState();
    applyVersionLabels();
    renderStationChips();
    renderIntelLog();
    startClock();
    showLogin(startSystem);   // login gate → boot → modules
  }

  return {
    init, saveState, loadState,
    getCurrentStation, setStation, nearestStation,
    distanceKm, etaMinutes, nearestEta,
    register, broadcast,
    toast, logEvent, renderIntelLog, updateThreatLevel, renderIcons,
    printPatrolOrder,
    State
  };
})();

document.addEventListener('DOMContentLoaded', () => TomorrowApp.init());

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
  sim: { prevented: 0, occurred: 0 },  // shift-simulation score
  settings: { demo_seconds: 11, onscene_seconds: 7 }
};

window.TomorrowApp = (function () {

  const State = window.TomorrowState;
  let saveTimer = null;

  // ---------- Persistence ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) Object.assign(State, JSON.parse(raw));
    } catch (e) { console.warn('loadState failed', e); }
  }

  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(State)); }
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
      'אתחול רשת ניבוי טקטית…',
      'טעינת שכבות מודיעין גאוגרפי…',
      'סנכרון תחנות משטרה ומרחבים…',
      'הרצת מודל ניבוי פשיעה — 24 שעות…',
      'חישוב מדדי סיכון לפי אזור…',
      'הרשת מקוונת. TOMORROW מוכן.'
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
          setTimeout(() => { boot.style.display = 'none'; if (onDone) onDone(); }, 700);
        } else if (onDone) onDone();
      }
    }, 420);
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
    if (critical >= 2)      { label = 'DEFCON 1 · קריטי'; cls = 'critical'; }
    else if (critical >= 1) { label = 'DEFCON 2 · גבוה';  cls = 'high'; }
    else if (high >= 2)     { label = 'DEFCON 3 · מוגבר'; cls = 'medium'; }
    else                    { label = 'DEFCON 4 · רגיל';  cls = 'low'; }
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

  function startSystem() {
    runBoot(() => {
      // Build forecast + map + dispatch after boot
      if (window.TomorrowPrediction) TomorrowPrediction.init();
      if (window.TomorrowMap) TomorrowMap.init();
      if (window.TomorrowDispatch) TomorrowDispatch.init();
      if (window.TomorrowSim) TomorrowSim.init();
      if (window.TomorrowAnalytics) TomorrowAnalytics.init();
      updateThreatLevel();
      renderIcons();   // convert any remaining static [data-lucide] in the HUD/timeline
      if (window.TomorrowSounds) TomorrowSounds.online();
      logEvent('system', 4, '✅ רשת הניבוי מקוונת — תחזית 24 שעות נטענה');
      if (window.TomorrowOsint) TomorrowOsint.init();   // OSINT signals (async) — boosts forecast
    });
  }

  // ---------- Init ----------
  function init() {
    loadState();
    renderStationChips();
    renderIntelLog();
    startClock();
    showLogin(startSystem);   // login gate → boot → modules
  }

  return {
    init, saveState, loadState,
    getCurrentStation, setStation, nearestStation,
    register, broadcast,
    toast, logEvent, renderIntelLog, updateThreatLevel, renderIcons,
    State
  };
})();

document.addEventListener('DOMContentLoaded', () => TomorrowApp.init());

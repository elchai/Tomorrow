/* ============================================================
   TOMORROW — Shift Simulation ("מצב משמרת")
   Turns the forecast into a live game: time auto-advances, and
   un-patrolled high-risk hotspots may ESCALATE into live incidents.
   Dispatch a unit before escalation → crime PREVENTED (+score).
   If it escalates → it OCCURRED. Race the clock = SWAT command feel.
   ============================================================ */

window.TomorrowSim = (function () {

  const State = window.TomorrowState;
  let running = false;
  let timer = null;
  let simHour = new Date().getHours();
  const liveMarkers = {};      // hotspot id -> leaflet marker
  const escalated = new Set();  // hotspot ids that already fired

  const TICK_MS = 3200;         // one simulated hour every ~3.2s
  const ESCALATE_P = 0.6;       // chance an un-patrolled hotspot fires each tick

  function score() {
    if (!State.sim) State.sim = { prevented: 0, occurred: 0 };
    return State.sim;
  }

  // ---------- score UI ----------
  function renderScore() {
    const s = score();
    const p = document.getElementById('stat-prevented');
    const o = document.getElementById('stat-occurred');
    if (p) p.textContent = s.prevented;
    if (o) o.textContent = s.occurred;
  }

  // ---------- live incident marker ----------
  function spawnLiveIncident(h) {
    const map = window.TomorrowMap && TomorrowMap.getMap();
    if (!map) return;
    const icon = L.divIcon({
      html: `<div class="live-incident"><div class="li-pulse"></div><div class="li-pulse"></div>
               <div class="li-core"><i data-lucide="siren"></i></div></div>`,
      className: '', iconSize: [40, 40], iconAnchor: [20, 20]
    });
    const m = L.marker([h.lat, h.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    m.bindPopup(`<div class="tac-popup" dir="rtl" style="--rc:#ff1f4b">
        <div class="tp-code">LIVE · אירוע פעיל #${h.id}</div>
        <div class="tp-name" style="color:#ff1f4b"><i data-lucide="siren"></i><span>${h.crime_name}</span></div>
        <div class="tp-zone"><i data-lucide="map-pin"></i><span>${h.zone}</span></div>
      </div>`);
    liveMarkers[h.id] = m;
    TomorrowApp.renderIcons();

    // crime scene clears after a while (whether or not responded to)
    setTimeout(() => clearLive(h.id), 14000);
  }

  function clearLive(id) {
    const m = liveMarkers[id];
    if (m) { const map = TomorrowMap.getMap(); if (map) map.removeLayer(m); delete liveMarkers[id]; }
  }

  // ---------- escalation ----------
  function escalate(h) {
    escalated.add(h.id);
    h.escalated = true;
    score().occurred++;
    renderScore();
    spawnLiveIncident(h);
    if (window.TomorrowSounds) TomorrowSounds.alert(h.risk);
    TomorrowApp.toast(`🚨 אירוע התרחש: ${h.crime_name} · ${h.zone}`, 'warning', 4200);
    TomorrowApp.logEvent('incident', h.risk, `🚨 אירוע פעיל — ${h.crime_name} ב${h.zone} (לא הוזנקה ניידת בזמן)`);
    TomorrowApp.saveState();
  }

  // called by dispatch.js when a unit is sent during a running shift
  function notePrevented(h) {
    if (!running || !h || h._simCounted || escalated.has(h.id)) return;
    h._simCounted = true;
    score().prevented++;
    renderScore();
    TomorrowApp.toast(`✅ פשע נמנע: ${h.crime_name} · ${h.zone}`, 'success');
    TomorrowApp.logEvent('prevent', 4, `✅ פשע נמנע — נוכחות משטרתית ב${h.zone} (${h.crime_name})`);
    TomorrowApp.saveState();
  }

  // ---------- main tick ----------
  function tick() {
    // advance simulated hour
    simHour = (simHour + 1) % 24;
    State.forecast_hour = simHour;
    syncTimelineUI();
    if (window.TomorrowPrediction) TomorrowPrediction.refresh();

    // candidates: high-risk, on-screen, not handled, not already fired
    const candidates = TomorrowPrediction.getVisibleForecast()
      .filter(h => h.risk <= 2 && !h.dispatched && !h.resolved && !escalated.has(h.id))
      .sort((a, b) => b.probability - a.probability);

    if (candidates.length && Math.random() < ESCALATE_P) {
      escalate(candidates[0]);
    }
  }

  function syncTimelineUI() {
    const slider = document.getElementById('tl-slider');
    const readout = document.getElementById('tl-readout');
    if (slider) slider.value = simHour;
    if (readout) readout.textContent = `${String(simHour).padStart(2, '0')}:00`;
  }

  // ---------- controls ----------
  function start() {
    running = true;
    simHour = TomorrowPrediction.activeHour();
    setBtn();
    const slider = document.getElementById('tl-slider');
    if (slider) slider.disabled = true;
    TomorrowApp.toast('▶ משמרת החלה — הזנק ניידות לפני שהפשע מתרחש', 'info', 4000);
    TomorrowApp.logEvent('system', 3, '▶ מצב משמרת הופעל — סימולציית 24 שעות');
    if (window.TomorrowSounds) TomorrowSounds.online();
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    setBtn();
    const slider = document.getElementById('tl-slider');
    if (slider) slider.disabled = false;
    const s = score();
    const total = s.prevented + s.occurred;
    const rate = total ? Math.round((s.prevented / total) * 100) : 0;
    TomorrowApp.toast(`⏸ משמרת הסתיימה · שיעור מניעה ${rate}% (${s.prevented}/${total})`, 'info', 5000);
    TomorrowApp.logEvent('system', 3, `⏸ סיכום משמרת: נמנעו ${s.prevented} · התרחשו ${s.occurred} · מניעה ${rate}%`);
  }

  function toggle() { running ? stop() : start(); }

  function setBtn() {
    const btn = document.getElementById('btn-sim');
    if (!btn) return;
    btn.innerHTML = running
      ? '<i data-lucide="pause"></i><span>עצור משמרת</span>'
      : '<i data-lucide="play"></i><span>הפעל משמרת</span>';
    btn.classList.toggle('active', running);
    TomorrowApp.renderIcons();
  }

  function isRunning() { return running; }

  function init() {
    if (!State.sim) State.sim = { prevented: 0, occurred: 0 };
    renderScore();
    setBtn();
  }

  return { init, toggle, start, stop, isRunning, notePrevented, renderScore };
})();

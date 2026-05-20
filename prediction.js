/* ============================================================
   TOMORROW — Prediction engine
   Generates predicted crime hotspots for the next 24h with a
   transparent, rule-based risk score (mock model — designed so a
   real model / API can be dropped in behind getForecast()).

   Risk score factors (each contributes, then clamped 0..100):
     • crime base_rate (config)
     • time-of-day fit vs. the crime's peak_hours
     • weekend uplift (Thu/Fri nights in IL)
     • neighborhood "historical hotspot" weight
     • deterministic jitter (seeded) so the grid is stable per session
   The score maps to a risk level 1..4 used everywhere for color.
   ============================================================ */

window.TomorrowPrediction = (function () {

  const State = window.TomorrowState;

  // Named hotspot zones across the district — each has a historical weight.
  // (lat/lng are zone centroids; predictions scatter around them.)
  const ZONES = [
    { name: 'מתחם התחנה המרכזית',  lat: 32.0560, lng: 34.7820, weight: 0.95 },
    { name: 'לב העיר / אלנבי',     lat: 32.0680, lng: 34.7710, weight: 0.80 },
    { name: 'נמל יפו / שוק הפשפשים', lat: 32.0530, lng: 34.7530, weight: 0.78 },
    { name: 'דיזנגוף סנטר',         lat: 32.0760, lng: 34.7750, weight: 0.62 },
    { name: 'רובע פלורנטין',        lat: 32.0570, lng: 34.7700, weight: 0.70 },
    { name: 'נווה שאנן',            lat: 32.0590, lng: 34.7790, weight: 0.88 },
    { name: 'שפת הים / טיילת',      lat: 32.0810, lng: 34.7660, weight: 0.55 },
    { name: 'אזור התעשייה צפון',    lat: 32.1180, lng: 34.8010, weight: 0.50 },
    { name: 'הדר יוסף',            lat: 32.1080, lng: 34.8230, weight: 0.45 },
    { name: 'מתחם רכבת השלום',      lat: 32.0730, lng: 34.7930, weight: 0.60 }
  ];

  // Deterministic pseudo-random so the forecast is stable within a session.
  let seed = 1337;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  function scoreToRisk(score) {
    if (score >= 78) return 1;
    if (score >= 58) return 2;
    if (score >= 38) return 3;
    return 4;
  }

  function timeFit(crime, hour) {
    // 1.0 if hour is a peak hour, decaying with distance to nearest peak
    let best = 24;
    crime.peak_hours.forEach(h => {
      const d = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour));
      if (d < best) best = d;
    });
    return Math.max(0, 1 - best / 6); // within ~6h of a peak still contributes
  }

  function weekendUplift(hour) {
    const day = new Date().getDay(); // 0=Sun … 4=Thu, 5=Fri, 6=Sat
    const nightlife = (hour >= 21 || hour <= 3);
    if ((day === 4 || day === 5) && nightlife) return 1.25; // Thu/Fri night
    if (day === 5 || day === 6) return 1.10;
    return 1.0;
  }

  function factorTags(crime, hour) {
    const tags = [];
    const day = new Date().getDay();
    if (crime.peak_hours.includes(hour)) tags.push('שעת שיא לעבירה');
    if ((day === 4 || day === 5) && (hour >= 21 || hour <= 3)) tags.push('סופ״ש · חיי לילה');
    if (hour >= 0 && hour <= 5) tags.push('שעות חשכה');
    return tags;
  }

  // Build the full 24h forecast (one pass; each hotspot carries its hour).
  function generate() {
    seed = 1337;
    const list = [];
    let id = 4000;

    for (let hour = 0; hour < 24; hour++) {
      // 1–3 hotspots per hour, weighted by overall activity
      const count = 1 + Math.floor(rng() * 3);
      for (let n = 0; n < count; n++) {
        const crime = CONFIG.CRIME_TYPES[Math.floor(rng() * CONFIG.CRIME_TYPES.length)];
        const zone = ZONES[Math.floor(rng() * ZONES.length)];

        const base = crime.base_rate * 100 * 0.5;
        const fit = timeFit(crime, hour) * 35;
        const hist = zone.weight * 25;
        const upl = weekendUplift(hour);
        const jitter = (rng() - 0.5) * 14;
        const score = Math.max(4, Math.min(100, (base + fit + hist + jitter) * upl));

        const station = TomorrowApp.nearestStation(zone.lat, zone.lng);

        list.push({
          id: id++,
          crime: crime.key,
          crime_name: crime.name,
          icon: crime.icon,
          zone: zone.name,
          lat: zone.lat + (rng() - 0.5) * 0.012,
          lng: zone.lng + (rng() - 0.5) * 0.012,
          hour,
          window: `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`,
          probability: Math.round(score),
          risk: scoreToRisk(score),
          factors: factorTags(crime, hour),
          station_id: station ? station.id : null,
          dispatched: false
        });
      }
    }
    return list.sort((a, b) => b.probability - a.probability);
  }

  // ---------- Public selectors ----------
  function activeHour() {
    return State.forecast_hour == null ? new Date().getHours() : State.forecast_hour;
  }

  // Hotspots for the selected hour (±1h band so the map is never empty).
  function getVisibleForecast() {
    const hour = activeHour();
    const stationId = State.current_station_id;
    return State.forecast.filter(h => {
      const inHour = Math.min(Math.abs(h.hour - hour), 24 - Math.abs(h.hour - hour)) <= 1;
      const inStation = !stationId || h.station_id === stationId;
      return inHour && inStation;
    });
  }

  function getForecast() { return State.forecast; }

  // ---------- Rendering ----------
  function renderForecastList() {
    const list = document.getElementById('forecast-list');
    if (!list) return;
    const items = getVisibleForecast();
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">אין תחזית לאזור / לשעה שנבחרו</div>';
    } else {
      list.innerHTML = items.map(h => {
        const r = CONFIG.RISK[h.risk];
        return `
          <div class="forecast-card risk-${h.risk} ${h.dispatched ? 'dispatched' : ''}" data-id="${h.id}">
            <div class="fc-top">
              <span class="fc-icon">${h.icon}</span>
              <span class="fc-name">${h.crime_name}</span>
              <span class="fc-prob" style="color:${r.color}">${h.probability}%</span>
            </div>
            <div class="fc-zone">📍 ${h.zone}</div>
            <div class="fc-meta">
              <span class="fc-window">🕒 ${h.window}</span>
              <span class="risk-tag" style="background:${r.color}22;color:${r.color};border-color:${r.color}66">${r.label}</span>
            </div>
            ${h.factors.length ? `<div class="fc-factors">${h.factors.map(f => `<span class="factor">${f}</span>`).join('')}</div>` : ''}
            <button class="fc-dispatch" data-id="${h.id}">🚓 הזנק ניידת</button>
          </div>`;
      }).join('');

      list.querySelectorAll('.forecast-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.fc-dispatch')) return;
          const h = State.forecast.find(x => x.id === parseInt(card.dataset.id));
          if (h && window.TomorrowMap) TomorrowMap.focusHotspot(h);
        });
      });
      list.querySelectorAll('.fc-dispatch').forEach(btn => {
        btn.addEventListener('click', () => {
          const h = State.forecast.find(x => x.id === parseInt(btn.dataset.id));
          if (h && window.TomorrowDispatch) TomorrowDispatch.dispatchToHotspot(h);
        });
      });
    }

    // badges + stats
    const badge = document.getElementById('forecast-badge');
    if (badge) badge.textContent = items.length;
    const stat = document.getElementById('stat-hotspots');
    if (stat) stat.textContent = items.length;
    const crit = document.getElementById('stat-critical');
    if (crit) crit.textContent = items.filter(h => h.risk === 1).length;
  }

  function refresh() {
    renderForecastList();
    if (window.TomorrowMap) TomorrowMap.renderHotspots();
    TomorrowApp.updateThreatLevel();
  }

  function init() {
    if (!State.forecast || State.forecast.length === 0) {
      State.forecast = generate();
      TomorrowApp.saveState();
    }
    TomorrowApp.register('prediction', { onStationChange: refresh });
    renderForecastList();
  }

  // Re-roll the model (fresh forecast)
  function regenerate() {
    seed = Date.now() & 0x7fffffff;
    State.forecast = generate();
    TomorrowApp.saveState();
    refresh();
    TomorrowApp.toast('🔄 מודל הניבוי הורץ מחדש', 'info');
    TomorrowApp.logEvent('model', 3, 'הרצת מודל ניבוי מחדש — תחזית 24 שעות עודכנה');
  }

  return {
    init, refresh, regenerate, generate,
    getVisibleForecast, getForecast, activeHour,
    renderForecastList, ZONES
  };
})();

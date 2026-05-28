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

  // Hotspot zones come from the active country profile (countries.js). Each
  // is assigned a stable weight via a hash of the name so the forecast
  // distribution feels different per zone without needing a per-country
  // weight column.
  function hashWeight(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return 0.45 + (h % 1000) / 1000 * 0.55;   // 0.45 .. 1.00
  }
  function ZONES() {
    const list = (CONFIG.ZONES && CONFIG.ZONES.length) ? CONFIG.ZONES : [];
    return list.map(z => ({ name: z.name, lat: z.lat, lng: z.lng, weight: z.weight || hashWeight(z.name) }));
  }

  // Deterministic pseudo-random so the forecast is stable within a session.
  let seed = 1337;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  // Coastline guard — only TLV needs it (Mediterranean to the west of the
  // demo's hotspot zones). São Paulo is inland; the function becomes a no-op.
  function coastLng(lat) { return 34.745 + (lat - 32.04) * 0.5; }
  function clampToLand(lat, lng, rng) {
    if (window.TomorrowCountries && TomorrowCountries.getCode() !== 'israel') return lng;
    const minLng = coastLng(lat) + 0.0025;
    return lng < minLng ? minLng + rng() * 0.004 : lng;
  }

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

    const zonesNow = ZONES();
    for (let hour = 0; hour < 24; hour++) {
      // 1–3 hotspots per hour, weighted by overall activity
      const count = 1 + Math.floor(rng() * 3);
      for (let n = 0; n < count; n++) {
        const crime = CONFIG.CRIME_TYPES[Math.floor(rng() * CONFIG.CRIME_TYPES.length)];
        const zone = zonesNow[Math.floor(rng() * zonesNow.length)];

        // scatter around the zone, then keep it on land (east of the TLV coastline)
        const jLat = zone.lat + (rng() - 0.5) * 0.012;
        let jLng = zone.lng + (rng() - 0.5) * 0.012;
        jLng = clampToLand(jLat, jLng, rng);

        // GIS Contextual Layer impact
        let rtmBoost = 0;
        let rtmFactors = [];
        if (window.TomorrowLayers && TomorrowLayers.checkRTMImpact) {
          const rtm = TomorrowLayers.checkRTMImpact(jLat, jLng, hour, crime.key);
          rtmBoost = rtm.boost;
          rtmFactors = rtm.factors;
        }

        // Strategic Calendar Events impact
        let eventBoost = 0;
        const activeEvents = State.active_events || [];
        const eventFactors = [];
        CONFIG.STRATEGIC_EVENTS.forEach(ev => {
          if (activeEvents.includes(ev.key)) {
            const isZoneMatch = ev.zones.length === 0 || ev.zones.includes(zone.name);
            const boostVal = ev.crime_boosts[crime.key] || 0;
            if (isZoneMatch && boostVal > 0) {
              eventBoost += boostVal;
              eventFactors.push(ev.name);
            }
          }
        });

        const base = crime.base_rate * 100 * CONFIG.FACTORS.base;
        const fit = timeFit(crime, hour) * CONFIG.FACTORS.fit;
        const hist = zone.weight * CONFIG.FACTORS.hist;
        const upl = weekendUplift(hour);
        const jitter = (rng() - 0.5) * 14;
        const score = Math.max(4, Math.min(100, (base + fit + hist + jitter) * upl + rtmBoost + eventBoost));

        const station = TomorrowApp.nearestStation(zone.lat, zone.lng);

        list.push({
          id: id++,
          crime: crime.key,
          crime_name: crime.name,
          code: crime.code,
          glyph: crime.glyph,
          zone: zone.name,
          lat: jLat,
          lng: jLng,
          hour,
          window: `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`,
          probability: Math.round(score),
          risk: scoreToRisk(score),
          factors: factorTags(crime, hour).concat(rtmFactors).concat(eventFactors),
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
    const tr = (k) => (window.TomorrowI18n ? TomorrowI18n.t(k) : k);
    const sevLabel = (riskId) => {
      const map = { 1: 'forecast.severity.critical', 2: 'forecast.severity.high', 3: 'forecast.severity.medium', 4: 'forecast.severity.low' };
      return tr(map[riskId] || map[4]);
    };
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state">${tr('forecast.empty')}</div>`;
    } else {
      list.innerHTML = items.map(h => {
        const r = CONFIG.RISK[h.risk];
        const state = h.resolved ? 'resolved' : (h.escalated ? 'escalated' : (h.dispatched ? 'dispatched' : ''));
        return `
          <div class="forecast-card risk-${h.risk} ${state}" data-id="${h.id}" style="--rc:${r.color}">
            <div class="fc-head">
              <span class="fc-icon"><i data-lucide="${h.glyph}"></i></span>
              <div class="fc-headtext">
                <span class="fc-name">${CONFIG.crimeName(h.crime)}</span>
                <span class="fc-code">${h.code} · #${h.id}</span>
              </div>
              ${h.osint ? (h.osint_url
                ? `<a href="${h.osint_url}" target="_blank" rel="noopener noreferrer" class="osint-tag osint-tag-link" title="פתח את הדיווח ב-${h.osint_source || 'טלגרם'}"><i data-lucide="radio-tower"></i>OSINT<i data-lucide="external-link"></i></a>`
                : '<span class="osint-tag" title="מאומת במקור OSINT / טלגרם"><i data-lucide="radio-tower"></i>OSINT</span>') : ''}
              <span class="risk-chip">${sevLabel(h.risk)}</span>
            </div>
            <div class="fc-zone"><i data-lucide="map-pin"></i><span>${h.zone}</span></div>
            <div class="fc-readout">
              <span class="fc-window"><i data-lucide="clock"></i>${h.window}</span>
              <span class="fc-prob"><b>${h.probability}</b><i>%</i></span>
            </div>
            <div class="fc-gauge"><div class="fc-gauge-fill" style="width:${h.probability}%"></div></div>
            ${(() => {
              const e = TomorrowApp.nearestEta(h.lat, h.lng, h.station_id);
              return e ? `<div class="fc-eta"><i data-lucide="timer"></i><span class="fc-eta-min">${e.eta} ${tr('forecast.eta')}</span><span class="fc-eta-from">${e.station.name} · ${e.km.toFixed(1)} km</span></div>` : '';
            })()}
            ${h.factors.length ? `<div class="fc-factors">${h.factors.map(f => `<span class="factor">${f}</span>`).join('')}</div>` : ''}
            <button class="fc-dispatch" data-id="${h.id}"><i data-lucide="navigation"></i><span>${tr('forecast.dispatch')}</span></button>
          </div>`;
      }).join('');
      TomorrowApp.renderIcons();

      list.querySelectorAll('.forecast-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.fc-dispatch, a')) return;   // dispatch btn + any link inside (e.g. OSINT)
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

    // Calculate Directed Patrol Coverage Rate
    const dispatchedCount = items.filter(h => h.dispatched).length;
    const coverageRate = items.length ? Math.round((dispatchedCount / items.length) * 100) : 100;
    const covEl = document.getElementById('stat-coverage');
    if (covEl) covEl.textContent = `${coverageRate}%`;

    // Calculate Ingested Intelligence Signals Count
    const intelEl = document.getElementById('stat-intel');
    if (intelEl) intelEl.textContent = (State.signals || []).length;
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
    // Re-apply OSINT boost so the OSINT tag survives regeneration
    if (window.TomorrowOsint && typeof TomorrowOsint.reapplyBoost === 'function') {
      TomorrowOsint.reapplyBoost();
    }
    const tr = (k) => (window.TomorrowI18n ? TomorrowI18n.t(k) : k);
    TomorrowApp.toast(tr('event.regenToast'), 'info');
    TomorrowApp.logEvent('model', 3, tr('event.regenLog'));
  }

  return {
    init, refresh, regenerate, generate,
    getVisibleForecast, getForecast, activeHour,
    renderForecastList, ZONES
  };
})();

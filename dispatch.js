/* ============================================================
   TOMORROW — Dispatch & patrol AVL
   Police-vehicle dispatch animation, adapted from FireOps'
   aircraft/vehicle routing: station → hotspot along a bezier
   route, rotating unit icon, live trail, on-scene secure pulse.
   ============================================================ */

window.TomorrowDispatch = (function () {

  const State = window.TomorrowState;
  let map;
  const active = {};        // animation id -> { marker, line, interval }

  // ---------- Geo helpers (from FireOps tactical.js) ----------
  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function bezier(p0, p1, p2, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      pts.push([
        (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
        (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
      ]);
    }
    return pts;
  }

  function calcHeadingDeg(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
  }

  function carSvg(color) {
    // points NORTH by default → rotated to heading each tick
    return `<svg viewBox="-10 -12 20 24" width="26" height="26" class="v-shape" style="overflow:visible;display:block">
      <rect x="-5" y="-10" width="10" height="20" rx="3" fill="${color}" stroke="#04101f" stroke-width="0.8"/>
      <rect x="-4" y="-7" width="8" height="5" rx="1" fill="#0a1830" opacity="0.85"/>
      <rect x="-4" y="2" width="8" height="5" rx="1" fill="#0a1830" opacity="0.7"/>
      <rect x="-5.5" y="-2" width="11" height="3.5" fill="#ffffff" opacity="0.9"/>
      <rect x="-5.5" y="-2" width="5.5" height="3.5" fill="#ff2a4d"/>
      <rect x="0" y="-2" width="5.5" height="3.5" fill="#1a6dff"/>
    </svg>`;
  }

  // ---------- Init ----------
  function setMap(leafletMap) { map = leafletMap; }

  function init() {
    if (!State.units || State.units.length === 0) seedUnits();
    if (window.TomorrowMap && !map) map = TomorrowMap.getMap();
    TomorrowApp.register('dispatch', { onStationChange: renderUnits });
    renderUnits();
  }

  function seedUnits() {
    const units = [];
    CONFIG.STATIONS.forEach(s => {
      for (let i = 1; i <= Math.min(3, s.cars); i++) {
        const type = i === 1 ? 'patrol' : (i === 2 ? 'patrol' : 'motor');
        const ut = CONFIG.unitType(type);
        units.push({
          callsign: `${s.id.slice(0, 3).toUpperCase()}-${i}`,
          type, type_name: ut.name, icon: ut.icon,
          status: 'available', text: 'זמינה · בתחנה',
          station_id: s.id
        });
      }
    });
    State.units = units;
    TomorrowApp.saveState();
  }

  function getVisibleUnits() {
    const sid = State.current_station_id;
    return (State.units || []).filter(u => !sid || u.station_id === sid);
  }

  // ---------- Patrol vehicle animation (station → hotspot) ----------
  function dispatchVehicle(unit, fromLatLng, toLatLng, color, onArrive) {
    if (!map) return;
    const id = unit.callsign + '_' + Date.now() + Math.random().toString(36).slice(2, 5);

    // curved route so multiple cars don't overlap on a straight line
    const dLat = toLatLng[0] - fromLatLng[0], dLng = toLatLng[1] - fromLatLng[1];
    const mid = [
      (fromLatLng[0] + toLatLng[0]) / 2 + dLng * 0.18,
      (fromLatLng[1] + toLatLng[1]) / 2 - dLat * 0.18
    ];
    const points = bezier(fromLatLng, mid, toLatLng, 80);

    const distKm = distanceMeters(fromLatLng[0], fromLatLng[1], toLatLng[0], toLatLng[1]) / 1000;
    const etaMin = (distKm / CONFIG.unitType(unit.type).speed_kmh) * 60;
    const demoMs = (State.settings.demo_seconds || 11) * 1000;
    const stepMs = demoMs / points.length;

    const line = L.polyline([points[0]], {
      color, weight: 2.5, dashArray: '8,8', opacity: 0.6,
      interactive: false, className: 'avl-path'
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div class="vehicle-marker"><div class="v-icon">${carSvg(color)}</div><div class="v-cs">${unit.callsign}</div></div>`,
      className: '', iconSize: [54, 40], iconAnchor: [27, 20]
    });
    const marker = L.marker(points[0], { icon, zIndexOffset: 800 }).addTo(map);

    let step = 0;
    const trail = [points[0]];
    function rotate() {
      const cur = points[step], nxt = points[Math.min(step + 1, points.length - 1)];
      const el = marker.getElement()?.querySelector('.v-shape');
      if (el && (cur[0] !== nxt[0] || cur[1] !== nxt[1])) el.style.transform = `rotate(${calcHeadingDeg(cur, nxt)}deg)`;
    }
    setTimeout(rotate, 30);

    const interval = setInterval(() => {
      step++;
      marker.setLatLng(points[step]);
      trail.push(points[step]);
      line.setLatLngs(trail);
      rotate();
      if (step >= points.length - 1) {
        clearInterval(interval);
        onSceneSecure(toLatLng[0], toLatLng[1], color);
        if (window.TomorrowSounds) TomorrowSounds.arrival();
        TomorrowApp.logEvent('status', 3, `${unit.callsign} הגיעה ל${unit.dest || 'יעד'} · ETA ריאלי ${etaMin.toFixed(0)} דק׳`);

        // on-scene phase: unit dwells at the target before returning available
        unit.status = 'onscene';
        unit.text = `בשטח · ${unit.dest || 'יעד'}`;
        renderUnits();

        // fade trail (keep the unit marker parked on scene during dwell)
        let f = 0;
        const fade = setInterval(() => {
          f++;
          line.setStyle({ opacity: Math.max(0, 0.6 - f * 0.07) });
          if (f > 9) { clearInterval(fade); map.removeLayer(line); }
        }, 220);

        const dwellMs = (State.settings.onscene_seconds || 7) * 1000;
        setTimeout(() => {
          if (marker.getElement()) marker.getElement().style.opacity = '0';
          map.removeLayer(marker);
          delete active[id];
          unit.status = 'available';
          unit.text = 'זמינה · בתחנה';
          renderUnits();
          // mark the hotspot as handled/secured
          if (unit.hotspot_id != null) {
            const h = State.forecast.find(x => x.id === unit.hotspot_id);
            if (h) { h.resolved = true; TomorrowPrediction.renderForecastList(); }
          }
          TomorrowApp.logEvent('status', 4, `${unit.callsign} סיימה טיפול · חוזרת לזמינות`);
        }, dwellMs);

        if (onArrive) onArrive();
      }
    }, stepMs);

    active[id] = { marker, line, interval };
    return { id, distKm, etaMin };
  }

  function onSceneSecure(lat, lng, color) {
    const ring = L.circle([lat, lng], {
      radius: 25, color, fillColor: color, fillOpacity: 0.4,
      weight: 3, interactive: false, className: 'secure-ring'
    }).addTo(map);
    let r = 25;
    const iv = setInterval(() => {
      r += 22;
      ring.setRadius(r);
      ring.setStyle({ fillOpacity: Math.max(0, 0.4 - r / 700), opacity: Math.max(0, 1 - r / 400) });
      if (r > 360) { clearInterval(iv); map.removeLayer(ring); }
    }, 50);
  }

  // ---------- High-level: dispatch units to a predicted hotspot ----------
  function dispatchToHotspot(h) {
    if (!h) { TomorrowApp.toast('⚠ לא נבחר מוקד חיזוי', 'warning'); return; }
    const station = CONFIG.station(h.station_id) || TomorrowApp.nearestStation(h.lat, h.lng);
    if (!station) { TomorrowApp.toast('⚠ לא נמצאה תחנה זמינה', 'warning'); return; }

    const recommended = CONFIG.responseCard(h.crime, h.risk);
    const r = CONFIG.RISK[h.risk];
    const from = [station.lat, station.lng];
    const to = [h.lat, h.lng];

    // pick available units from this station, fall back to any
    const pool = State.units.filter(u => u.station_id === station.id && u.status === 'available');
    const chosen = [];
    recommended.forEach(typeKey => {
      const u = pool.find(p => p.type === typeKey && !chosen.includes(p)) || pool.find(p => !chosen.includes(p));
      if (u) chosen.push(u);
    });
    if (chosen.length === 0) { TomorrowApp.toast(`⚠ אין ניידות זמינות ב${station.name}`, 'warning'); return; }

    h.dispatched = true;
    if (window.TomorrowMap) { TomorrowMap.markDispatched(h); TomorrowMap.focusHotspot(h); }
    if (window.TomorrowSounds) { TomorrowSounds.alert(h.risk); setTimeout(() => TomorrowSounds.dispatch(), 700); }

    TomorrowApp.toast(`🚓 הזנקה: ${chosen.length} יחידות מ${station.name} → ${h.zone}`, 'success');
    TomorrowApp.logEvent('dispatch', h.risk, `הזנקת ${chosen.length} יחידות ל${h.crime_name} · ${h.zone} (${h.probability}%)`);

    chosen.forEach((u, idx) => {
      u.status = 'dispatched';
      u.text = `בדרך ל${h.zone}`;
      u.dest = h.zone;
      u.hotspot_id = h.id;
      setTimeout(() => dispatchVehicle(u, from, to, r.color), idx * 1400);
    });
    renderUnits();
    TomorrowApp.saveState();
  }

  // "Saturate" — flood an area with extra patrols (preventive presence)
  function saturateArea() {
    const fc = TomorrowPrediction.getVisibleForecast().filter(h => h.risk <= 2);
    if (fc.length === 0) { TomorrowApp.toast('אין מוקדים בסיכון גבוה לרוויה', 'info'); return; }
    TomorrowApp.toast(`🛡️ סיור מונע מוגבר על ${fc.length} מוקדים`, 'success');
    TomorrowApp.logEvent('dispatch', 2, `הפעלת סיור מונע מוגבר על ${fc.length} מוקדי סיכון גבוה`);
    fc.slice(0, 4).forEach((h, i) => setTimeout(() => dispatchToHotspot(h), i * 900));
  }

  // ---------- Units sidebar ----------
  function renderUnits() {
    const list = document.getElementById('units-list');
    if (!list) return;
    const items = getVisibleUnits();
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">אין יחידות בתחנה זו</div>';
    } else {
      list.innerHTML = items.map(u => `
        <div class="unit-card status-${u.status}" data-cs="${u.callsign}">
          <div class="u-row">
            <span class="u-icon"><i data-lucide="${CONFIG.unitType(u.type).glyph}"></i></span>
            <span class="u-cs">${u.callsign}</span>
            <span class="u-led"></span>
          </div>
          <div class="u-type">${u.type_name}</div>
          <div class="u-text">${u.text}</div>
        </div>`).join('');
      list.querySelectorAll('.unit-card').forEach(c => c.addEventListener('click', () => {
        const u = State.units.find(x => x.callsign === c.dataset.cs);
        if (u) TomorrowApp.toast(`${u.callsign} — ${u.text}`);
      }));
      TomorrowApp.renderIcons();
    }
    const badge = document.getElementById('units-badge');
    if (badge) badge.textContent = items.length;
    const avail = items.filter(u => u.status === 'available').length;
    const stat = document.getElementById('stat-units');
    if (stat) stat.textContent = `${avail}/${items.length}`;
  }

  return { init, setMap, dispatchToHotspot, dispatchVehicle, saturateArea, renderUnits, getVisibleUnits };
})();

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
      for (let i = 1; i <= Math.min(4, s.cars); i++) {
        const type = i === 1 ? 'patrol' : (i === 2 ? 'motor' : (i === 3 ? 'swat' : 'undercover'));
        const ut = CONFIG.unitType(type);
        units.push({
          callsign: `${s.id.split('-')[0].toUpperCase().slice(0, 3)}-${i}`,
          type, type_name: ut.name,
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
  function dispatchVehicle(unit, fromLatLng, toLatLng, color, onArrive, isReturning = false) {
    if (!map) return;
    const id = unit.callsign + '_' + Date.now() + Math.random().toString(36).slice(2, 5);

    // curved route so multiple cars don't overlap on a straight line
    const dLat = toLatLng[0] - fromLatLng[0], dLng = toLatLng[1] - fromLatLng[1];
    const curveSign = isReturning ? -0.18 : 0.18;
    const mid = [
      (fromLatLng[0] + toLatLng[0]) / 2 + dLng * curveSign,
      (fromLatLng[1] + toLatLng[1]) / 2 - dLat * curveSign
    ];
    const points = bezier(fromLatLng, mid, toLatLng, 80);

    const distKm = distanceMeters(fromLatLng[0], fromLatLng[1], toLatLng[0], toLatLng[1]) / 1000;
    const speed = CONFIG.unitType(unit.type).speed_kmh;
    const etaMin = (distKm / speed) * 60;
    
    // Make travel animation duration proportional to actual distance/ETA:
    // 1 minute of real travel time = 1.3 seconds of visual movement on the map.
    // Bound between 3.5 seconds (for very close targets) and 18 seconds (for far away mutual-aid targets) to remain playable.
    const animationSeconds = Math.max(3.5, Math.min(18.0, etaMin * 1.3));
    const demoMs = animationSeconds * 1000;
    const stepMs = demoMs / points.length;

    const line = L.polyline([points[0]], {
      color: isReturning ? '#7f8db0' : color,
      weight: isReturning ? 1.6 : 2.5,
      dashArray: isReturning ? '4,4' : '8,8',
      opacity: isReturning ? 0.45 : 0.6,
      interactive: false,
      className: 'avl-path'
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div class="vehicle-marker ${isReturning ? 'returning' : ''}"><div class="v-icon">${carSvg(isReturning ? '#7f8db0' : color)}</div><div class="v-cs">${unit.callsign}</div></div>`,
      className: '',
      iconSize: [54, 40],
      iconAnchor: [27, 20]
    });
    const marker = L.marker(points[0], { icon, zIndexOffset: isReturning ? 600 : 800 }).addTo(map);

    let step = 0;
    const trail = [points[0]];
    function rotate() {
      const cur = points[step], nxt = points[Math.min(step + 1, points.length - 1)];
      const el = marker.getElement()?.querySelector('.v-shape');
      if (el && (cur[0] !== nxt[0] || cur[1] !== nxt[1])) {
        el.style.transform = `rotate(${calcHeadingDeg(cur, nxt)}deg)`;
      }
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
        
        if (!isReturning) {
          // Arrival at crime scene
          onSceneSecure(toLatLng[0], toLatLng[1], color);
          if (window.TomorrowSounds) TomorrowSounds.arrival();
          TomorrowApp.logEvent('status', 3, `${unit.callsign} הגיעה ל${unit.dest || 'יעד'} · ETA ריאלי ${etaMin.toFixed(0)} דק׳`);

          // on-scene phase: unit dwells at the target
          unit.status = 'onscene';
          const dwellSec = State.settings.onscene_seconds || 7;
          unit.text = `בשטח · אבטחת מוקד (${dwellSec}ש׳)`;
          renderUnits();

          // mark the hotspot as handled/secured
          if (unit.hotspot_id != null) {
            const h = State.forecast.find(x => x.id === unit.hotspot_id);
            if (h) { h.resolved = true; TomorrowPrediction.renderForecastList(); }
          }

          // fade trail
          let f = 0;
          const fade = setInterval(() => {
            f++;
            line.setStyle({ opacity: Math.max(0, 0.6 - f * 0.07) });
            if (f > 9) { clearInterval(fade); map.removeLayer(line); }
          }, 220);

          const dwellMs = dwellSec * 1000;
          setTimeout(() => {
            map.removeLayer(marker);
            delete active[id];

            const station = CONFIG.station(unit.station_id);
            if (station) {
              unit.status = 'returning';
              unit.text = `חזרה לתחנת ${station.name}`;
              renderUnits();
              TomorrowApp.logEvent('status', 2, `${unit.callsign} סיימה טיפול · בדרך חזרה לתחנה`);
              dispatchVehicle(unit, toLatLng, [station.lat, station.lng], color, onArrive, true);
            } else {
              unit.status = 'available';
              unit.text = 'זמינה · בתחנה';
              renderUnits();
            }
          }, dwellMs);
        } else {
          // Arrival back at police station
          if (marker.getElement()) marker.getElement().style.opacity = '0';
          map.removeLayer(marker);
          delete active[id];

          // fade trail
          let f = 0;
          const fade = setInterval(() => {
            f++;
            line.setStyle({ opacity: Math.max(0, 0.45 - f * 0.06) });
            if (f > 9) { clearInterval(fade); map.removeLayer(line); }
          }, 220);

          unit.status = 'available';
          unit.text = 'זמינה · בתחנה';
          unit.dest = null;
          unit.hotspot_id = null;
          delete unit.lpr_alert_id;        // P1 bug fix: don't leak the alert id across return cycles
          renderUnits();
          TomorrowApp.logEvent('status', 4, `🚔 ${unit.callsign} חזרה לתחנת האם · זמינה לשיגור`);
        }

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

  // ---------- Cross-station Mutual Aid allocation ----------
  function findAvailableUnits(preferredStationId, recommendedTypes, targetLatLng) {
    const chosen = [];
    const usedCallsigns = new Set();

    // 1. Try to find recommended unit types at the preferred station first
    recommendedTypes.forEach(typeKey => {
      const u = State.units.find(u => u.station_id === preferredStationId && u.status === 'available' && u.type === typeKey && !usedCallsigns.has(u.callsign));
      if (u) {
        chosen.push(u);
        usedCallsigns.add(u.callsign);
      }
    });

    // 2. Try to fill remaining slots with ANY available unit at the preferred station
    if (chosen.length < recommendedTypes.length) {
      const remainingCount = recommendedTypes.length - chosen.length;
      const primaryStationUnits = State.units.filter(u => u.station_id === preferredStationId && u.status === 'available' && !usedCallsigns.has(u.callsign));
      primaryStationUnits.slice(0, remainingCount).forEach(u => {
        chosen.push(u);
        usedCallsigns.add(u.callsign);
      });
    }

    // 3. MUTUAL AID: Try to find available recommended units at neighboring stations (sorted by distance)
    if (chosen.length < recommendedTypes.length) {
      const otherStations = CONFIG.STATIONS
        .filter(s => s.id !== preferredStationId)
        .map(s => ({
          station: s,
          distance: distanceMeters(s.lat, s.lng, targetLatLng[0], targetLatLng[1])
        }))
        .sort((a, b) => a.distance - b.distance);

      for (const entry of otherStations) {
        if (chosen.length >= recommendedTypes.length) break;

        const remainingCount = recommendedTypes.length - chosen.length;
        const recommendedTypesRemaining = recommendedTypes.slice(chosen.length);

        // Try to find recommended types at this neighbor station
        recommendedTypesRemaining.forEach(typeKey => {
          const u = State.units.find(u => u.station_id === entry.station.id && u.status === 'available' && u.type === typeKey && !usedCallsigns.has(u.callsign));
          if (u && chosen.length < recommendedTypes.length) {
            chosen.push(u);
            usedCallsigns.add(u.callsign);
          }
        });

        // Fill remaining slots with ANY available unit at this neighbor station
        if (chosen.length < recommendedTypes.length) {
          const nextRemaining = recommendedTypes.length - chosen.length;
          const neighborStationUnits = State.units.filter(u => u.station_id === entry.station.id && u.status === 'available' && !usedCallsigns.has(u.callsign));
          neighborStationUnits.slice(0, nextRemaining).forEach(u => {
            chosen.push(u);
            usedCallsigns.add(u.callsign);
          });
        }
      }
    }

    return chosen;
  }

  // ---------- High-level: dispatch units to a predicted hotspot ----------
  function dispatchToHotspot(h) {
    if (!h) { TomorrowApp.toast('⚠ לא נבחר מוקד חיזוי', 'warning'); return; }
    const station = CONFIG.station(h.station_id) || TomorrowApp.nearestStation(h.lat, h.lng);
    if (!station) { TomorrowApp.toast('⚠ לא נמצאה תחנה זמינה', 'warning'); return; }

    const recommended = CONFIG.responseCard(h.crime, h.risk);
    const r = CONFIG.RISK[h.risk];
    const to = [h.lat, h.lng];

    // Allocate units using our smart multi-station algorithm
    const chosen = findAvailableUnits(station.id, recommended, to);
    if (chosen.length === 0) { TomorrowApp.toast(`⚠ אין ניידות זמינות בכל המרחב`, 'warning'); return; }

    h.dispatched = true;
    if (window.TomorrowMap) { TomorrowMap.markDispatched(h); TomorrowMap.focusHotspot(h); }
    if (window.TomorrowSounds) { TomorrowSounds.alert(h.risk); setTimeout(() => TomorrowSounds.dispatch(), 700); }

    // Log & Toast with Mutual Aid counts
    const primaryCount = chosen.filter(u => u.station_id === station.id).length;
    const mutualCount = chosen.length - primaryCount;

    if (mutualCount > 0) {
      TomorrowApp.toast(`🚓 סיוע הדדי: ${chosen.length} צוותים הוקצו (מתוכם ${mutualCount} מתחנה שכנה) לתא #${h.id} ב${h.zone}`, 'success');
      TomorrowApp.logEvent('dispatch', h.risk, `הקצאת ${chosen.length} צוותי סיור מונחה לתא #${h.id} ב${h.zone} (${h.probability}%) - כולל ${mutualCount} צוותי סיוע הדדי`);
    } else {
      TomorrowApp.toast(`🚓 פריסת סיור: ${chosen.length} צוותים הוקצו לתא #${h.id} ב${h.zone}`, 'success');
      TomorrowApp.logEvent('dispatch', h.risk, `הקצאת ${chosen.length} צוותי סיור מונחה לתא #${h.id} ב${h.zone} (${h.probability}%)`);
    }

    chosen.forEach((u, idx) => {
      u.status = 'dispatched';
      u.text = `בדרך ל${h.zone}`;
      u.dest = h.zone;
      u.hotspot_id = h.id;
      // starting point is the unit's actual home station!
      const uStation = CONFIG.station(u.station_id);
      const from = [uStation.lat, uStation.lng];
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

  // ---------- LPR Dispatch Loop ----------
  function dispatchToLpr(a) {
    if (!a) return;
    const station = TomorrowApp.nearestStation(a.camera.lat, a.camera.lng);
    if (!station) { TomorrowApp.toast('⚠ לא נמצאה תחנה זמינה בסביבת המצלמה', 'warning'); return; }

    // Allocate 1 available patrol unit (using smart cross-station mutual aid if needed)
    const recommended = ['patrol'];
    const chosen = findAvailableUnits(station.id, recommended, [a.camera.lat, a.camera.lng]);
    if (chosen.length === 0) {
      TomorrowApp.toast(`⚠ אין ניידות פנויות להזנקת LPR ב${station.name} או בסביבתה`, 'warning');
      return;
    }

    const u = chosen[0];
    const uStation = CONFIG.station(u.station_id);
    const from = [uStation.lat, uStation.lng];
    const to = [a.camera.lat, a.camera.lng];

    // Lock unit as dispatched
    u.status = 'dispatched';
    u.text = `מרדף LPR · ${a.camera.name}`;
    u.dest = a.camera.name;
    u.lpr_alert_id = a.id;

    // stolen gets critical color (#ff1f4b), flagged gets high color (#ff7a18)
    const color = a.status === 'stolen' ? CONFIG.RISK[1].color : CONFIG.RISK[2].color;

    // Dispatches AVL car to camera
    dispatchVehicle(u, from, to, color, () => {
      // Callback upon arrival at the LPR camera scene
      if (window.TomorrowLpr) {
        TomorrowLpr.updateAlertStatus(a.id, 'secured', u.callsign);
      }
    });

    const isMutual = u.station_id !== station.id;
    if (isMutual) {
      TomorrowApp.toast(`🚓 סיוע הדדי LPR: צוות ${u.callsign} מתחנת ${uStation.name} הוזנק למצלמה ב${a.camera.name}`, 'success');
      TomorrowApp.logEvent('dispatch', 2, `🚨 סיוע הדדי LPR: הזנקת צוות ${u.callsign} לתפיסת רכב ${a.status === 'stolen' ? 'גנוב' : 'מסומן'} · לוחית ${a.plate} · ${a.camera.name}`);
    } else {
      TomorrowApp.toast(`🚓 שיגור LPR: צוות ${u.callsign} הוזנק מ${uStation.name} למצלמה ב${a.camera.name}`, 'success');
      TomorrowApp.logEvent('dispatch', 1, `🚨 שיגור LPR: הזנקת צוות ${u.callsign} לתפיסת רכב ${a.status === 'stolen' ? 'גנוב' : 'מסומן'} · לוחית ${a.plate} · ${a.camera.name}`);
    }

    if (window.TomorrowSounds) TomorrowSounds.dispatch();
    renderUnits();
    TomorrowApp.saveState();
  }

  // ---------- Units sidebar ----------
  function renderUnits() {
    const list = document.getElementById('units-list');
    if (!list) return;
    const items = getVisibleUnits();
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">אין יחידות בתחנה זו</div>';
    } else {
      list.innerHTML = items.map(u => {
        const hasProgress = u.status === 'onscene';
        const dwellSec = State.settings.onscene_seconds || 7;
        const progressHtml = hasProgress 
          ? `<div class="u-progress"><div class="u-progress-fill" style="animation: dwellBar ${dwellSec}s linear forwards"></div></div>`
          : '';
        return `
          <div class="unit-card status-${u.status}" data-cs="${u.callsign}">
            <div class="u-row">
              <span class="u-icon"><i data-lucide="${CONFIG.unitType(u.type).glyph}"></i></span>
              <span class="u-cs">${u.callsign}</span>
              <span class="u-led"></span>
            </div>
            <div class="u-type">${u.type_name}</div>
            <div class="u-text">${u.text}</div>
            ${progressHtml}
          </div>`;
      }).join('');
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

  return { init, setMap, dispatchToHotspot, dispatchToLpr, dispatchVehicle, saturateArea, renderUnits, getVisibleUnits };
})();


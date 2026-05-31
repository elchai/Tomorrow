/* ============================================================
   TOMORROW — Fleet management tab
   Vehicle registry, status (available/dispatched/maintenance/oos),
   maintenance schedule, fuel/odometer telemetry. Vehicles seeded
   procedurally from active country stations (~2-3 per station).
   ============================================================ */

window.TomorrowFleet = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let activeVehicleId = null;
  let filterType = 'all';
  let filterStatus = 'all';

  const VEHICLE_TYPES = [
    { key: 'patrol_car',  glyph: 'car-front',     speedKmh: 60 },
    { key: 'motorcycle',  glyph: 'bike',          speedKmh: 75 },
    { key: 'swat_van',    glyph: 'truck',         speedKmh: 65 },
    { key: 'k9_van',      glyph: 'dog',           speedKmh: 60 },
    { key: 'undercover',  glyph: 'eye-off',       speedKmh: 60 },
    { key: 'command',     glyph: 'radio-tower',   speedKmh: 55 }
  ];

  function rngFromSeed(s) {
    let x = s | 0 || 1;
    return () => { x = (x * 1664525 + 1013904223) & 0x7fffffff; return x / 0x7fffffff; };
  }

  function seedVehicles() {
    const stations = CONFIG.STATIONS || [];
    const country = TomorrowCountries?.getCode?.() || 'brazil';
    const rand = rngFromSeed(country.length * 13);
    const out = [];
    stations.forEach((st, si) => {
      // 3 vehicles per station: 1 patrol + 1 motorcycle + 1 special (swat/k9/undercover)
      const types = ['patrol_car', 'motorcycle', si % 3 === 0 ? 'swat_van' : si % 3 === 1 ? 'k9_van' : 'undercover'];
      types.forEach((type, ti) => {
        const statusRoll = rand();
        const status = statusRoll < 0.6 ? 'available'
                     : statusRoll < 0.78 ? 'dispatched'
                     : statusRoll < 0.92 ? 'maintenance'
                     : 'out_of_service';
        const plate = country === 'israel'
          ? `${10 + Math.floor(rand() * 89)}-${100 + Math.floor(rand() * 899)}-${10 + Math.floor(rand() * 89)}`
          : `${['ABC','BRA','SPO','XYZ','RIO'][Math.floor(rand()*5)]}-${1000 + Math.floor(rand() * 8999)}`;
        const lastServiceDays = Math.floor(rand() * 90);
        const d = new Date();
        d.setDate(d.getDate() - lastServiceDays);
        out.push({
          id: `veh-${st.id}-${ti + 1}`,
          callsign: `${st.id.toUpperCase().slice(0, 3)}-V${si + 1}${ti + 1}`,
          type,
          plate,
          station_id: st.id,
          status,
          last_service: d.toISOString().slice(0, 10),
          mileage_km: 30000 + Math.floor(rand() * 90000),
          fuel_pct: 20 + Math.floor(rand() * 80),
          next_service_km: 0  // computed at render
        });
      });
    });
    return out;
  }

  function getVehicles() {
    if (!State.vehicles || !State.vehicles.length || State.vehicles_country !== TomorrowCountries?.getCode?.()) {
      State.vehicles = seedVehicles();
      State.vehicles_country = TomorrowCountries?.getCode?.();
      TomorrowApp?.saveState?.();
    }
    return State.vehicles;
  }

  function init() {
    panelEl = document.getElementById('tab-fleet');
    if (!panelEl) return;
    panelEl.classList.add('fleet-tab');
    panelEl.addEventListener('click', e => {
      const row = e.target.closest('[data-vehicle-id]');
      if (row) { activeVehicleId = activeVehicleId === row.dataset.vehicleId ? null : row.dataset.vehicleId; refresh(); return; }
      const typeChip = e.target.closest('[data-type-filter]');
      if (typeChip) { filterType = typeChip.dataset.typeFilter; refresh(); return; }
      const statusChip = e.target.closest('[data-vstatus-filter]');
      if (statusChip) { filterStatus = statusChip.dataset.vstatusFilter; refresh(); return; }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('fleet', {
      onTabActivate: (name) => { if (name === 'fleet') refresh(); }
    });
  }

  function statusColor(s) {
    switch (s) {
      case 'available':       return 'var(--low)';
      case 'dispatched':      return 'var(--cyan)';
      case 'maintenance':     return 'var(--high)';
      case 'out_of_service':  return 'var(--critical)';
      default:                return 'var(--text-dim)';
    }
  }

  function filtered() {
    return getVehicles().filter(v => {
      if (filterType !== 'all' && v.type !== filterType) return false;
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      return true;
    });
  }

  function renderPanel() {
    const all = getVehicles();
    const list = filtered();
    const counts = {
      available:      all.filter(v => v.status === 'available').length,
      dispatched:     all.filter(v => v.status === 'dispatched').length,
      maintenance:    all.filter(v => v.status === 'maintenance').length,
      out_of_service: all.filter(v => v.status === 'out_of_service').length
    };
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="car-front"></i><span>${T('menu.fleet')}</span></span>
        <span class="tab-counts">
          <span class="tab-count" style="--rc:var(--low)">${counts.available} ${T('fleet.status.available')}</span>
          <span class="tab-count" style="--rc:var(--cyan)">${counts.dispatched} ${T('fleet.status.dispatched')}</span>
          <span class="tab-count" style="--rc:var(--high)">${counts.maintenance} ${T('fleet.status.maintenance')}</span>
          <span class="tab-count" style="--rc:var(--critical)">${counts.out_of_service} ${T('fleet.status.out_of_service')}</span>
        </span>
      </div>

      <div class="tab-toolbar">
        <div class="filter-chips">
          ${['all', ...VEHICLE_TYPES.map(t => t.key)].map(t => `
            <button class="filter-chip ${t === filterType ? 'active' : ''}" data-type-filter="${t}">${T(t === 'all' ? 'fleet.type.all' : 'fleet.type.' + t)}</button>
          `).join('')}
        </div>
        <div class="filter-chips">
          ${['all','available','dispatched','maintenance','out_of_service'].map(s => `
            <button class="filter-chip ${s === filterStatus ? 'active' : ''}" data-vstatus-filter="${s}">${T('fleet.status.' + s)}</button>
          `).join('')}
        </div>
      </div>

      <div class="tab-split">
        <div class="tab-list vehicles-list">
          ${list.length === 0 ? `<div class="empty-state">${T('fleet.empty')}</div>`
            : list.map(renderRow).join('')}
        </div>
        <div class="tab-detail">
          ${activeVehicleId
            ? renderDetail(getVehicles().find(v => v.id === activeVehicleId))
            : `<div class="empty-state">${T('fleet.selectHint')}</div>`}
        </div>
      </div>
    `;
  }

  function renderRow(v) {
    const type = VEHICLE_TYPES.find(t => t.key === v.type);
    const station = CONFIG.station(v.station_id);
    return `
      <div class="vehicle-row ${v.id === activeVehicleId ? 'active' : ''}" data-vehicle-id="${v.id}">
        <div class="vehicle-icon"><i data-lucide="${type?.glyph || 'car-front'}"></i></div>
        <div class="vehicle-meta">
          <div class="vehicle-callsign">${v.callsign}</div>
          <div class="vehicle-plate">${v.plate}</div>
          <div class="vehicle-sub">${T('fleet.type.' + v.type)} · ${station?.name || ''}</div>
        </div>
        <div class="vehicle-status" style="--rc:${statusColor(v.status)}">
          <span class="dot"></span>${T('fleet.status.' + v.status)}
        </div>
        <div class="vehicle-fuel">
          <span class="fuel-label">${T('fleet.fuel')}</span>
          <div class="fuel-bar"><div class="fuel-fill" style="width:${v.fuel_pct}%; background:${v.fuel_pct < 30 ? 'var(--high)' : 'var(--low)'};"></div></div>
          <span class="fuel-pct">${v.fuel_pct}%</span>
        </div>
      </div>`;
  }

  function renderDetail(v) {
    if (!v) return `<div class="empty-state">${T('fleet.selectHint')}</div>`;
    const station = CONFIG.station(v.station_id);
    const type = VEHICLE_TYPES.find(t => t.key === v.type);
    return `
      <div class="vehicle-detail">
        <div class="vehicle-detail-head">
          <div class="vehicle-icon lg"><i data-lucide="${type?.glyph || 'car-front'}"></i></div>
          <div>
            <div class="vehicle-callsign lg">${v.callsign}</div>
            <div class="vehicle-plate">${v.plate}</div>
            <div class="vehicle-sub">${T('fleet.type.' + v.type)}</div>
            <span class="vehicle-status" style="--rc:${statusColor(v.status)}">
              <span class="dot"></span>${T('fleet.status.' + v.status)}
            </span>
          </div>
        </div>
        <div class="officer-section">
          <div class="officer-section-head">${T('fleet.operational')}</div>
          <div class="officer-line"><span>${T('fleet.station')}</span><b>${station?.name || '—'}</b></div>
          <div class="officer-line"><span>${T('fleet.mileage')}</span><b>${v.mileage_km.toLocaleString()} km</b></div>
          <div class="officer-line"><span>${T('fleet.fuel')}</span><b>${v.fuel_pct}%</b></div>
          <div class="officer-line"><span>${T('fleet.lastService')}</span><b>${v.last_service}</b></div>
        </div>
      </div>`;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  return { init, refresh, listVehicles: getVehicles };
})();

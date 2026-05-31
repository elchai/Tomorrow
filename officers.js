/* ============================================================
   TOMORROW — Personnel (officers directory) tab
   Owns the officer roster. Officers are seeded procedurally from
   the active country's stations on first init (5 per station),
   then persisted in State.officers so manual edits survive a
   reload. Re-seeded automatically if the country switches.
   ============================================================ */

window.TomorrowOfficers = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let activeOfficerId = null;
  let filterStatus = 'all';    // 'all' | 'available' | 'on_duty' | 'leave' | 'training'
  let filterStation = 'all';
  let searchQuery = '';

  // Rank ladder (lowest → highest). Used for sort + label resolution.
  const RANKS = ['officer', 'sergeant', 'inspector', 'commander', 'chief'];

  // Hebrew first names for IL seeded officers (real-feeling, generic)
  const NAMES_IL = [
    { first: 'איתי',   last: 'מזרחי' }, { first: 'דנה',    last: 'כהן' },
    { first: 'שיר',    last: 'לוי' },   { first: 'יואב',   last: 'בן-שמעון' },
    { first: 'נועה',   last: 'אברהם' }, { first: 'אביב',   last: 'פרץ' },
    { first: 'מאיה',   last: 'דהן' },   { first: 'אסף',    last: 'נחום' },
    { first: 'יסמין',  last: 'עמר' },   { first: 'עומר',   last: 'אוחיון' },
    { first: 'תמר',    last: 'אזולאי' },{ first: 'איל',    last: 'גבאי' },
    { first: 'הילה',   last: 'יפת' },   { first: 'אדי',    last: 'מויאל' },
    { first: 'רוני',   last: 'בארי' },  { first: 'דביר',   last: 'פרץ' },
    { first: 'אורי',   last: 'דדון' },  { first: 'יעל',    last: 'חזן' },
    { first: 'נתן',    last: 'אליהו' }, { first: 'גיא',    last: 'שטרית' },
    { first: 'אריאל',  last: 'בן-דוד' },{ first: 'שני',    last: 'אטיאס' },
    { first: 'בר',     last: 'אסולין' },{ first: 'תום',    last: 'דנינו' },
    { first: 'אילן',   last: 'סבג' }
  ];
  const NAMES_BR = [
    { first: 'João',     last: 'Silva' },     { first: 'Maria',    last: 'Santos' },
    { first: 'Pedro',    last: 'Oliveira' },  { first: 'Ana',      last: 'Souza' },
    { first: 'Carlos',   last: 'Rodrigues' }, { first: 'Beatriz',  last: 'Ferreira' },
    { first: 'Lucas',    last: 'Almeida' },   { first: 'Júlia',    last: 'Costa' },
    { first: 'Rafael',   last: 'Pereira' },   { first: 'Mariana',  last: 'Lima' },
    { first: 'Felipe',   last: 'Gomes' },     { first: 'Camila',   last: 'Carvalho' },
    { first: 'Bruno',    last: 'Martins' },   { first: 'Larissa',  last: 'Barbosa' },
    { first: 'Diego',    last: 'Ribeiro' },   { first: 'Fernanda', last: 'Araújo' },
    { first: 'Gabriel',  last: 'Cardoso' },   { first: 'Patrícia', last: 'Mendes' },
    { first: 'Vinícius', last: 'Castro' },    { first: 'Renata',   last: 'Pinto' },
    { first: 'Thiago',   last: 'Reis' },      { first: 'Carolina', last: 'Moura' },
    { first: 'Rodrigo',  last: 'Cavalcanti' },{ first: 'Aline',    last: 'Borges' },
    { first: 'Marcelo',  last: 'Teixeira' }
  ];

  // Lightweight deterministic RNG so the demo seed is stable across reloads.
  function rngFromSeed(seed) {
    let s = seed | 0 || 1;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function seedOfficersForCountry() {
    const stations = (CONFIG.STATIONS || []);
    if (!stations.length) return [];
    const countryCode = TomorrowCountries?.getCode?.() || 'brazil';
    const pool = countryCode === 'israel' ? NAMES_IL : NAMES_BR;
    const rand = rngFromSeed(countryCode.length * 7919);
    const officers = [];
    let idx = 0;
    stations.forEach((st, si) => {
      // 5 officers per station: 1 commander + 1 inspector + 1 sergeant + 2 officers
      const distribution = ['commander', 'inspector', 'sergeant', 'officer', 'officer'];
      distribution.forEach((rank, ri) => {
        const n = pool[(idx++) % pool.length];
        const statusRoll = rand();
        const status = statusRoll < 0.55 ? 'available'
                     : statusRoll < 0.78 ? 'on_duty'
                     : statusRoll < 0.92 ? 'leave'
                     : 'training';
        officers.push({
          id: `off-${st.id}-${ri + 1}`,
          callsign: `${st.id.toUpperCase().slice(0, 3)}-${si + 1}${ri + 1}`,
          first_name: n.first,
          last_name: n.last,
          rank,
          station_id: st.id,
          status,
          phone: `+${countryCode === 'israel' ? '972-5' : '55-11'}-${1000 + Math.floor(rand() * 8999)}-${1000 + Math.floor(rand() * 8999)}`,
          years_of_service: 2 + Math.floor(rand() * 23),
          certifications: ['weapons_basic', 'first_aid', ...(rank !== 'officer' ? ['driving_emergency'] : [])]
            .concat(rank === 'inspector' || rank === 'commander' ? ['swat_tactical'] : [])
            .concat(rand() > 0.6 ? ['k9_handling'] : [])
            .concat(countryCode === 'israel' ? ['language_arabic'] : ['language_english'])
        });
      });
    });
    return officers;
  }

  function getOfficers() {
    if (!State.officers || !State.officers.length || State.officers_country !== TomorrowCountries?.getCode?.()) {
      State.officers = seedOfficersForCountry();
      State.officers_country = TomorrowCountries?.getCode?.();
      TomorrowApp?.saveState?.();
    }
    return State.officers;
  }

  function init() {
    panelEl = document.getElementById('tab-personnel');
    if (!panelEl) return;
    panelEl.classList.add('personnel-tab');
    panelEl.addEventListener('click', e => {
      const row = e.target.closest('[data-officer-id]');
      if (row) { activeOfficerId = activeOfficerId === row.dataset.officerId ? null : row.dataset.officerId; refresh(); return; }
      const chip = e.target.closest('[data-status-filter]');
      if (chip) { filterStatus = chip.dataset.statusFilter; refresh(); return; }
      const stChip = e.target.closest('[data-station-filter]');
      if (stChip) { filterStation = stChip.dataset.stationFilter; refresh(); return; }
    });
    panelEl.addEventListener('input', e => {
      if (e.target.id === 'officer-search') {
        searchQuery = e.target.value.trim().toLowerCase();
        // Re-render but preserve focus on the search input
        refresh();
        const input = document.getElementById('officer-search');
        if (input) { input.focus(); input.setSelectionRange(searchQuery.length, searchQuery.length); }
      }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('officers', {
      onTabActivate: (name) => { if (name === 'personnel') refresh(); }
    });
  }

  function statusColor(s) {
    switch (s) {
      case 'available': return 'var(--low)';
      case 'on_duty':   return 'var(--cyan)';
      case 'leave':     return 'var(--high)';
      case 'training':  return 'var(--medium)';
      default:          return 'var(--text-dim)';
    }
  }

  function filteredOfficers() {
    return getOfficers().filter(o => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      if (filterStation !== 'all' && o.station_id !== filterStation) return false;
      if (searchQuery) {
        const hay = `${o.callsign} ${o.first_name} ${o.last_name} ${o.rank}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });
  }

  function renderPanel() {
    const all = getOfficers();
    const filtered = filteredOfficers();
    const stations = CONFIG.STATIONS || [];
    const statusCounts = {
      available: all.filter(o => o.status === 'available').length,
      on_duty:   all.filter(o => o.status === 'on_duty').length,
      leave:     all.filter(o => o.status === 'leave').length,
      training:  all.filter(o => o.status === 'training').length
    };
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="users"></i><span>${T('menu.personnel')}</span></span>
        <span class="tab-counts">
          <span class="tab-count" style="--rc:var(--low)">${statusCounts.available} ${T('personnel.status.available')}</span>
          <span class="tab-count" style="--rc:var(--cyan)">${statusCounts.on_duty} ${T('personnel.status.on_duty')}</span>
          <span class="tab-count" style="--rc:var(--high)">${statusCounts.leave} ${T('personnel.status.leave')}</span>
          <span class="tab-count" style="--rc:var(--medium)">${statusCounts.training} ${T('personnel.status.training')}</span>
        </span>
      </div>

      <div class="tab-toolbar">
        <input id="officer-search" type="search" class="tab-search" placeholder="${T('personnel.search')}" value="${searchQuery.replace(/"/g, '&quot;')}" />
        <div class="filter-chips">
          ${['all','available','on_duty','leave','training'].map(s => `
            <button class="filter-chip ${s === filterStatus ? 'active' : ''}" data-status-filter="${s}">${T('personnel.status.' + s)}</button>
          `).join('')}
        </div>
        <div class="filter-chips">
          <button class="filter-chip ${filterStation === 'all' ? 'active' : ''}" data-station-filter="all">${T('hud.allDistrict')}</button>
          ${stations.map(st => `
            <button class="filter-chip ${filterStation === st.id ? 'active' : ''}" data-station-filter="${st.id}">${st.name}</button>
          `).join('')}
        </div>
      </div>

      <div class="tab-split">
        <div class="tab-list officers-list">
          ${filtered.length === 0 ? `<div class="empty-state">${T('personnel.empty')}</div>`
            : filtered.map(o => renderOfficerRow(o)).join('')}
        </div>
        <div class="tab-detail">
          ${activeOfficerId
            ? renderOfficerDetail(getOfficers().find(o => o.id === activeOfficerId))
            : `<div class="empty-state">${T('personnel.selectHint')}</div>`}
        </div>
      </div>
    `;
  }

  function renderOfficerRow(o) {
    const station = CONFIG.station(o.station_id);
    return `
      <div class="officer-row ${o.id === activeOfficerId ? 'active' : ''}" data-officer-id="${o.id}">
        <div class="officer-avatar">${(o.first_name || '?').slice(0, 1)}${(o.last_name || '?').slice(0, 1)}</div>
        <div class="officer-meta">
          <div class="officer-callsign">${o.callsign}</div>
          <div class="officer-name">${o.first_name} ${o.last_name}</div>
          <div class="officer-sub">${T('personnel.rank.' + o.rank)} · ${station?.name || ''}</div>
        </div>
        <div class="officer-status" style="--rc:${statusColor(o.status)}">
          <span class="dot"></span>${T('personnel.status.' + o.status)}
        </div>
      </div>`;
  }

  function renderOfficerDetail(o) {
    if (!o) return `<div class="empty-state">${T('personnel.selectHint')}</div>`;
    const station = CONFIG.station(o.station_id);
    return `
      <div class="officer-detail">
        <div class="officer-detail-head">
          <div class="officer-avatar lg">${(o.first_name || '?').slice(0, 1)}${(o.last_name || '?').slice(0, 1)}</div>
          <div>
            <div class="officer-callsign">${o.callsign}</div>
            <div class="officer-name lg">${o.first_name} ${o.last_name}</div>
            <div class="officer-sub">${T('personnel.rank.' + o.rank)}</div>
            <span class="officer-status" style="--rc:${statusColor(o.status)}">
              <span class="dot"></span>${T('personnel.status.' + o.status)}
            </span>
          </div>
        </div>

        <div class="officer-section">
          <div class="officer-section-head">${T('personnel.contact')}</div>
          <div class="officer-line"><span>${T('personnel.station')}</span><b>${station?.name || '—'}</b></div>
          <div class="officer-line"><span>${T('personnel.phone')}</span><b>${o.phone}</b></div>
          <div class="officer-line"><span>${T('personnel.years')}</span><b>${o.years_of_service}</b></div>
        </div>

        <div class="officer-section">
          <div class="officer-section-head">${T('personnel.certifications')}</div>
          <div class="officer-cert-chips">
            ${(o.certifications || []).map(c => `
              <span class="cert-chip">${T('training.course.' + c) !== 'training.course.' + c ? T('training.course.' + c) : c}</span>
            `).join('')}
          </div>
        </div>
      </div>`;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  // Helper exposed for shifts/fleet/training to query officers
  function listOfficers() { return getOfficers(); }
  function getById(id)    { return getOfficers().find(o => o.id === id); }

  return { init, refresh, listOfficers, getById };
})();

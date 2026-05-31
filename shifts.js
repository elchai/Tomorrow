/* ============================================================
   TOMORROW — Shift management tab
   Weekly calendar (7 days × 3 shifts), manual + auto assignment.
   Persists in State.shifts[weekISO]. Auto-generator does basic
   round-robin avoiding back-to-back night shifts.
   ============================================================ */

window.TomorrowShifts = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let weekOffset = 0;   // 0 = current week, -1 = previous, +1 = next

  const SHIFT_PRESETS = [
    { id: 'morning',   start: '06:00', end: '14:00', minOfficers: 4 },
    { id: 'afternoon', start: '14:00', end: '22:00', minOfficers: 5 },
    { id: 'night',     start: '22:00', end: '06:00', minOfficers: 3 }
  ];

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function weekStart(offset) {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1) + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeekData() {
    const start = weekStart(weekOffset);
    const key = isoWeek(start);
    if (!State.shifts) State.shifts = {};
    if (!State.shifts[key]) State.shifts[key] = autoGenerate(start);
    return { key, start, data: State.shifts[key] };
  }

  function autoGenerate(start) {
    // Round-robin assignment from officers list. Each shift gets minOfficers
    // entries. Avoid scheduling someone for back-to-back night shifts.
    const officers = window.TomorrowOfficers?.listOfficers?.() || [];
    const available = officers.filter(o => o.status !== 'leave' && o.status !== 'training');
    if (!available.length) return makeEmpty(start);
    const data = makeEmpty(start);
    let rrIdx = 0;
    const lastNightAssigned = {};   // officer_id → ISO day on which they did night
    for (let day = 0; day < 7; day++) {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + day);
      const dayIso = dayDate.toISOString().slice(0, 10);
      SHIFT_PRESETS.forEach(shift => {
        const slots = data[dayIso][shift.id];
        let attempts = 0;
        while (slots.length < shift.minOfficers && attempts < available.length * 2) {
          const cand = available[rrIdx % available.length];
          rrIdx++;
          attempts++;
          // back-to-back-night guard
          if (shift.id === 'night') {
            const prevDay = new Date(dayDate); prevDay.setDate(prevDay.getDate() - 1);
            const prevIso = prevDay.toISOString().slice(0, 10);
            if (lastNightAssigned[cand.id] === prevIso) continue;
          }
          if (!slots.includes(cand.id)) {
            slots.push(cand.id);
            if (shift.id === 'night') lastNightAssigned[cand.id] = dayIso;
          }
        }
      });
    }
    return data;
  }

  function makeEmpty(start) {
    const data = {};
    for (let day = 0; day < 7; day++) {
      const d = new Date(start); d.setDate(start.getDate() + day);
      const iso = d.toISOString().slice(0, 10);
      data[iso] = { morning: [], afternoon: [], night: [] };
    }
    return data;
  }

  function init() {
    panelEl = document.getElementById('tab-shifts');
    if (!panelEl) return;
    panelEl.classList.add('shifts-tab');
    panelEl.addEventListener('click', e => {
      if (e.target.closest('[data-shift-week="prev"]')) { weekOffset--; refresh(); return; }
      if (e.target.closest('[data-shift-week="next"]')) { weekOffset++; refresh(); return; }
      if (e.target.closest('[data-shift-week="today"]')) { weekOffset = 0; refresh(); return; }
      if (e.target.closest('[data-shift-regen]')) {
        const { key, start } = getWeekData();
        State.shifts[key] = autoGenerate(start);
        TomorrowApp.saveState();
        TomorrowApp.toast?.(T('shifts.regenerated'), 'success');
        TomorrowApp.logEvent?.('system', 3, T('shifts.regenLog'));
        refresh();
      }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('shifts', {
      onTabActivate: (name) => { if (name === 'shifts') refresh(); }
    });
  }

  function renderPanel() {
    const { key, start, data } = getWeekData();
    const days = Object.keys(data);
    const startTxt = start.toLocaleDateString((TomorrowI18n?.getMeta()?.locale) || 'en-US', { day: '2-digit', month: 'short' });
    const endDate = new Date(start); endDate.setDate(endDate.getDate() + 6);
    const endTxt = endDate.toLocaleDateString((TomorrowI18n?.getMeta()?.locale) || 'en-US', { day: '2-digit', month: 'short' });
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="calendar-days"></i><span>${T('menu.shifts')}</span></span>
        <span class="tab-counts">
          <span class="tab-count" style="--rc:var(--cyan)">${key}</span>
          <span class="tab-count">${startTxt} – ${endTxt}</span>
        </span>
      </div>

      <div class="tab-toolbar shifts-toolbar">
        <button class="filter-chip" data-shift-week="prev"><i data-lucide="chevron-left"></i> ${T('shifts.prevWeek')}</button>
        <button class="filter-chip" data-shift-week="today">${T('shifts.thisWeek')}</button>
        <button class="filter-chip" data-shift-week="next">${T('shifts.nextWeek')} <i data-lucide="chevron-right"></i></button>
        <button class="filter-chip primary" data-shift-regen><i data-lucide="refresh-cw"></i> ${T('shifts.autoGenerate')}</button>
      </div>

      <div class="shifts-grid">
        <div class="shifts-grid-header">
          <div class="shifts-corner"></div>
          ${days.map(iso => {
            const d = new Date(iso);
            const label = d.toLocaleDateString((TomorrowI18n?.getMeta()?.locale) || 'en-US', { weekday: 'short', day: '2-digit' });
            return `<div class="shifts-day-head">${label}</div>`;
          }).join('')}
        </div>
        ${SHIFT_PRESETS.map(shift => `
          <div class="shifts-row">
            <div class="shifts-row-label">
              <div class="shift-name">${T('shifts.preset.' + shift.id)}</div>
              <div class="shift-time">${shift.start}–${shift.end}</div>
            </div>
            ${days.map(iso => {
              const ids = data[iso][shift.id];
              const ofs = ids.map(id => window.TomorrowOfficers?.getById?.(id)).filter(Boolean);
              const understaffed = ids.length < shift.minOfficers;
              return `
                <div class="shifts-cell ${understaffed ? 'understaffed' : ''}">
                  <div class="shifts-cell-count">${ids.length}/${shift.minOfficers}</div>
                  <div class="shifts-cell-officers">
                    ${ofs.slice(0, 4).map(o => `<span class="officer-pill" title="${o.first_name} ${o.last_name}">${o.callsign}</span>`).join('')}
                    ${ofs.length > 4 ? `<span class="officer-pill more">+${ofs.length - 4}</span>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  return { init, refresh };
})();

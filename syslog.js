/* ============================================================
   TOMORROW — System Log drawer
   A richer view of every logged event in State.intel_log. Mirrors
   the audit-log pattern used by mabat-443 (chronological feed +
   category chips + lightweight filter). Reads from the same array
   that the Operational Log panel uses — this drawer is just a
   bigger, filterable viewport on the same data.
   ============================================================ */

window.TomorrowSysLog = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let isOpen  = false;
  let activeFilter = 'all';   // 'all' | 'model' | 'osint' | 'dispatch' | 'status' | 'system'

  function init() {
    panelEl = document.getElementById('tab-syslog');
    if (!panelEl) return;
    panelEl.classList.add('syslog-tab');
    refresh();
    panelEl.addEventListener('click', e => {
      const chip = e.target.closest('[data-syslog-filter]');
      if (chip) {
        activeFilter = chip.dataset.syslogFilter;
        refresh();
      }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('syslog', {
      onStationChange: refresh,
      onTabActivate: (name) => { if (name === 'syslog') refresh(); }
    });
  }

  // Event categories we surface as filter chips. The 'type' on each log
  // entry comes from TomorrowApp.logEvent — map it to a high-level group.
  const CATEGORIES = ['all', 'model', 'osint', 'dispatch', 'status', 'system'];

  function categoryOf(entryType) {
    switch (entryType) {
      case 'model':    return 'model';
      case 'osint':    return 'osint';
      case 'dispatch': return 'dispatch';
      case 'status':   return 'status';
      default:         return 'system';
    }
  }

  function filterEntries() {
    const all = (State.intel_log || []).slice().reverse(); // newest first
    if (activeFilter === 'all') return all;
    return all.filter(e => categoryOf(e.type) === activeFilter);
  }

  function categoryColor(cat) {
    switch (cat) {
      case 'model':    return '#b855ff';
      case 'osint':    return 'var(--cyan)';
      case 'dispatch': return 'var(--police-br)';
      case 'status':   return 'var(--low)';
      default:         return 'var(--text-dim)';
    }
  }

  function renderPanel() {
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="scroll-text"></i><span>${T('syslog.title')}</span></span>
      </div>

      <!-- Filter chips -->
      <div class="syslog-filters">
        ${CATEGORIES.map(cat => `
          <button class="syslog-chip ${cat === activeFilter ? 'active' : ''}" data-syslog-filter="${cat}" style="--rc:${categoryColor(cat)}">
            ${T('syslog.filter.' + cat)}
          </button>
        `).join('')}
      </div>

      <div id="syslog-body" class="scroll-list syslog-body">
        ${renderEntries()}
      </div>
    `;
  }

  function renderEntries() {
    const entries = filterEntries();
    if (entries.length === 0) {
      return `<div class="empty-state">${T('syslog.empty')}</div>`;
    }
    return entries.map(e => {
      const cat = categoryOf(e.type);
      const color = categoryColor(cat);
      // Urgency drives the left border accent — keeps critical / model
      // events visually distinguishable inside a long list.
      const u = e.urgency || 4;
      return `
        <div class="syslog-row" style="--rc:${color}; --uc:var(--${u === 1 ? 'critical' : u === 2 ? 'high' : u === 3 ? 'medium' : 'low'});">
          <div class="syslog-row-meta">
            <span class="syslog-cat" style="background: color-mix(in srgb, ${color} 14%, transparent); border-color: ${color}; color: ${color};">${T('syslog.filter.' + cat)}</span>
            <span class="syslog-time">${escapeHtml(e.time || '')}</span>
          </div>
          <div class="syslog-text">${e.text || ''}</div>
        </div>`;
    }).join('');
  }

  function escapeHtml(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  // Live-update while the syslog tab is the active one — re-render every
  // 1.5s so new events stream in without manual refresh.
  setInterval(() => {
    if (TomorrowRouter?.getActiveTab() === 'syslog') refresh();
  }, 1500);

  return { init, refresh };
})();

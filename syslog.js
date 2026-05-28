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
    injectHUDButton();
    buildPanel();
    TomorrowApp.register('syslog', { onStationChange: refresh });
  }

  function injectHUDButton() {
    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;
    const btn = document.createElement('button');
    btn.id = 'btn-syslog';
    btn.className = 'icon-btn';
    btn.title = T('syslog.title');
    btn.style.marginInlineEnd = '8px';
    btn.innerHTML = '<i data-lucide="scroll-text"></i>';
    muteBtn.parentElement.insertBefore(btn, muteBtn);
    btn.addEventListener('click', toggle);
  }

  function buildPanel() {
    panelEl = document.createElement('aside');
    panelEl.id = 'syslog-panel';
    panelEl.className = 'panel drawer-panel';
    panelEl.innerHTML = renderPanel();
    document.getElementById('layout').appendChild(panelEl);

    panelEl.addEventListener('click', e => {
      if (e.target.closest('#btn-close-syslog')) toggle();
      const chip = e.target.closest('[data-syslog-filter]');
      if (chip) {
        activeFilter = chip.dataset.syslogFilter;
        refresh();
      }
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
      <div class="panel-head" style="flex-shrink: 0;">
        <span class="panel-title"><i data-lucide="scroll-text"></i><span>${T('syslog.title')}</span></span>
        <button id="btn-close-syslog" class="icon-btn" style="border:none; background:transparent;"><i data-lucide="x"></i></button>
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

  function toggle() {
    isOpen = !isOpen;
    panelEl.classList.toggle('open', isOpen);
    const btn = document.getElementById('btn-syslog');
    if (btn) btn.classList.toggle('active', isOpen);
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
    if (isOpen) refresh();
  }

  function close() { if (isOpen) toggle(); }
  function open()  { if (!isOpen) toggle(); }

  // Live-update while drawer is open: re-render once a second so new events
  // (model re-runs, OSINT pushes) show up without manual refresh.
  setInterval(() => { if (isOpen) refresh(); }, 1500);

  return { init, toggle, open, close };
})();

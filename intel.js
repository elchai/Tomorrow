/* ============================================================
   TOMORROW — Intelligence / Target Profile Drawer
   B2B intel panel: per-target profile fusing criminal record,
   last known cellular ping, and OSINT mentions across channels.
   Mirrors the side-drawer pattern of analytics.js.
   ============================================================ */

window.TomorrowIntel = (function () {

  let panelEl = null;
  let isOpen = false;
  let activeTargetId = 'T-1042';

  // Target dossiers now come from the active country profile (countries.js).
  // Getter rather than const so a country toggle is picked up on next open.
  function getTargets() {
    return (CONFIG.INTEL_TARGETS && CONFIG.INTEL_TARGETS.length) ? CONFIG.INTEL_TARGETS : [];
  }
  // Backwards-compatible alias so the rest of this file can still say TARGETS.
  const TARGETS = new Proxy([], {
    get(_t, prop) {
      const live = getTargets();
      if (prop === 'length') return live.length;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return live[+prop];
      const v = Array.prototype[prop];
      return typeof v === 'function' ? v.bind(live) : live[prop];
    }
  });

  function init() {
    injectHUDButton();
    buildPanel();
    TomorrowApp.register('intel', {});
  }

  function injectHUDButton() {
    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;
    const btn = document.createElement('button');
    btn.id = 'btn-intel';
    btn.className = 'icon-btn';
    btn.title = T('intel.title');
    btn.style.marginInlineEnd = '8px';
    btn.innerHTML = '<i data-lucide="scan-face"></i>';
    muteBtn.parentElement.insertBefore(btn, muteBtn);
    btn.addEventListener('click', toggle);
  }

  function buildPanel() {
    panelEl = document.createElement('aside');
    panelEl.id = 'intel-panel';
    panelEl.className = 'panel drawer-panel';
    panelEl.innerHTML = renderPanel();
    document.getElementById('layout').appendChild(panelEl);

    panelEl.addEventListener('click', e => {
      if (e.target.closest('#btn-close-intel')) toggle();
      const t = e.target.closest('[data-target-id]');
      if (t) { activeTargetId = t.dataset.targetId; refresh(); }
    });
  }

  function renderPanel() {
    return `
      <div class="panel-head" style="flex-shrink: 0;">
        <span class="panel-title"><i data-lucide="scan-face"></i><span>${T('intel.title')}</span></span>
        <button id="btn-close-intel" class="icon-btn" style="border:none; background:transparent;"><i data-lucide="x"></i></button>
      </div>

      <!-- Target picker -->
      <div class="intel-targets" style="display:flex; gap:6px; padding:10px 14px; border-bottom: 1px solid var(--line-soft); overflow-x:auto;">
        ${TARGETS.map(t => `
          <button class="intel-target-chip ${t.id === activeTargetId ? 'active' : ''}" data-target-id="${t.id}">
            ${t.id} · ${T(t.alias)}
          </button>
        `).join('')}
      </div>

      <div id="intel-body" class="scroll-list" style="padding:14px 16px; flex:1; overflow-y:auto;">
        ${renderTarget()}
      </div>
    `;
  }

  function renderTarget() {
    const t = TARGETS.find(x => x.id === activeTargetId) || TARGETS[0];
    const isActive = ['פעיל', 'Ativo', 'Active'].includes(t.status);
    return `
      <!-- Profile card -->
      <div class="intel-profile">
        <div class="intel-profile-head">
          <div class="intel-avatar"><i data-lucide="user"></i></div>
          <div class="intel-profile-meta">
            <div class="intel-profile-id">${t.id}</div>
            <div class="intel-profile-alias">${T(t.alias)}</div>
            <div class="intel-profile-sub">${T('intel.age')} ${t.age} · <span class="intel-status ${isActive ? 'active' : ''}">${T(t.status)}</span></div>
          </div>
        </div>
        <div class="intel-affiliation">${T(t.affiliation)}</div>
      </div>

      <!-- Criminal record -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="gavel"></i>${T('intel.record')}</div>
        <ul class="intel-record">
          ${t.record.map(r => `<li>${T(r)}</li>`).join('')}
        </ul>
      </div>

      <!-- Last cellular ping -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="map-pin"></i>${T('intel.lastCell')}</div>
        <div class="intel-cell">
          <div class="intel-cell-line"><span class="intel-cell-lbl">${T('intel.location') !== 'intel.location' ? T('intel.location') : 'Location'}</span><span class="intel-cell-val">${t.last_cell.lat.toFixed(4)}, ${t.last_cell.lng.toFixed(4)}</span></div>
          <div class="intel-cell-line"><span class="intel-cell-lbl">${T('intel.precision') !== 'intel.precision' ? T('intel.precision') : 'Precision'}</span><span class="intel-cell-val">~${t.last_cell.precision}m</span></div>
          <div class="intel-cell-line"><span class="intel-cell-lbl">${T('intel.when') !== 'intel.when' ? T('intel.when') : 'When'}</span><span class="intel-cell-val">${T(t.last_cell.when)}</span></div>
          <button class="intel-focus-btn" onclick="TomorrowMap.getMap().flyTo([${t.last_cell.lat}, ${t.last_cell.lng}], 17, {duration:1.1}); TomorrowIntel.close();">
            <i data-lucide="navigation"></i><span>${T('intel.locate')}</span>
          </button>
        </div>
      </div>

      <!-- OSINT mentions feed -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="radio-tower"></i>${T('intel.osintMentions')}</div>
        <div class="intel-osint">
          ${t.osint.map(o => `
            <div class="intel-osint-row">
              <a href="https://t.me/${o.src.slice(1)}" target="_blank" rel="noopener noreferrer" class="src-link">${o.src}<i data-lucide="external-link"></i></a>
              <div class="intel-osint-text">"${T(o.text)}"</div>
              <div class="intel-osint-when">${T(o.when)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="intel-disclaimer">
        <i data-lucide="info"></i>
        ${T('intel.disclaimer')}
      </div>
    `;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  function toggle() {
    isOpen = !isOpen;
    panelEl.classList.toggle('open', isOpen);
    const btn = document.getElementById('btn-intel');
    if (btn) btn.classList.toggle('active', isOpen);
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
    if (isOpen) TomorrowApp.renderIcons();
  }

  function close() { if (isOpen) toggle(); }
  function open()  { if (!isOpen) toggle(); }

  return { init, toggle, open, close };
})();

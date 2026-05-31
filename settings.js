/* ============================================================
   TOMORROW — Settings tab
   Local preferences (default tab, theme, sidebar collapse) +
   data management (Export State JSON, Reset Demo, Clear Cache)
   + About / version info. Settings persist separately from
   the main State blob so they survive demo resets.
   ============================================================ */

window.TomorrowSettings = (function () {

  const STORAGE_KEY = 'tomorrow_settings_v1';
  const DEFAULTS = {
    defaultTab: 'operations',
    theme: 'dark',
    soundEnabled: true,
    showInsightsToast: true
  };

  let panelEl = null;
  let prefs = { ...DEFAULTS };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') prefs = { ...DEFAULTS, ...parsed };
    } catch (e) { /* ignore corrupt prefs — keep defaults */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
    catch (e) { console.warn('settings save failed', e); }
  }

  function get(key)        { return prefs[key]; }
  function set(key, value) { prefs[key] = value; save(); }

  function init() {
    panelEl = document.getElementById('tab-settings');
    if (!panelEl) return;
    panelEl.classList.add('settings-tab');
    load();
    panelEl.addEventListener('click', e => {
      const action = e.target.closest('[data-settings-action]')?.dataset.settingsAction;
      if (action) handleAction(action);
    });
    panelEl.addEventListener('change', e => {
      if (e.target.matches('[data-pref]')) {
        const k = e.target.dataset.pref;
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        set(k, v);
        TomorrowApp?.toast?.(T('settings.saved'), 'success', 1800);
      }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('settings', {
      onTabActivate: (name) => { if (name === 'settings') refresh(); }
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'export': {
        const blob = new Blob([JSON.stringify(window.TomorrowState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tomorrow-state-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        TomorrowApp?.toast?.(T('settings.exported'), 'success');
        TomorrowApp?.logEvent?.('system', 3, T('settings.exportLog'));
        break;
      }
      case 'reset': {
        if (!window.confirm(T('settings.resetConfirm'))) return;
        try {
          localStorage.removeItem(CONFIG.STORAGE_KEY);
          TomorrowApp?.toast?.(T('settings.resetDone'), 'warning', 2500);
          setTimeout(() => location.reload(), 800);
        } catch (e) { /* ignore */ }
        break;
      }
      case 'clearCache': {
        if (!window.confirm(T('settings.clearConfirm'))) return;
        try {
          if ('caches' in window) caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
          if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
          TomorrowApp?.toast?.(T('settings.cacheCleared'), 'success', 2500);
        } catch (e) { /* ignore */ }
        break;
      }
    }
  }

  function renderPanel() {
    const storageBytes = window.TomorrowArchive?.estimateSize?.() || 0;
    const storageKb = (storageBytes / 1024).toFixed(1);
    const historyWeeks = Object.keys(window.TomorrowState?.history || {}).length;
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="settings"></i><span>${T('menu.settings')}</span></span>
      </div>
      <div class="tab-body">
        <div class="settings-grid">

          <div class="settings-card">
            <div class="settings-card-head"><i data-lucide="sliders-horizontal"></i><span>${T('settings.prefs')}</span></div>
            <label class="settings-row">
              <span>${T('settings.defaultTab')}</span>
              <select data-pref="defaultTab" class="settings-select">
                ${['operations','intel','lpr','analytics','personnel','shifts','fleet','training','integrations','syslog']
                  .map(t => `<option value="${t}" ${prefs.defaultTab===t?'selected':''}>${T('menu.'+t)}</option>`).join('')}
              </select>
            </label>
            <label class="settings-row">
              <span>${T('settings.sound')}</span>
              <input type="checkbox" data-pref="soundEnabled" ${prefs.soundEnabled?'checked':''} />
            </label>
            <label class="settings-row">
              <span>${T('settings.insightsToast')}</span>
              <input type="checkbox" data-pref="showInsightsToast" ${prefs.showInsightsToast?'checked':''} />
            </label>
          </div>

          <div class="settings-card">
            <div class="settings-card-head"><i data-lucide="database"></i><span>${T('settings.data')}</span></div>
            <div class="settings-stat"><span>${T('settings.storage')}</span><b>${storageKb} KB</b></div>
            <div class="settings-stat"><span>${T('settings.archived')}</span><b>${historyWeeks} ${T('settings.weeks')}</b></div>
            <div class="settings-actions">
              <button class="filter-chip primary" data-settings-action="export">
                <i data-lucide="download"></i>${T('settings.export')}
              </button>
              <button class="filter-chip" data-settings-action="clearCache">
                <i data-lucide="trash-2"></i>${T('settings.clearCache')}
              </button>
              <button class="filter-chip" data-settings-action="reset" style="--rc:var(--high); border-color: rgba(255,122,24,.5); color: var(--high);">
                <i data-lucide="alert-triangle"></i>${T('settings.reset')}
              </button>
            </div>
          </div>

          <div class="settings-card">
            <div class="settings-card-head"><i data-lucide="info"></i><span>${T('settings.about')}</span></div>
            <div class="settings-stat"><span>${T('settings.version')}</span><b>TOMORROW v0.7</b></div>
            <div class="settings-stat"><span>${T('settings.country')}</span><b>${window.TomorrowCountries?.getName?.() || '—'}</b></div>
            <div class="settings-stat"><span>${T('settings.dev')}</span><b><a href="https://www.daghazahav.com" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);text-decoration:none">www.daghazahav.com</a></b></div>
          </div>

        </div>
      </div>
    `;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  return { init, refresh, get, set, load };
})();

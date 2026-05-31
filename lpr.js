/* ============================================================
   TOMORROW — LPR (License Plate Recognition) Alerts Drawer
   Real-time feed of camera hits cross-checked against the
   national stolen-vehicle registry (stolencar). Each alert: shot,
   camera location, plate, status, and one-click dispatch.
   ============================================================ */

window.TomorrowLpr = (function () {

  let panelEl = null;
  let isOpen  = false;

  // LPR alerts now come from the active country profile (countries.js).
  function getAlerts() {
    return (CONFIG.LPR_ALERTS && CONFIG.LPR_ALERTS.length) ? CONFIG.LPR_ALERTS : [];
  }
  const ALERTS = new Proxy([], {
    get(_t, prop) {
      const live = getAlerts();
      if (prop === 'length') return live.length;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return live[+prop];
      const v = Array.prototype[prop];
      return typeof v === 'function' ? v.bind(live) : live[prop];
    }
  });

  function init() {
    panelEl = document.getElementById('tab-lpr');
    if (!panelEl) return;
    panelEl.classList.add('lpr-tab');
    refresh();
    panelEl.addEventListener('click', e => {
      const focusBtn = e.target.closest('[data-focus]');
      if (focusBtn) {
        const a = ALERTS.find(x => x.id === focusBtn.dataset.focus);
        if (a && window.TomorrowMap) {
          TomorrowRouter?.switchTab('operations');
          setTimeout(() => TomorrowMap.getMap().flyTo([a.camera.lat, a.camera.lng], 17, { duration: 1.1 }), 250);
        }
      }
      const dispatchBtn = e.target.closest('[data-dispatch]');
      if (dispatchBtn) {
        const a = ALERTS.find(x => x.id === dispatchBtn.dataset.dispatch);
        if (a && window.TomorrowDispatch) TomorrowDispatch.dispatchToLpr(a);
      }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('lpr', {
      onTabActivate: (name) => { if (name === 'lpr') refresh(); }
    });
  }

  function updateAlertStatus(alertId, newStatus, callsign) {
    const a = ALERTS.find(x => x.id === alertId);
    if (a) {
      a.status = newStatus;
      if (newStatus === 'secured') {
        a.dispatchable = false;
        a.match_src = window.TomorrowI18n ? TomorrowI18n.t('toast.lprResolved', { cs: callsign || '—' }) : `Resolved by ${callsign}`;
        a.mins_ago = 0;
      }
      refresh();
    }
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  function renderPanel() {
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="camera"></i><span>${T('lpr.title')}</span></span>
      </div>

      <div class="lpr-summary">
        <span class="lpr-summary-stat"><span class="num" style="color:var(--critical)">${ALERTS.filter(a => a.status === 'stolen').length}</span> ${T('lpr.status.stolen')}</span>
        <span class="lpr-summary-stat"><span class="num" style="color:var(--high)">${ALERTS.filter(a => a.status === 'flagged').length}</span> ${T('lpr.status.flagged')}</span>
        <span class="lpr-summary-stat"><span class="num" style="color:var(--low)">${ALERTS.filter(a => a.status === 'clean').length}</span> ${T('lpr.status.clean')}</span>
      </div>

      <div id="lpr-feed" class="scroll-list" style="padding:10px 12px; flex:1; overflow-y:auto;">
        ${ALERTS.map(a => renderAlert(a)).join('')}
      </div>

      <div class="intel-disclaimer">
        <i data-lucide="info"></i>
        ${T('lpr.disclaimer')}
      </div>
    `;
  }

  function renderAlert(a) {
    const cls = `lpr-alert lpr-${a.status}`;
    const statusLbl = a.status === 'stolen' ? T('lpr.status.stolen')
                    : a.status === 'flagged' ? T('lpr.status.flagged')
                    : a.status === 'secured' ? T('lpr.status.secured')
                    : T('lpr.status.clean');
    const eta = TomorrowApp.nearestEta(a.camera.lat, a.camera.lng);
    return `
      <div class="${cls}">
        <div class="lpr-row-top">
          <div class="lpr-photo"><i data-lucide="car-front"></i></div>
          <div class="lpr-meta">
            <div class="lpr-plate">${a.plate}</div>
            <div class="lpr-model">${T(a.model)}</div>
          </div>
          <div class="lpr-status">${statusLbl}</div>
        </div>
        <div class="lpr-camera"><i data-lucide="map-pin"></i><span>${T(a.camera.name)}</span></div>
        <div class="lpr-match"><i data-lucide="link"></i><span>${T(a.match_src)}</span></div>
        ${eta ? `<div class="lpr-eta"><i data-lucide="timer"></i><span>ETA <b>${eta.eta} ${T('forecast.eta')}</b> · ${T(eta.station.name)} (${eta.km.toFixed(1)} km)</span></div>` : ''}
        <div class="lpr-row-bottom">
          <span class="lpr-when"><i data-lucide="clock"></i>${T('lpr.minsAgo', { n: a.mins_ago })}</span>
          <div class="lpr-actions">
            <button class="lpr-btn" data-focus="${a.id}"><i data-lucide="navigation"></i>${T('lpr.focus')}</button>
            ${a.dispatchable ? `<button class="lpr-btn primary" data-dispatch="${a.id}"><i data-lucide="siren"></i>${T('lpr.dispatch')}</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  return { init, refresh, updateAlertStatus };
})();

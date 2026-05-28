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
    injectHUDButton();
    buildPanel();
    updateBadge();
    TomorrowApp.register('lpr', {});
  }

  function injectHUDButton() {
    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;
    const btn = document.createElement('button');
    btn.id = 'btn-lpr';
    btn.className = 'icon-btn';
    btn.title = T('lpr.title');
    btn.style.marginInlineEnd = '8px';
    btn.innerHTML = `<i data-lucide="camera"></i><span class="hud-badge" id="lpr-badge">0</span>`;
    muteBtn.parentElement.insertBefore(btn, muteBtn);
    btn.addEventListener('click', toggle);
  }

  function updateBadge() {
    const el = document.getElementById('lpr-badge');
    if (!el) return;
    const hot = ALERTS.filter(a => a.status === 'stolen' || a.status === 'flagged').length;
    el.textContent = hot;
    el.classList.toggle('hot', hot > 0);
  }

  function buildPanel() {
    panelEl = document.createElement('aside');
    panelEl.id = 'lpr-panel';
    panelEl.className = 'panel drawer-panel';
    panelEl.innerHTML = renderPanel();
    document.getElementById('layout').appendChild(panelEl);

    panelEl.addEventListener('click', e => {
      if (e.target.closest('#btn-close-lpr')) toggle();
      const focusBtn = e.target.closest('[data-focus]');
      if (focusBtn) {
        const a = ALERTS.find(x => x.id === focusBtn.dataset.focus);
        if (a && window.TomorrowMap) {
          TomorrowMap.getMap().flyTo([a.camera.lat, a.camera.lng], 17, { duration: 1.1 });
          toggle();
        }
      }
      const dispatchBtn = e.target.closest('[data-dispatch]');
      if (dispatchBtn) {
        const a = ALERTS.find(x => x.id === dispatchBtn.dataset.dispatch);
        if (!a) return;
        if (window.TomorrowDispatch) {
          TomorrowDispatch.dispatchToLpr(a);
        }
      }
    });
  }

  function renderPanel() {
    return `
      <div class="panel-head" style="flex-shrink: 0;">
        <span class="panel-title"><i data-lucide="camera"></i><span>${T('lpr.title')}</span></span>
        <button id="btn-close-lpr" class="icon-btn" style="border:none; background:transparent;"><i data-lucide="x"></i></button>
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
            <div class="lpr-model">${a.model}</div>
          </div>
          <div class="lpr-status">${statusLbl}</div>
        </div>
        <div class="lpr-camera"><i data-lucide="map-pin"></i><span>${a.camera.name}</span></div>
        <div class="lpr-match"><i data-lucide="link"></i><span>${a.match_src}</span></div>
        ${eta ? `<div class="lpr-eta"><i data-lucide="timer"></i><span>ETA <b>${eta.eta} ${T('forecast.eta')}</b> · ${eta.station.name} (${eta.km.toFixed(1)} km)</span></div>` : ''}
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

  function updateAlertStatus(alertId, newStatus, callsign) {
    const a = ALERTS.find(x => x.id === alertId);
    if (a) {
      a.status = newStatus;
      if (newStatus === 'secured') {
        a.dispatchable = false;
        a.match_src = window.TomorrowI18n ? TomorrowI18n.t('toast.lprResolved', { cs: callsign || '—' }) : `Resolved successfully by ${callsign || 'patrol'}`;
        a.mins_ago = 0;
      }
      updateBadge();
      if (panelEl) {
        panelEl.innerHTML = renderPanel();
        TomorrowApp.renderIcons();
      }
    }
  }

  function toggle() {
    isOpen = !isOpen;
    panelEl.classList.toggle('open', isOpen);
    const btn = document.getElementById('btn-lpr');
    if (btn) btn.classList.toggle('active', isOpen);
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
    if (isOpen) TomorrowApp.renderIcons();
  }

  function close() { if (isOpen) toggle(); }
  function open()  { if (!isOpen) toggle(); }

  return { init, toggle, open, close, updateAlertStatus };
})();

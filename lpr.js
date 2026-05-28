/* ============================================================
   TOMORROW — LPR (License Plate Recognition) Alerts Drawer
   Real-time feed of camera hits cross-checked against the
   national stolen-vehicle registry (stolencar). Each alert: shot,
   camera location, plate, status, and one-click dispatch.
   ============================================================ */

window.TomorrowLpr = (function () {

  let panelEl = null;
  let isOpen  = false;

  // ---- Demo LPR feed (placeholder; later wired to live camera grid + stolencar API) ----
  const ALERTS = [
    {
      id: 'lpr-7012', plate: '12-345-67', mins_ago: 2,
      camera: { name: 'מצלמה 14 · אלנבי × רוטשילד', lat: 32.0640, lng: 34.7725 },
      status: 'stolen',   model: 'Hyundai i20 לבן',  match_src: 'דמו · stolencar · גניבת רכב 2026-05-20',
      dispatchable: true
    },
    {
      id: 'lpr-7011', plate: '88-219-44', mins_ago: 6,
      camera: { name: 'מצלמה 22 · דיזנגוף סנטר',   lat: 32.0760, lng: 34.7751 },
      status: 'flagged',  model: 'Kia Picanto אפור', match_src: 'דמו · מודיעין · רכב משמש בעבירות חוזרות',
      dispatchable: true
    },
    {
      id: 'lpr-7010', plate: '45-901-22', mins_ago: 11,
      camera: { name: 'מצלמה 08 · יפו / שוק הפשפשים', lat: 32.0530, lng: 34.7530 },
      status: 'clean',    model: 'Toyota Corolla שחור', match_src: '—',
      dispatchable: false
    },
    {
      id: 'lpr-7009', plate: '63-882-91', mins_ago: 18,
      camera: { name: 'מצלמה 31 · נווה שאנן',       lat: 32.0590, lng: 34.7790 },
      status: 'stolen',   model: 'Mazda 3 כסוף',     match_src: 'דמו · stolencar · גניבת רכב 2026-05-22',
      dispatchable: true
    },
    {
      id: 'lpr-7008', plate: '77-114-58', mins_ago: 27,
      camera: { name: 'מצלמה 17 · פלורנטין',         lat: 32.0570, lng: 34.7700 },
      status: 'flagged',  model: 'Volkswagen Polo אדום', match_src: 'דמו · BOLO · התראת מפקד',
      dispatchable: true
    }
  ];

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
    btn.title = 'התראות LPR — זיהוי לוחיות רישוי';
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
        <span class="panel-title"><i data-lucide="camera"></i><span>התראות LPR</span></span>
        <button id="btn-close-lpr" class="icon-btn" style="border:none; background:transparent;" title="סגור"><i data-lucide="x"></i></button>
      </div>

      <div class="lpr-summary">
        <span class="lpr-summary-stat"><span class="num" style="color:var(--critical)">${ALERTS.filter(a => a.status === 'stolen').length}</span> גנובים</span>
        <span class="lpr-summary-stat"><span class="num" style="color:var(--high)">${ALERTS.filter(a => a.status === 'flagged').length}</span> מסומנים</span>
        <span class="lpr-summary-stat"><span class="num" style="color:var(--low)">${ALERTS.filter(a => a.status === 'clean').length}</span> נקיים</span>
      </div>

      <div id="lpr-feed" class="scroll-list" style="padding:10px 12px; flex:1; overflow-y:auto;">
        ${ALERTS.map(a => renderAlert(a)).join('')}
      </div>

      <div class="intel-disclaimer">
        <i data-lucide="info"></i>
        פיד דמו. הצלבה בפועל מול stolencar.gov.il מצריכה אינטגרציית API משטרת ישראל.
      </div>
    `;
  }

  function renderAlert(a) {
    const cls = `lpr-alert lpr-${a.status}`;
    const statusLbl = a.status === 'stolen' ? 'רכב גנוב' : (a.status === 'flagged' ? 'מסומן' : (a.status === 'secured' ? 'טופל בהצלחה' : 'נקי'));
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
        ${eta ? `<div class="lpr-eta"><i data-lucide="timer"></i><span>ETA <b>${eta.eta} דק׳</b> מ${eta.station.name} (${eta.km.toFixed(1)} ק״מ)</span></div>` : ''}
        <div class="lpr-row-bottom">
          <span class="lpr-when"><i data-lucide="clock"></i>לפני ${a.mins_ago} דק׳</span>
          <div class="lpr-actions">
            <button class="lpr-btn" data-focus="${a.id}"><i data-lucide="navigation"></i>מקד</button>
            ${a.dispatchable ? `<button class="lpr-btn primary" data-dispatch="${a.id}"><i data-lucide="siren"></i>הזנק</button>` : ''}
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
        a.match_src = `טופל בהצלחה ע״י צוות ${callsign || 'סיור'}`;
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

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

  // ---- Demo target dossier (placeholder; later wired to real OSINT pipeline) ----
  const TARGETS = [
    {
      id: 'T-1042',
      alias: 'הצעיר מפלורנטין',
      age: 24, status: 'פעיל',
      affiliation: 'שיוך ארגוני: ארגון פשיעה דרום',
      record: ['פריצה לבית · 2024', 'תקיפה · 2025', 'איומים · 2026'],
      last_cell: { lat: 32.0572, lng: 34.7705, when: 'לפני 17 דק׳', precision: 250 },
      osint: [
        { src: '@florentin_live_demo',         text: 'נראה ברחוב ויטל אתמול בלילה',                              when: 'לפני 4 שע׳' },
        { src: '@south_tlv_news_demo',         text: 'דיווח על תקרית עם אדם בעל מאפיינים דומים סמוך לתחנה',  when: 'לפני 12 שע׳' },
        { src: '@telaviv_police_scanner_demo', text: 'יחידת סיור מתבקשת לאיתור — איתות חיובי במצלמת LPR',     when: 'לפני יום' }
      ]
    },
    {
      id: 'T-1107',
      alias: 'הסוחר מנווה שאנן',
      age: 31, status: 'מעקב מודיעיני',
      affiliation: 'שיוך ארגוני: רשת סחר סמים',
      record: ['החזקת סמים בכוונת מכר · 2023', 'הלבנת הון · 2025'],
      last_cell: { lat: 32.0592, lng: 34.7795, when: 'לפני 3 שעות', precision: 400 },
      osint: [
        { src: '@south_tlv_news_demo', text: 'התקהלות חשודה סמוך למתחם התחנה',     when: 'לפני 6 שע׳' },
        { src: '@city_watch_tlv_demo', text: 'דיווח על עסקה במזומן בכיכר לבנה',    when: 'לפני יום' }
      ]
    },
    {
      id: 'T-1213',
      alias: 'הכייס מדיזנגוף',
      age: 19, status: 'פעיל',
      affiliation: 'יחיד · ללא שיוך ארגוני',
      record: ['גניבה · 2025 (×3)', 'כיסנות · 2026'],
      last_cell: { lat: 32.0758, lng: 34.7751, when: 'לפני 42 דק׳', precision: 180 },
      osint: [
        { src: '@city_watch_tlv_demo', text: 'התראה על כיסנות בדיזנגוף סנטר בשעות הצהריים', when: 'לפני שעתיים' }
      ]
    }
  ];

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
    btn.title = 'תיק יעד מודיעיני';
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
        <span class="panel-title"><i data-lucide="scan-face"></i><span>תיק יעד מודיעיני</span></span>
        <button id="btn-close-intel" class="icon-btn" style="border:none; background:transparent;" title="סגור"><i data-lucide="x"></i></button>
      </div>

      <!-- Target picker -->
      <div class="intel-targets" style="display:flex; gap:6px; padding:10px 14px; border-bottom: 1px solid var(--line-soft); overflow-x:auto;">
        ${TARGETS.map(t => `
          <button class="intel-target-chip ${t.id === activeTargetId ? 'active' : ''}" data-target-id="${t.id}">
            ${t.id} · ${t.alias}
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
    return `
      <!-- Profile card -->
      <div class="intel-profile">
        <div class="intel-profile-head">
          <div class="intel-avatar"><i data-lucide="user"></i></div>
          <div class="intel-profile-meta">
            <div class="intel-profile-id">${t.id}</div>
            <div class="intel-profile-alias">${t.alias}</div>
            <div class="intel-profile-sub">גיל ${t.age} · <span class="intel-status ${t.status === 'פעיל' ? 'active' : ''}">${t.status}</span></div>
          </div>
        </div>
        <div class="intel-affiliation">${t.affiliation}</div>
      </div>

      <!-- Criminal record -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="gavel"></i>רקע פלילי</div>
        <ul class="intel-record">
          ${t.record.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>

      <!-- Last cellular ping -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="map-pin"></i>איכון סלולארי אחרון</div>
        <div class="intel-cell">
          <div class="intel-cell-line"><span class="intel-cell-lbl">מיקום</span><span class="intel-cell-val">${t.last_cell.lat.toFixed(4)}, ${t.last_cell.lng.toFixed(4)}</span></div>
          <div class="intel-cell-line"><span class="intel-cell-lbl">דיוק</span><span class="intel-cell-val">~${t.last_cell.precision}מ׳</span></div>
          <div class="intel-cell-line"><span class="intel-cell-lbl">מתי</span><span class="intel-cell-val">${t.last_cell.when}</span></div>
          <button class="intel-focus-btn" onclick="TomorrowMap.getMap().flyTo([${t.last_cell.lat}, ${t.last_cell.lng}], 17, {duration:1.1}); TomorrowIntel.close();">
            <i data-lucide="navigation"></i><span>מקד על המפה</span>
          </button>
        </div>
      </div>

      <!-- OSINT mentions feed -->
      <div class="intel-section">
        <div class="intel-section-head"><i data-lucide="radio-tower"></i>אזכורים ב-OSINT</div>
        <div class="intel-osint">
          ${t.osint.map(o => `
            <div class="intel-osint-row">
              <a href="https://t.me/${o.src.slice(1)}" target="_blank" rel="noopener noreferrer" class="src-link">${o.src}<i data-lucide="external-link"></i></a>
              <div class="intel-osint-text">"${o.text}"</div>
              <div class="intel-osint-when">${o.when}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="intel-disclaimer">
        <i data-lucide="info"></i>
        איכון/האזנות סלולאריות מותנים בצו שיפוטי. הנתונים כאן הם דמו לצורך תכן UI.
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

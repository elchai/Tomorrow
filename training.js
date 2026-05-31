/* ============================================================
   TOMORROW — Training & Certifications tab
   Course catalog + officer compliance matrix + upcoming expirations.
   Course definitions are global (CONFIG-independent here); officer-
   level certification records live on each officer object (managed
   by officers.js).
   ============================================================ */

window.TomorrowTraining = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let activeTab = 'catalog';   // 'catalog' | 'matrix' | 'expirations'

  // Catalog — stable course IDs (used as cert keys on each officer record)
  const COURSES = [
    { id: 'weapons_basic',      category: 'weapons',  expiry_months: 12 },
    { id: 'weapons_advanced',   category: 'weapons',  expiry_months: 24 },
    { id: 'driving_emergency',  category: 'driving',  expiry_months: 36 },
    { id: 'first_aid',          category: 'medical',  expiry_months: 24 },
    { id: 'k9_handling',        category: 'k9',       expiry_months: 36 },
    { id: 'swat_tactical',      category: 'tactical', expiry_months: 24 },
    { id: 'language_arabic',    category: 'language', expiry_months: 0 },
    { id: 'language_english',   category: 'language', expiry_months: 0 }
  ];

  function getCertRecords() {
    // Synthesize a flat list of officer×course rows from officers + their cert list.
    // Each row gets a deterministic completion date + expiry computed from now.
    if (!window.TomorrowOfficers) return [];
    const officers = TomorrowOfficers.listOfficers();
    const records = [];
    officers.forEach((o, oi) => {
      (o.certifications || []).forEach((cid, ci) => {
        const course = COURSES.find(c => c.id === cid);
        if (!course) return;
        // Deterministic: completion was N months ago where N rotates per officer×course
        const monthsAgo = ((oi + ci * 3) % 30) + 1;
        const completed = new Date();
        completed.setMonth(completed.getMonth() - monthsAgo);
        const expires = course.expiry_months ? new Date(completed) : null;
        if (expires) expires.setMonth(expires.getMonth() + course.expiry_months);
        records.push({
          officer_id: o.id,
          callsign: o.callsign,
          officer_name: `${o.first_name} ${o.last_name}`,
          course_id: cid,
          category: course.category,
          completed: completed.toISOString().slice(0, 10),
          expires: expires ? expires.toISOString().slice(0, 10) : null,
          days_to_expiry: expires ? Math.round((expires - new Date()) / (1000 * 60 * 60 * 24)) : null
        });
      });
    });
    return records;
  }

  function expiryStatus(record) {
    if (record.days_to_expiry == null) return 'permanent';   // no expiry
    if (record.days_to_expiry < 0)     return 'expired';
    if (record.days_to_expiry < 30)    return 'critical';
    if (record.days_to_expiry < 90)    return 'warning';
    return 'valid';
  }

  function init() {
    panelEl = document.getElementById('tab-training');
    if (!panelEl) return;
    panelEl.classList.add('training-tab');
    panelEl.addEventListener('click', e => {
      const tab = e.target.closest('[data-training-tab]');
      if (tab) { activeTab = tab.dataset.trainingTab; refresh(); }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('training', {
      onTabActivate: (name) => { if (name === 'training') refresh(); }
    });
  }

  function renderPanel() {
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="award"></i><span>${T('menu.training')}</span></span>
      </div>
      <div class="tab-toolbar">
        <div class="filter-chips">
          ${['catalog','matrix','expirations'].map(t => `
            <button class="filter-chip ${t === activeTab ? 'active' : ''}" data-training-tab="${t}">
              ${T('training.subtab.' + t)}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="tab-body">
        ${activeTab === 'catalog'    ? renderCatalog()
          : activeTab === 'matrix'   ? renderMatrix()
          : renderExpirations()}
      </div>
    `;
  }

  function renderCatalog() {
    return `<div class="training-catalog">
      ${COURSES.map(c => `
        <div class="course-card">
          <div class="course-icon"><i data-lucide="${categoryIcon(c.category)}"></i></div>
          <div class="course-body">
            <div class="course-name">${T('training.course.' + c.id)}</div>
            <div class="course-meta">
              <span class="course-cat">${T('training.cat.' + c.category)}</span>
              ${c.expiry_months
                ? `<span class="course-expiry">${T('training.expiryMonths', { n: c.expiry_months })}</span>`
                : `<span class="course-expiry">${T('training.permanent')}</span>`}
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function categoryIcon(cat) {
    switch (cat) {
      case 'weapons':  return 'target';
      case 'driving':  return 'car-front';
      case 'medical':  return 'cross';
      case 'k9':       return 'dog';
      case 'tactical': return 'shield';
      case 'language': return 'languages';
      default:         return 'book-open';
    }
  }

  function renderMatrix() {
    const records = getCertRecords();
    if (!records.length) return `<div class="empty-state">${T('training.empty')}</div>`;
    // Group by officer
    const officers = TomorrowOfficers?.listOfficers?.() || [];
    return `
      <table class="compliance-matrix">
        <thead>
          <tr>
            <th>${T('training.col.officer')}</th>
            ${COURSES.map(c => `<th title="${T('training.course.' + c.id)}">${T('training.course.' + c.id).slice(0, 14)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${officers.slice(0, 25).map(o => `
            <tr>
              <td class="officer-cell">
                <div class="officer-callsign">${o.callsign}</div>
                <div class="officer-sub">${o.first_name} ${o.last_name}</div>
              </td>
              ${COURSES.map(c => {
                const rec = records.find(r => r.officer_id === o.id && r.course_id === c.id);
                if (!rec) return `<td class="cert-cell missing">—</td>`;
                const status = expiryStatus(rec);
                return `<td class="cert-cell ${status}" title="${T('training.expiresOn', { date: rec.expires || '∞' })}">
                  <span class="cert-marker"></span>
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="matrix-legend">
        <span class="legend-chip valid"><span class="dot"></span>${T('training.legend.valid')}</span>
        <span class="legend-chip warning"><span class="dot"></span>${T('training.legend.warning')}</span>
        <span class="legend-chip critical"><span class="dot"></span>${T('training.legend.critical')}</span>
        <span class="legend-chip expired"><span class="dot"></span>${T('training.legend.expired')}</span>
        <span class="legend-chip permanent"><span class="dot"></span>${T('training.legend.permanent')}</span>
      </div>`;
  }

  function renderExpirations() {
    const records = getCertRecords()
      .filter(r => r.days_to_expiry != null && r.days_to_expiry < 90)
      .sort((a, b) => a.days_to_expiry - b.days_to_expiry);
    if (!records.length) return `<div class="empty-state">${T('training.noExpirations')}</div>`;
    return `<div class="expirations-list">
      ${records.map(r => {
        const status = expiryStatus(r);
        return `
          <div class="expiration-row ${status}">
            <div class="exp-meta">
              <div class="exp-officer">${r.callsign} · ${r.officer_name}</div>
              <div class="exp-course">${T('training.course.' + r.course_id)}</div>
            </div>
            <div class="exp-date">
              <div class="exp-days">${r.days_to_expiry < 0 ? T('training.expired') : T('training.daysLeft', { n: r.days_to_expiry })}</div>
              <div class="exp-on">${r.expires}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  return { init, refresh, COURSES };
})();

/* ============================================================
   TOMORROW — Integrations Hub (SHIM)
   Catalog of external government connectors. UI only — no real
   API calls. "Test Connection" mocks a 1.5s latency and reports
   "Awaiting Credentials". State persists last-tested timestamps
   in Settings.integrations[key].lastTested.
   ============================================================ */

window.TomorrowIntegrations = (function () {

  const CONNECTORS = [
    { key: 'moi',    icon: 'building-2',   country: 'israel',
      endpoint: 'https://api.moi.gov.il/v1/citizens/{id}',
      scopes: ['citizen.read.basic', 'citizen.read.address', 'citizen.read.family'] },
    { key: 'iaa',    icon: 'plane',        country: 'israel',
      endpoint: 'https://api.iaa.gov.il/v1/border/lookup',
      scopes: ['border.read.entries', 'border.read.exits'] },
    { key: 'piba',   icon: 'badge-check',  country: 'israel',
      endpoint: 'https://api.piba.gov.il/v1/status/{id}',
      scopes: ['immigration.read.status', 'immigration.read.history'] },
    { key: 'ips',    icon: 'lock',         country: 'israel',
      endpoint: 'https://api.ips.gov.il/v1/inmates/{id}',
      scopes: ['inmate.read.history', 'inmate.read.location'] },
    { key: 'police', icon: 'shield',       country: 'israel',
      endpoint: 'https://api.police.gov.il/v1/criminal/{id}',
      scopes: ['criminal.read.history', 'criminal.read.warrants'] },
    { key: 'shabak', icon: 'eye',          country: 'israel',
      endpoint: 'classified://endpoint',
      scopes: ['classified.read.preview'] },
    { key: 'idf',    icon: 'star',         country: 'israel',
      endpoint: 'https://api.idf.gov.il/v1/service/{id}',
      scopes: ['military.read.basic'] },
    { key: 'mod',    icon: 'award',        country: 'israel',
      endpoint: 'https://api.mod.gov.il/v1/veterans/{id}',
      scopes: ['veteran.read.basic'] },
    { key: 'pf',     icon: 'building-2',   country: 'brazil',
      endpoint: 'https://api.pf.gov.br/v1/citizens/{cpf}',
      scopes: ['citizen.read.cpf', 'citizen.read.address'] },
    { key: 'anac',   icon: 'plane',        country: 'brazil',
      endpoint: 'https://api.anac.gov.br/v1/border/lookup',
      scopes: ['border.read'] }
  ];

  let panelEl = null;
  let activeKey = null;

  function init() {
    panelEl = document.getElementById('tab-integrations');
    if (!panelEl) return;
    panelEl.classList.add('integrations-tab');
    panelEl.addEventListener('click', e => {
      const card = e.target.closest('[data-connector]');
      if (card) { activeKey = activeKey === card.dataset.connector ? null : card.dataset.connector; refresh(); return; }
      const test = e.target.closest('[data-test-connector]');
      if (test) { testConnection(test.dataset.testConnector); return; }
    });
    document.addEventListener('tomorrow-lang-change', refresh);
    TomorrowApp.register('integrations', {
      onTabActivate: (name) => { if (name === 'integrations') refresh(); }
    });
  }

  function status(key) {
    // All connectors start as 'awaiting_credentials' — no real backend.
    // Test attempts get timestamped per-key so the UI reflects the demo.
    return 'awaiting_credentials';
  }

  function renderPanel() {
    return `
      <div class="tab-head">
        <span class="tab-title"><i data-lucide="cable"></i><span>${T('menu.integrations')}</span></span>
        <span class="tab-counts">
          <span class="tab-count" style="--rc:var(--high)">${CONNECTORS.length} ${T('integrations.connectorsCount')}</span>
        </span>
      </div>

      <div class="tab-body integrations-body">
        <div class="integrations-grid">
          ${CONNECTORS.map(c => renderCard(c)).join('')}
        </div>
        ${activeKey ? renderDetail(CONNECTORS.find(c => c.key === activeKey)) : ''}
      </div>
    `;
  }

  function renderCard(c) {
    const st = status(c.key);
    const stColor = st === 'connected' ? 'var(--low)'
                  : st === 'awaiting_credentials' ? 'var(--high)'
                  : 'var(--text-faint)';
    return `
      <div class="connector-card ${c.key === activeKey ? 'active' : ''}" data-connector="${c.key}" style="--rc:${stColor}">
        <div class="connector-icon"><i data-lucide="${c.icon}"></i></div>
        <div class="connector-meta">
          <div class="connector-name">${T('integrations.' + c.key + '.name')}</div>
          <div class="connector-scope">${T('integrations.' + c.key + '.scope')}</div>
        </div>
        <div class="connector-status">
          <span class="dot"></span>${T('integrations.status.' + st)}
        </div>
      </div>`;
  }

  function renderDetail(c) {
    if (!c) return '';
    const st = status(c.key);
    return `
      <div class="connector-detail">
        <div class="connector-detail-head">
          <div class="connector-icon lg"><i data-lucide="${c.icon}"></i></div>
          <div>
            <h3>${T('integrations.' + c.key + '.name')}</h3>
            <p>${T('integrations.' + c.key + '.scope')}</p>
          </div>
        </div>

        <div class="officer-section">
          <div class="officer-section-head">${T('integrations.endpoint')}</div>
          <code class="endpoint">${c.endpoint}</code>
        </div>

        <div class="officer-section">
          <div class="officer-section-head">${T('integrations.scopes')}</div>
          <div class="scope-chips">
            ${c.scopes.map(s => `<span class="scope-chip">${s}</span>`).join('')}
          </div>
        </div>

        <div class="officer-section">
          <div class="officer-section-head">${T('integrations.connectionState')}</div>
          <div class="connector-state">
            <span class="connector-status" style="--rc:var(--high)">
              <span class="dot"></span>${T('integrations.status.' + st)}
            </span>
            <button class="filter-chip primary" data-test-connector="${c.key}">
              <i data-lucide="plug"></i> ${T('integrations.testConnection')}
            </button>
          </div>
        </div>
      </div>`;
  }

  function testConnection(key) {
    const c = CONNECTORS.find(x => x.key === key);
    if (!c) return;
    TomorrowApp.toast?.(T('integrations.testStart', { name: T('integrations.' + key + '.name') }), 'info');
    TomorrowApp.logEvent?.('system', 3, T('integrations.testStartLog', { name: T('integrations.' + key + '.name') }));
    setTimeout(() => {
      TomorrowApp.toast?.(T('integrations.testResult', { name: T('integrations.' + key + '.name') }), 'warning', 3500);
      TomorrowApp.logEvent?.('system', 2, T('integrations.testResultLog', { name: T('integrations.' + key + '.name') }));
    }, 1500);
  }

  function refresh() {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel();
    TomorrowApp.renderIcons();
  }

  return { init, refresh, CONNECTORS };
})();

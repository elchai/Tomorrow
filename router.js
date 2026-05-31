/* ============================================================
   TOMORROW — SPA Tab Router
   Manages tabs visibility, menu highlights, routing state,
   Leaflet map dimension invalidation, and custom activations.
   ============================================================ */

window.TomorrowRouter = (function () {

  const State = window.TomorrowState;
  const TABS = [
    'operations', 'intel', 'lpr', 'analytics', 'personnel',
    'shifts', 'fleet', 'training', 'integrations', 'syslog', 'settings'
  ];

  function init() {
    // 1. Set initial active tab
    let initialTab = 'operations';
    if (State.activeTab && TABS.includes(State.activeTab)) {
      initialTab = State.activeTab;
    }
    
    // 2. Setup sidebar click delegation
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item && item.dataset.tab) {
          e.preventDefault();
          switchTab(item.dataset.tab);
        }
      });
    }

    // 3. Switch to initial tab
    switchTab(initialTab, true);
  }

  function switchTab(tabKey, isInitial = false) {
    if (!TABS.includes(tabKey)) return;

    // Trigger UI sound click if initialized and not during initial page load
    if (!isInitial && window.TomorrowSounds) {
      TomorrowSounds.uiClick();
    }

    const prevTab = State.activeTab;
    State.activeTab = tabKey;
    TomorrowApp.saveState();

    // Broadcast deactivate to previous module
    if (prevTab && prevTab !== tabKey) {
      TomorrowApp.broadcast('onTabDeactivate', prevTab);
    }

    // Toggle CSS classes on tab elements
    TABS.forEach(t => {
      const tabEl = document.getElementById(`tab-${t}`);
      const btnEl = document.querySelector(`.sidebar-item[data-tab="${t}"]`);
      
      if (tabEl) {
        tabEl.classList.toggle('active', t === tabKey);
      }
      if (btnEl) {
        btnEl.classList.toggle('active', t === tabKey);
      }
    });

    // Handle Leaflet Map invalidation size
    if (tabKey === 'operations' && window.TomorrowMap) {
      const map = TomorrowMap.getMap ? TomorrowMap.getMap() : null;
      if (map) {
        // Delay ensures tab CSS display transition finishes
        setTimeout(() => {
          map.invalidateSize();
        }, 320);
      }
    }

    // Broadcast activate to current module
    TomorrowApp.broadcast('onTabActivate', tabKey);

    // Refresh icons inside the newly activated tab
    TomorrowApp.renderIcons();

    // Dispatch global custom event for external listeners
    const event = new CustomEvent('tomorrow-tab-change', { detail: { tab: tabKey, previous: prevTab } });
    document.dispatchEvent(event);
  }

  function getActiveTab() {
    return State.activeTab || 'operations';
  }

  return { init, switchTab, getActiveTab };
})();

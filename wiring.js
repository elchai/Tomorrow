/* ============================================================
   TOMORROW — UI wiring
   Timeline slider, HUD buttons, hamburger menu. Extracted from
   index.html so the page can ship under a strict CSP (no inline
   script). Loaded last so all TomorrowXxx modules are available.
   ============================================================ */

// Global shortcut so module code can write T('key') instead of TomorrowI18n.t('key').
window.T = function (key, vars) {
  return window.TomorrowI18n ? TomorrowI18n.t(key, vars) : key;
};

document.addEventListener('DOMContentLoaded', () => {
  // ── i18n bootstrap — must run before anything else paints visible text ──
  if (window.TomorrowI18n) {
    TomorrowI18n.applyDom();
    const langPicker = document.getElementById('lang-picker');
    if (langPicker) {
      langPicker.value = TomorrowI18n.getLang();
      langPicker.addEventListener('change', () => {
        // Same "wipe persisted demo data" trick as the in-app popup so the
        // user never sees a HE log entry while EN UI is active.
        try { localStorage.removeItem('tomorrow_state_v2'); } catch (_) { /* ignore */ }
        TomorrowI18n.setLang(langPicker.value);
        // Pre-login screens don't need a reload — boot hasn't started yet.
      });
    }
    // ── Combined Locale picker (Language + Region) ──
    // One panel, two sections, explicit Apply. Language and country are
    // independent — no implicit binding. Clicking Apply commits both,
    // wipes persisted state, and reloads. Cancel/outside-click closes
    // without saving.
    const localeBtn   = document.getElementById('btn-locale');
    const localePop   = document.getElementById('locale-popup');
    if (localeBtn && localePop && window.TomorrowCountries) {
      const codeEl  = localeBtn.querySelector('.nav-rail-lang-code');
      const langOpts    = localePop.querySelectorAll('.locale-options[data-group="lang"] .locale-opt');
      const countryOpts = localePop.querySelectorAll('.locale-options[data-group="country"] .locale-opt');
      const applyBtn    = localePop.querySelector('.locale-apply');
      const cancelBtn   = localePop.querySelector('.locale-cancel');

      // Pending selections held in the popup until Apply is pressed.
      let pendingLang    = TomorrowI18n.getLang();
      let pendingCountry = TomorrowCountries.getCode();

      const reflectSelection = () => {
        langOpts.forEach(o => o.classList.toggle('is-selected', o.dataset.value === pendingLang));
        countryOpts.forEach(o => o.classList.toggle('is-selected', o.dataset.value === pendingCountry));
        if (codeEl) codeEl.textContent = TomorrowI18n.getLang().toUpperCase();
      };
      const setOpen = (open) => {
        if (open) {
          // Reset pending state to current values every time we open
          pendingLang    = TomorrowI18n.getLang();
          pendingCountry = TomorrowCountries.getCode();
          reflectSelection();
        }
        localePop.hidden = !open;
        localeBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };

      reflectSelection();

      localeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(localePop.hidden);
        if (window.TomorrowSounds) TomorrowSounds.uiClick();
      });

      langOpts.forEach(opt => opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.disabled || opt.classList.contains('is-disabled')) return;
        pendingLang = opt.dataset.value;
        reflectSelection();
      }));
      countryOpts.forEach(opt => opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.disabled || opt.classList.contains('is-disabled')) return;
        pendingCountry = opt.dataset.value;
        reflectSelection();
      }));

      cancelBtn?.addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
      applyBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const langChanged    = pendingLang    !== TomorrowI18n.getLang();
        const countryChanged = pendingCountry !== TomorrowCountries.getCode();
        if (!langChanged && !countryChanged) { setOpen(false); return; }
        if (countryChanged) TomorrowCountries.set(pendingCountry);
        if (langChanged) TomorrowI18n.setLang(pendingLang);
        // Drop stale forecast/log/units so the new combo renders from scratch.
        try { localStorage.removeItem('tomorrow_state_v2'); } catch (_) { /* ignore */ }
        setOpen(false);
        location.reload();
      });

      document.addEventListener('click', (e) => {
        if (!localePop.hidden && !localePop.contains(e.target) && e.target !== localeBtn && !localeBtn.contains(e.target)) {
          setOpen(false);
        }
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !localePop.hidden) setOpen(false); });
      document.addEventListener('tomorrow-lang-change', reflectSelection);
    }
  }
  // ── Country picker — saves the choice + reloads so every module re-reads ──
  if (window.TomorrowCountries) {
    const countryPicker = document.getElementById('country-picker');
    if (countryPicker) {
      countryPicker.value = TomorrowCountries.getCode();
      countryPicker.addEventListener('change', () => {
        TomorrowCountries.set(countryPicker.value);
        // Drop persisted forecast/units so the new country re-generates fresh.
        try { localStorage.removeItem('tomorrow_state_v2'); } catch (_) { /* ignore */ }
        location.reload();
      });
    }
  }

  const slider = document.getElementById('tl-slider');
  const readout = document.getElementById('tl-readout');

  // Forecast scrubber — forward-only, in 4-hour jumps.
  //   • Slider value is an OFFSET from "now" (0, 4, 8, 12, 16, 20 hours ahead).
  //   • Forecast_hour stored on State is the absolute hour-of-day the offset
  //     resolves to (so prediction.js can look it up against the bucketed model).
  // Backward scrubbing intentionally disabled until sectoral history is wired
  // (showing a forecast for a past hour while saying "now" was confusing — see
  // user feedback). When the history layer lands, change `min` to a negative
  // offset and use State.history to back-fill.
  let nowHour = new Date().getHours();
  slider.value = 0;
  if (window.TomorrowState) TomorrowState.forecast_hour = null;

  function offsetToHour(off) { return (nowHour + parseInt(off, 10) + 24) % 24; }
  function refreshNowHour() {
    const h = new Date().getHours();
    if (h !== nowHour) {
      nowHour = h;
      // If user was at "now" (offset 0), keep them pinned to the new now.
      if (TomorrowState.forecast_hour == null) {
        slider.value = 0;
        readout.textContent = window.TomorrowI18n ? TomorrowI18n.t('forecast.now') : 'now';
        if (window.TomorrowPrediction) TomorrowPrediction.refresh();
      }
    }
  }
  setInterval(refreshNowHour, 30 * 1000);

  slider.addEventListener('input', () => {
    const off = parseInt(slider.value, 10);
    const hour = offsetToHour(off);
    TomorrowState.forecast_hour = (off === 0) ? null : hour;
    readout.textContent = (off === 0)
      ? T('forecast.now')
      : `${String(hour).padStart(2,'0')}:00 · +${off}h`;
    if (window.TomorrowPrediction) TomorrowPrediction.refresh();
  });

  document.getElementById('btn-regen').addEventListener('click', (e) => {
    if (window.TomorrowPrediction) TomorrowPrediction.regenerate();
    const btn = e.currentTarget;
    btn.classList.add('flash-success');
    setTimeout(() => btn.classList.remove('flash-success'), 1800);
  });
  document.getElementById('btn-saturate').addEventListener('click', () => {
    if (window.TomorrowDispatch) TomorrowDispatch.saturateArea();
  });
  document.getElementById('btn-mute').addEventListener('click', (e) => {
    const m = TomorrowSounds.toggle();
    const btn = e.currentTarget;
    btn.innerHTML = `<i data-lucide="${m ? 'volume-x' : 'volume-2'}"></i>`;
    btn.classList.toggle('muted', m);
    btn.title = window.TomorrowI18n ? TomorrowI18n.t(m ? 'hud.muteOn' : 'hud.muteOff') : (m ? 'Sound on' : 'Sound off');
    TomorrowApp.renderIcons();
  });
  document.getElementById('btn-osint').addEventListener('click', () => {
    if (window.TomorrowOsint) TomorrowOsint.toggle();
  });
  document.getElementById('btn-logout').addEventListener('click', () => {
    try { sessionStorage.removeItem('tomorrow_auth'); } catch (_) { /* ignore */ }
    TomorrowApp.toast?.(window.TomorrowI18n ? TomorrowI18n.t('toast.logout') : 'Logging out…', 'info', 1200);
    setTimeout(() => location.reload(), 350);
  });

  // ── Mobile sidebar (overlay) — hamburger button toggles it ──
  // Sidebar replaces the legacy hamburger menu on mobile. Picking a tab from
  // the sidebar auto-closes the overlay (handled in router via tab-change event).
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const ham = document.getElementById('btn-hamburger');

  function toggleSidebar(force) {
    const next = typeof force === 'boolean' ? force : !sidebar?.classList.contains('open');
    sidebar?.classList.toggle('open', next);
    sidebarOverlay?.classList.toggle('open', next);
    ham?.classList.toggle('active', next);
    ham?.setAttribute('aria-expanded', next ? 'true' : 'false');
  }
  ham?.addEventListener('click', () => toggleSidebar());
  sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) toggleSidebar(false);
  });
  // Auto-close after picking a tab on mobile
  document.addEventListener('tomorrow-tab-change', () => {
    if (window.innerWidth <= 600) toggleSidebar(false);
  });

  // ── Legacy hamburger menu (kept for OSINT/Layers/Mute on mobile) ──
  const menu = document.getElementById('hamburger-menu');
  const overlay = document.getElementById('hamburger-overlay');
  function toggleHam(force) {
    if (!menu) return;
    const next = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', next);
    overlay?.classList.toggle('open', next);
    menu.setAttribute('aria-hidden', next ? 'false' : 'true');
  }
  overlay?.addEventListener('click', () => toggleHam(false));
  document.getElementById('btn-close-hamburger')?.addEventListener('click', () => toggleHam(false));
  menu?.querySelectorAll('.hm-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = document.getElementById(item.dataset.trigger);
      toggleHam(false);
      if (target) setTimeout(() => target.click(), 220);
    });
  });

  // ── Router init — must run last so all tab modules have registered ──
  if (window.TomorrowRouter) TomorrowRouter.init();
});

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
    // In-app language picker — popup with EN / HE / PT. PT is shown but
    // disabled ("coming soon") so the live demo only switches between
    // English and Hebrew. Clicking the rail button opens the popup;
    // clicking an option (or anywhere outside) closes it.
    const cycleBtn = document.getElementById('btn-lang-cycle');
    const popup    = document.getElementById('lang-popup');
    if (cycleBtn && popup) {
      const codeEl = cycleBtn.querySelector('.nav-rail-lang-code');
      const opts   = popup.querySelectorAll('.lang-opt');
      const refresh = () => {
        const cur = TomorrowI18n.getLang();
        if (codeEl) codeEl.textContent = cur.toUpperCase();
        opts.forEach(o => o.classList.toggle('active', o.dataset.lang === cur));
      };
      const setOpen = (open) => {
        popup.hidden = !open;
        cycleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      refresh();
      cycleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(popup.hidden);
        if (window.TomorrowSounds) TomorrowSounds.uiClick();
      });
      opts.forEach(opt => {
        opt.addEventListener('click', (e) => {
          if (opt.disabled) { e.stopPropagation(); return; }
          const lang = opt.dataset.lang;
          // Bind language to a natural region: HE → Israel (so the dataset
          // matches the language and the user doesn't see Hebrew UI with
          // Portuguese neighborhood names), EN/PT → Brazil. The Region
          // picker on the login screen still allows manual override.
          const defaultCountry = (lang === 'he') ? 'israel' : 'brazil';
          if (window.TomorrowCountries) TomorrowCountries.set(defaultCountry);
          // Wipe persisted forecast/units/log so the new language+country
          // re-renders from scratch (no stale entries from a prior mode).
          try { localStorage.removeItem('tomorrow_state_v2'); } catch (_) { /* ignore */ }
          TomorrowI18n.setLang(lang);
          setOpen(false);
          location.reload();   // full reload so every module re-renders cleanly
        });
      });
      // Close when clicking anywhere outside the popup
      document.addEventListener('click', (e) => {
        if (!popup.hidden && !popup.contains(e.target) && e.target !== cycleBtn && !cycleBtn.contains(e.target)) {
          setOpen(false);
        }
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popup.hidden) setOpen(false); });
      document.addEventListener('tomorrow-lang-change', refresh);
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

  // P1-6 fix: keep nowHour current even when the wall clock crosses an
  // hour boundary mid-session. Without this, after a long session the
  // slider's "now" label drifts off the actual current hour.
  let nowHour = new Date().getHours();
  slider.value = nowHour;

  function refreshNowHour() {
    const h = new Date().getHours();
    if (h !== nowHour) {
      nowHour = h;
      // If the slider was at "now", follow the rollover.
      if (TomorrowState.forecast_hour == null) {
        slider.value = nowHour;
        readout.textContent = window.TomorrowI18n ? TomorrowI18n.t('forecast.now') : 'now';
      }
    }
  }
  setInterval(refreshNowHour, 30 * 1000);

  slider.addEventListener('input', () => {
    const h = parseInt(slider.value);
    TomorrowState.forecast_hour = (h === nowHour) ? null : h;
    readout.textContent = (h === nowHour) ? T('forecast.now') : `${String(h).padStart(2,'0')}:00`;
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

  // ── Mobile hamburger menu — consolidates HUD action buttons ──
  const ham = document.getElementById('btn-hamburger');
  const menu = document.getElementById('hamburger-menu');
  const overlay = document.getElementById('hamburger-overlay');
  function toggleHam(force) {
    const next = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', next);
    overlay.classList.toggle('open', next);
    ham?.classList.toggle('active', next);
    menu.setAttribute('aria-hidden', next ? 'false' : 'true');
    ham?.setAttribute('aria-expanded', next ? 'true' : 'false');
  }
  ham?.addEventListener('click', () => toggleHam());
  overlay?.addEventListener('click', () => toggleHam(false));
  document.getElementById('btn-close-hamburger')?.addEventListener('click', () => toggleHam(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) toggleHam(false); });
  menu.querySelectorAll('.hm-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = document.getElementById(item.dataset.trigger);
      toggleHam(false);
      if (target) setTimeout(() => target.click(), 220);   // wait for menu fade
    });
  });

  // Mobile language picker — same behaviour as the desktop rail popup,
  // just inline rows inside the hamburger menu.
  const markActiveLang = () => {
    if (!window.TomorrowI18n) return;
    const cur = TomorrowI18n.getLang();
    menu.querySelectorAll('.hm-lang-item').forEach(li => {
      li.classList.toggle('is-active', li.dataset.lang === cur);
    });
  };
  markActiveLang();
  document.addEventListener('tomorrow-lang-change', markActiveLang);
  menu.querySelectorAll('.hm-lang-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('is-disabled')) return;
      const lang = item.dataset.lang;
      const defaultCountry = (lang === 'he') ? 'israel' : 'brazil';
      if (window.TomorrowCountries) TomorrowCountries.set(defaultCountry);
      try { localStorage.removeItem('tomorrow_state_v2'); } catch (_) { /* ignore */ }
      if (window.TomorrowI18n) TomorrowI18n.setLang(lang);
      toggleHam(false);
      setTimeout(() => location.reload(), 280);
    });
  });
});

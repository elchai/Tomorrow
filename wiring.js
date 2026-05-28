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
        TomorrowI18n.setLang(langPicker.value);
      });
    }
    // In-app language cycle button (lives in the nav-rail). Click rotates en → he → pt → en.
    const cycleBtn = document.getElementById('btn-lang-cycle');
    if (cycleBtn) {
      const codeEl = cycleBtn.querySelector('.nav-rail-lang-code');
      const refresh = () => { if (codeEl) codeEl.textContent = TomorrowI18n.getLang().toUpperCase(); };
      refresh();
      cycleBtn.addEventListener('click', () => {
        const order = TomorrowI18n.getSupported();
        const cur = TomorrowI18n.getLang();
        const next = order[(order.indexOf(cur) + 1) % order.length];
        TomorrowI18n.setLang(next);
        refresh();
        if (window.TomorrowSounds) TomorrowSounds.uiClick();
      });
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
});

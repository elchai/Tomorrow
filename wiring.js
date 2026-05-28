/* ============================================================
   TOMORROW — UI wiring
   Timeline slider, HUD buttons, hamburger menu. Extracted from
   index.html so the page can ship under a strict CSP (no inline
   script). Loaded last so all TomorrowXxx modules are available.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
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
        readout.textContent = 'עכשיו';
      }
    }
  }
  setInterval(refreshNowHour, 30 * 1000);

  slider.addEventListener('input', () => {
    const h = parseInt(slider.value);
    TomorrowState.forecast_hour = (h === nowHour) ? null : h;
    readout.textContent = (h === nowHour) ? 'עכשיו' : `${String(h).padStart(2,'0')}:00`;
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
    btn.title = m ? 'הפעל קול' : 'השתק קול';
    TomorrowApp.renderIcons();
  });
  document.getElementById('btn-osint').addEventListener('click', () => {
    if (window.TomorrowOsint) TomorrowOsint.toggle();
  });
  document.getElementById('btn-logout').addEventListener('click', () => {
    try { sessionStorage.removeItem('tomorrow_auth'); } catch (_) { /* ignore */ }
    TomorrowApp.toast?.('🚪 יוצא מהמערכת…', 'info', 1200);
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

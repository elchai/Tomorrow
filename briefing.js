/* ============================================================
   TOMORROW — Tactical Briefing Mode
   Creates a cinematic, atmospheric full-screen overlay summarizing
   the upcoming 24-hour threat factors, triggers specialized Audio
   synth effects, and provides a one-click Quick Auto-Deploy grid.
   ============================================================ */

window.TomorrowBriefing = (function () {

  const State = window.TomorrowState;
  let overlayEl = null;

  function init() {
    // 1. Inject Briefing button in HUD next to station selector
    injectHUDButton();

    // 2. Build the full-screen overlay structure (hidden by default)
    buildOverlay();
  }

  function injectHUDButton() {
    const chips = document.getElementById('station-chips');
    if (!chips) return;

    const btn = document.createElement('button');
    btn.id = 'btn-briefing';
    btn.className = 'station-chip active';
    btn.style.cssText = `
      background: rgba(255, 31, 75, 0.14);
      border-color: rgba(255, 31, 75, 0.45);
      color: #ff5470;
      font-weight: 700;
      margin-inline-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 0 10px rgba(255, 31, 75, 0.15);
      cursor: pointer;
    `;
    btn.innerHTML = '<i data-lucide="presentation"></i><span>תדריך מבצעי</span>';

    chips.parentNode.insertBefore(btn, chips.nextSibling);
    btn.addEventListener('click', show);
  }

  function buildOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.id = 'briefing-overlay';
    overlayEl.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 150000;
      background: radial-gradient(ellipse at center, rgba(8, 16, 35, 0.94), rgba(2, 5, 12, 0.98));
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
    `;

    overlayEl.innerHTML = `
      <div class="login-grid" style="opacity: 0.25;"></div>
      <div class="scanlines"></div>
      
      <!-- Scan pulse overlay -->
      <div id="briefing-scanner" style="
        position: absolute;
        top: 0; left: 0; right: 0; height: 100%;
        background: linear-gradient(180deg, rgba(0, 229, 255, 0.0) 0%, rgba(0, 229, 255, 0.04) 50%, rgba(0, 229, 255, 0.0) 100%);
        pointer-events: none;
        animation: briefScan 5s ease-in-out infinite;
      "></div>

      <style>
        @keyframes briefScan {
          0%, 100% { transform: translateY(-50%); }
          50% { transform: translateY(50%); }
        }
        .briefing-box {
          position: relative;
          width: 520px;
          max-width: 90vw;
          background: rgba(8, 16, 35, 0.9);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 34px 40px;
          box-shadow: 0 0 50px rgba(255, 31, 75, 0.12), inset 0 0 30px rgba(0,0,0,0.5);
          text-align: right;
          direction: rtl;
        }
        .briefing-box::before {
          content: '';
          position: absolute;
          top: -1px; left: -1px; right: -1px; height: 2px;
          background: linear-gradient(90deg, transparent, var(--critical), transparent);
        }
      </style>

      <div class="briefing-box">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-family: var(--font-disp); font-size: 10px; letter-spacing: 2.5px; color: var(--critical); margin-bottom: 4px; font-weight:700;">TACTICAL BRIEFING // תדריך מפקד תורן</div>
          <h2 style="font-family: var(--font-disp); font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 2px;">TOMORROW</h2>
        </div>

        <!-- Threat metrics summary -->
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--line-soft); border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-dim); margin-bottom: 12px; border-bottom: 1px dashed var(--line-soft); padding-bottom: 6px;">נתוני משמרת מחושבים (24 שע׳)</div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13.5px;">
            <span style="color: var(--text-dim);">מוקדי איום פעילים:</span>
            <span style="font-family: var(--font-mono); font-weight:700; color: #fff;" id="br-hotspots-count">0 מוקדים</span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13.5px;">
            <span style="color: var(--text-dim);">סווג סיכון גבוה / קריטי:</span>
            <span style="font-family: var(--font-mono); font-weight:700; color: var(--critical);" id="br-high-risk-count">0</span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13.5px;">
            <span style="color: var(--text-dim);">שעת שיא לפשיעה במחוז:</span>
            <span style="font-family: var(--font-mono); font-weight:700; color: var(--cyan);" id="br-peak-hour">22:00</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13.5px;">
            <span style="color: var(--text-dim);">סוג עבירה מוביל:</span>
            <span style="font-weight:700; color: var(--medium);" id="br-dominant-crime">—</span>
          </div>
        </div>

        <!-- Environmental context multiplier -->
        <div style="background: rgba(255, 31, 75, 0.04); border: 1px solid rgba(255, 31, 75, 0.22); border-radius: 6px; padding: 14px 16px; margin-bottom: 26px; font-size: 13px; line-height: 1.45;">
          <div style="font-weight: 700; color: var(--critical); margin-bottom: 4px; display:flex; align-items:center; gap:5px;">
            <i data-lucide="shield-alert" style="width:14px; height:14px;"></i>גורם סביבתי משפיע (Context):
          </div>
          <div style="color: var(--text-dim);" id="br-environmental-factor">—</div>
        </div>

        <!-- Action Row -->
        <div style="display: flex; gap: 10px;">
          <button id="btn-br-deploy" class="login-btn" style="flex: 1.4; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, var(--critical), rgba(255,31,75,.35)); border-color: var(--critical); text-shadow: 0 0 8px rgba(255,31,75,0.5);">
            <i data-lucide="navigation"></i><span>פריסת כוחות מהירה</span>
          </button>
          <button id="btn-br-close" class="btn btn-ghost" style="flex: 0.8; height: 50px; font-weight:700; border-radius: 6px; border-color: var(--line);">
            <span>סגור תדריך</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    // Event listeners
    document.getElementById('btn-br-close').addEventListener('click', hide);
    document.getElementById('btn-br-deploy').addEventListener('click', autoDeploy);
  }

  function show() {
    if (!overlayEl) return;

    // 1. Trigger low frequency detuned bass rumble synth
    if (window.TomorrowSounds) {
      TomorrowSounds.rumble();
    }

    // 2. Perform live threat analysis
    analyzeShift();

    // 3. Reveal overlay
    overlayEl.style.pointerEvents = 'auto';
    overlayEl.style.opacity = '1';
    
    // Render Lucide icons inside overlay
    TomorrowApp.renderIcons();
  }

  function hide() {
    if (!overlayEl) return;
    overlayEl.style.pointerEvents = 'none';
    overlayEl.style.opacity = '0';
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
  }

  function analyzeShift() {
    const stationId = State.current_station_id;
    const activeForecast = (State.forecast || []).filter(h => !stationId || h.station_id === stationId);

    // 1. Hotspots count
    const hCountEl = document.getElementById('br-hotspots-count');
    if (hCountEl) hCountEl.textContent = `${activeForecast.length} מוקדים במחוז`;

    // 2. High/Critical risk counts
    const criticalCount = activeForecast.filter(h => h.risk <= 2).length;
    const hrEl = document.getElementById('br-high-risk-count');
    if (hrEl) hrEl.textContent = `${criticalCount} מוקדים (סיכון גבוה/קריטי)`;

    // 3. Peak Hour of Crime Activity
    const hourCounts = new Array(24).fill(0);
    activeForecast.forEach(h => {
      if (h.hour >= 0 && h.hour < 24) hourCounts[h.hour]++;
    });
    
    let peakHour = 22;
    let maxHourCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > maxHourCount) {
        maxHourCount = hourCounts[h];
        peakHour = h;
      }
    }
    const peakEl = document.getElementById('br-peak-hour');
    if (peakEl) peakEl.textContent = `${String(peakHour).padStart(2, '0')}:00 – ${String((peakHour + 1) % 24).padStart(2, '0')}:00`;

    // 4. Dominant Crime
    const crimeCounts = {};
    activeForecast.forEach(h => {
      crimeCounts[h.crime] = (crimeCounts[h.crime] || 0) + 1;
    });
    let domCrimeKey = '';
    let maxCrimeCount = 0;
    Object.keys(crimeCounts).forEach(k => {
      if (crimeCounts[k] > maxCrimeCount) {
        maxCrimeCount = crimeCounts[k];
        domCrimeKey = k;
      }
    });

    const domEl = document.getElementById('br-dominant-crime');
    if (domEl) {
      if (domCrimeKey) {
        const cConf = CONFIG.crimeType(domCrimeKey);
        domEl.textContent = cConf ? cConf.name : '—';
      } else {
        domEl.textContent = '—';
      }
    }

    // 5. Environmental context factor
    const envEl = document.getElementById('br-environmental-factor');
    if (envEl) {
      envEl.textContent = getContextFactor(peakHour);
    }
  }

  function getContextFactor(peakHour) {
    const day = new Date().getDay(); // 0=Sun ... 4=Thu, 5=Fri, 6=Sat
    
    // Multiplier logic depending on time of day and weekend
    if (day === 4 || day === 5) {
      return 'סוף שבוע (חמישי/שישי) · צפי לריכוז קהל ופעילות מוגברת במוקדי בילוי וחיי לילה. סיור מונע מתוגבר סביב מוקדי מסחר ובילוי.';
    }

    // Deterministic factor based on current hour to make it stable
    const factors = [
      'מזג אוויר · אובך כבד וזיהום אוויר מגבילים את הראות במחוז. כוחות הסיור מונחים להפעיל אורות חירום מהבהבים להגברת הנוכחות.',
      'אירועים · הפגנה מתוכננת במרכז העיר עשויה להביא לחסימות צירים ולעומסי תנועה במרחב ירקון. רצוי לפרוס אופנועי סיור לניידות מהירה.',
      'מזג אוויר · סופת גשמים קרה מכה במחוז. ירידה בפעילות עבריינית בשטחים פתוחים, אך סיכון מוגבר לתאונות דרכים והפרעות סדר במקומות סגורים.',
      'אירועים · משחק כדורגל רגיש (דרבי) מתוכנן באצטדיון בלומפילד. כוחות יס"מ מתוגברים מופנים לאזור מרחב איילון (יפתח/שפירא).'
    ];

    return factors[peakHour % factors.length];
  }

  // Quick Auto-Deploy Patrol Grid
  function autoDeploy() {
    const stationId = State.current_station_id;
    
    // Get visible forecast hotspots for the active hour
    const activeHotspots = window.TomorrowPrediction ? TomorrowPrediction.getVisibleForecast() : [];
    
    // Filter down to high risk (risk <= 2), not resolved, not dispatched
    const candidates = activeHotspots
      .filter(h => h.risk <= 2 && !h.dispatched && !h.resolved)
      .sort((a, b) => b.probability - a.probability);

    if (candidates.length === 0) {
      TomorrowApp.toast('אין מוקדי סיכון גבוה זמינים כעת לפריסה מהירה', 'warning');
      hide();
      return;
    }

    // Close modal overlay
    hide();

    TomorrowApp.toast(`⚡ הפעלת פריסה מהירה: מקצה כוחות ל-${candidates.length} מוקדים חמים…`, 'info');
    
    // Dispatch in quick sequence
    candidates.forEach((h, idx) => {
      setTimeout(() => {
        if (window.TomorrowDispatch) {
          TomorrowDispatch.dispatchToHotspot(h);
        }
      }, idx * 1000);
    });
  }

  return { init, show, hide, autoDeploy };
})();

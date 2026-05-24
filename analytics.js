/* ============================================================
   TOMORROW — Operational Analytics Dashboard
   Draws HTML5 Canvas tactical line/bar charts for crime trend
   and crime mix distributions, calculates prevention performance
   statistics, and implements a real-time predictive weights controller.
   ============================================================ */

window.TomorrowAnalytics = (function () {

  const State = window.TomorrowState;
  let panelEl = null;
  let isOpen = false;

  function init() {
    // 1. Inject analytics button in HUD
    injectHUDButton();

    // 2. Build and inject the side-drawer panel
    buildPanel();

    // 3. Register module listener for station/forecast changes
    TomorrowApp.register('analytics', {
      onStationChange: refresh,
      onForecastChange: refresh
    });

    // 4. Attach listeners to sliders
    wireSliders();
    
    // Perform initial draw
    refresh();
  }

  function injectHUDButton() {
    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;
    
    const btn = document.createElement('button');
    btn.id = 'btn-analytics';
    btn.className = 'icon-btn';
    btn.title = 'אנליטיקה טקטית';
    btn.style.marginInlineEnd = '8px';
    btn.innerHTML = '<i data-lucide="bar-chart-3"></i>';
    
    muteBtn.parentElement.insertBefore(btn, muteBtn);
    btn.addEventListener('click', toggle);
  }

  function buildPanel() {
    panelEl = document.createElement('aside');
    panelEl.id = 'analytics-panel';
    panelEl.className = 'panel';
    panelEl.style.cssText = `
      position: absolute;
      top: var(--hud-h);
      bottom: 0;
      right: -310px;
      width: 300px;
      z-index: 1000;
      border-left: 1px solid var(--line);
      transition: right 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
      background: linear-gradient(180deg, rgba(11, 19, 34, 0.98), rgba(7, 12, 24, 0.98));
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.55);
      display: flex;
      flex-direction: column;
    `;

    panelEl.innerHTML = `
      <div class="panel-head">
        <span class="panel-title"><i data-lucide="bar-chart-3"></i><span>אנליטיקה טקטית</span></span>
        <button id="btn-close-analytics" class="icon-btn" style="border:none; background:transparent; cursor:pointer;" title="סגור"><i data-lucide="x"></i></button>
      </div>
      <div class="scroll-list" style="padding: 14px 16px; overflow-y: auto;">
        
        <!-- KPIs Row -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-faint); margin-bottom: 8px;">מדדי ביצוע (KPIs)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--line-soft); border-radius: 6px; padding: 10px; text-align: center;">
              <span style="display:block; font-size: 22px; font-family: var(--font-mono); font-weight:700; color: var(--low);" id="an-prevent-rate">0%</span>
              <span style="font-size: 10px; color: var(--text-dim);">שיעור מניעה</span>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--line-soft); border-radius: 6px; padding: 10px; text-align: center;">
              <span style="display:block; font-size: 22px; font-family: var(--font-mono); font-weight:700; color: var(--cyan);" id="an-utilization">0%</span>
              <span style="font-size: 10px; color: var(--text-dim);">ניצולת כוחות</span>
            </div>
          </div>
        </div>

        <!-- 24h Trend Chart -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-faint); margin-bottom: 8px;">מגמת פשיעה צפויה (24h)</div>
          <canvas id="an-canvas-trend" width="268" height="110" style="background: rgba(0,0,0,0.2); border: 1px solid var(--line-soft); border-radius: 4px; display:block;"></canvas>
        </div>

        <!-- Crime Mix Chart -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-faint); margin-bottom: 8px;">פילוח סוגי עבירה</div>
          <canvas id="an-canvas-mix" width="268" height="110" style="background: rgba(0,0,0,0.2); border: 1px solid var(--line-soft); border-radius: 4px; display:block;"></canvas>
        </div>

        <!-- Predictive Weights Controller -->
        <div style="border-top: 1px solid var(--line-soft); padding-top: 16px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-faint); margin-bottom: 12px;">מקרן סיכון טקטי (Weights)</div>
          
          <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span>בסיס עבירה</span>
              <span style="font-family: var(--font-mono); color: var(--cyan);" id="lbl-weight-base">0.5</span>
            </div>
            <input type="range" id="sld-weight-base" min="0.10" max="1.50" step="0.05" value="0.5" style="width:100%; accent-color: var(--police);" />
          </div>

          <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span>שעות שיא</span>
              <span style="font-family: var(--font-mono); color: var(--cyan);" id="lbl-weight-fit">35</span>
            </div>
            <input type="range" id="sld-weight-fit" min="10" max="80" step="1" value="35" style="width:100%; accent-color: var(--police);" />
          </div>

          <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span>משקל היסטורי</span>
              <span style="font-family: var(--font-mono); color: var(--cyan);" id="lbl-weight-hist">25</span>
            </div>
            <input type="range" id="sld-weight-hist" min="5" max="60" step="1" value="25" style="width:100%; accent-color: var(--police);" />
          </div>

          <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span>אות מודיעין (OSINT)</span>
              <span style="font-family: var(--font-mono); color: var(--cyan);" id="lbl-weight-osint">16</span>
            </div>
            <input type="range" id="sld-weight-osint" min="5" max="40" step="1" value="16" style="width:100%; accent-color: var(--police);" />
          </div>
        </div>
      </div>
    `;

    document.getElementById('layout').appendChild(panelEl);

    // Wire up close button
    document.getElementById('btn-close-analytics').addEventListener('click', toggle);
  }

  function toggle() {
    isOpen = !isOpen;
    panelEl.style.right = isOpen ? '0px' : '-310px';
    
    const btn = document.getElementById('btn-analytics');
    if (btn) btn.classList.toggle('active', isOpen);
    
    if (window.TomorrowSounds) TomorrowSounds.uiClick();
    if (isOpen) refresh();
  }

  function wireSliders() {
    const sliders = [
      { id: 'base', configKey: 'base', multiplier: 1, fixDecimals: 2 },
      { id: 'fit', configKey: 'fit', multiplier: 1, fixDecimals: 0 },
      { id: 'hist', configKey: 'hist', multiplier: 1, fixDecimals: 0 },
      { id: 'osint', configKey: 'osint', multiplier: 1, fixDecimals: 0 }
    ];

    sliders.forEach(s => {
      const el = document.getElementById(`sld-weight-${s.id}`);
      const lbl = document.getElementById(`lbl-weight-${s.id}`);
      if (!el || !lbl) return;

      // Sync slider value with CONFIG
      el.value = CONFIG.FACTORS[s.configKey];
      lbl.textContent = Number(el.value).toFixed(s.fixDecimals);

      el.addEventListener('input', () => {
        CONFIG.FACTORS[s.configKey] = Number(el.value);
        lbl.textContent = CONFIG.FACTORS[s.configKey].toFixed(s.fixDecimals);
        
        // Dynamic update: regenerate predictions with new weights
        if (window.TomorrowPrediction) {
          TomorrowPrediction.regenerate();
        }
      });
    });
  }

  function refresh() {
    if (!isOpen) return;

    calculateStats();
    drawTrendChart();
    drawMixChart();
    
    // Rerender icons inside analytics panel if lucide loaded
    TomorrowApp.renderIcons();
  }

  function calculateStats() {
    // 1. Prevention Rate
    const s = State.sim || { prevented: 0, occurred: 0 };
    const total = s.prevented + s.occurred;
    const preventRate = total ? Math.round((s.prevented / total) * 100) : 0;
    
    const pEl = document.getElementById('an-prevent-rate');
    if (pEl) pEl.textContent = `${preventRate}%`;

    // 2. Fleet Utilization
    const units = State.units || [];
    const activeUnits = units.filter(u => u.status !== 'available').length;
    const utilizationRate = units.length ? Math.round((activeUnits / units.length) * 100) : 0;

    const uEl = document.getElementById('an-utilization');
    if (uEl) uEl.textContent = `${utilizationRate}%`;
  }

  function drawTrendChart() {
    const canvas = document.getElementById('an-canvas-trend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Clear and draw grid
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(43, 143, 255, 0.08)';
    ctx.lineWidth = 1;

    // Vertical grid lines (every 6 simulated hours)
    for (let x = 0; x <= W; x += W / 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= H; y += H / 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Accumulate predicted crime hotspots count per hour
    const hrCount = new Array(24).fill(0);
    const districtForecast = State.forecast || [];
    
    // Filter forecast items matching current station selection
    const stationId = State.current_station_id;
    const activeForecast = districtForecast.filter(h => !stationId || h.station_id === stationId);
    
    activeForecast.forEach(h => {
      if (h.hour >= 0 && h.hour < 24) hrCount[h.hour]++;
    });

    const maxVal = Math.max(3, ...hrCount);
    
    // Plot the values
    const points = [];
    const padding = 10;
    const chartW = W - padding * 2;
    const chartH = H - padding * 2;

    for (let h = 0; h < 24; h++) {
      const val = hrCount[h];
      const x = padding + (h / 23) * chartW;
      const y = padding + chartH - (val / maxVal) * chartH;
      points.push({ x, y, count: val, hour: h });
    }

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding + chartH);
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw glowing neon line
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    
    // Clear shadow settings for text/dots
    ctx.shadowBlur = 0;

    // Draw point nodes at current hour
    const activeHr = window.TomorrowPrediction ? TomorrowPrediction.activeHour() : new Date().getHours();
    const curP = points[activeHr];
    if (curP) {
      ctx.fillStyle = '#ff1f4b';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(curP.x, curP.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Text hours indicator
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '8px Share Tech Mono';
      ctx.fillText(`${String(activeHr).padStart(2,'0')}:00`, curP.x - 12, curP.y - 8);
    }

    // X axis ticks
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '7.5px Share Tech Mono';
    ctx.fillText('00:00', padding, H - 2);
    ctx.fillText('12:00', padding + chartW / 2 - 12, H - 2);
    ctx.fillText('23:00', padding + chartW - 20, H - 2);
  }

  function drawMixChart() {
    const canvas = document.getElementById('an-canvas-mix');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const stationId = State.current_station_id;
    const activeForecast = (State.forecast || []).filter(h => !stationId || h.station_id === stationId);

    if (activeForecast.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Heebo';
      ctx.textAlign = 'center';
      ctx.fillText('אין נתוני פשיעה זמינים', W / 2, H / 2);
      return;
    }

    // Count crimes
    const crimeCounts = {};
    activeForecast.forEach(h => {
      crimeCounts[h.crime] = (crimeCounts[h.crime] || 0) + 1;
    });

    // Map to list, sort and slice top 4
    const list = Object.keys(crimeCounts).map(k => {
      const cConf = CONFIG.crimeType(k);
      return {
        key: k,
        name: cConf.name,
        color: cConf.color || '#1a6dff',
        count: crimeCounts[k]
      };
    }).sort((a, b) => b.count - a.count).slice(0, 4);

    const maxCount = Math.max(1, ...list.map(x => x.count));

    ctx.textAlign = 'right';
    list.forEach((item, idx) => {
      const rowY = 12 + idx * 24;
      const barX = 84;
      const maxBarW = W - barX - 35;
      const barW = (item.count / maxCount) * maxBarW;

      // Draw crime label
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '9.5px Heebo';
      ctx.fillText(item.name.slice(0, 12), barX - 8, rowY + 9);

      // Draw background bar track
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(barX, rowY, maxBarW, 11);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(barX, rowY, maxBarW, 11);

      // Draw fill bar
      ctx.fillStyle = item.color;
      ctx.fillRect(barX, rowY, barW, 11);

      // Draw quantity count text
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '8.5px Share Tech Mono';
      ctx.fillText(item.count, W - 6, rowY + 9);
    });
  }

  return { init, toggle, refresh };
})();

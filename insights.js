/* ============================================================
   TOMORROW — Commander Insights engine
   Rule-based generator that reads State.history (compacted by
   archive.js) plus live State, and emits short operational
   recommendations in natural language. Three generators today:
     1. modelPrecisionInsight  — week-over-week prevention rate
     2. vulnerabilityInsight   — stations with rising hotspot counts
     3. officerLoadInsight     — over-utilized / under-utilized officers

   Public API:
     TomorrowInsights.generate()        → array of insight objects
     TomorrowInsights.renderInto(el)    → fill an element with HTML cards
     TomorrowInsights.topUrgent()       → highest-urgency insight or null
   ============================================================ */

window.TomorrowInsights = (function () {

  const State = window.TomorrowState;

  // ---------- Generators ----------

  function modelPrecisionInsight() {
    const hist = State.history || {};
    const weeks = Object.keys(hist).sort();
    if (weeks.length < 1) {
      return {
        kind: 'precision', urgency: 4,
        title: T('insights.bootTitle'),
        body:  T('insights.bootBody'),
      };
    }
    const wk = weeks[weeks.length - 1];
    const b = hist[wk];
    const total = (b.prevented || 0) + (b.occurred || 0);
    const rate = total ? Math.round((b.prevented / total) * 100) : 0;
    let prevRate = null;
    if (weeks.length >= 2) {
      const pb = hist[weeks[weeks.length - 2]];
      const pt = (pb.prevented || 0) + (pb.occurred || 0);
      if (pt) prevRate = Math.round((pb.prevented / pt) * 100);
    }
    const delta = prevRate != null ? rate - prevRate : null;
    return {
      kind: 'precision',
      urgency: rate < 60 ? 2 : rate < 80 ? 3 : 4,
      title: T('insights.precisionTitle', { week: wk }),
      body:  delta == null
        ? T('insights.precisionBodyFirst', { rate, total })
        : T(delta >= 0 ? 'insights.precisionBodyUp' : 'insights.precisionBodyDown',
            { rate, total, delta: Math.abs(delta), prev: prevRate })
    };
  }

  function vulnerabilityInsight() {
    const hist = State.history || {};
    const weeks = Object.keys(hist).sort();
    // Need at least 2 weeks of breakdowns to compare
    if (weeks.length < 2) {
      const live = (State.forecast || []).reduce((m, h) => {
        const s = h.station_id || 'unknown';
        m[s] = (m[s] || 0) + 1;
        return m;
      }, {});
      const top = Object.entries(live).sort((a, b) => b[1] - a[1])[0];
      if (!top) return null;
      const st = window.CONFIG?.station?.(top[0]);
      return {
        kind: 'vulnerability', urgency: 3,
        title: T('insights.vulnLiveTitle'),
        body:  T('insights.vulnLiveBody', { station: st?.name || top[0], count: top[1] })
      };
    }
    const cur = hist[weeks[weeks.length - 1]].station_breakdown || {};
    const prev = hist[weeks[weeks.length - 2]].station_breakdown || {};
    let worst = null, worstDelta = 0;
    Object.keys(cur).forEach(s => {
      const d = (cur[s] || 0) - (prev[s] || 0);
      if (d > worstDelta) { worstDelta = d; worst = s; }
    });
    if (!worst || worstDelta < 3) return null;
    const station = window.CONFIG?.station?.(worst);
    return {
      kind: 'vulnerability',
      urgency: worstDelta > 10 ? 2 : 3,
      title: T('insights.vulnTitle'),
      body:  T('insights.vulnBody', {
        station: station?.name || worst,
        delta: worstDelta,
        cur: cur[worst]
      })
    };
  }

  function officerLoadInsight() {
    const officers = window.TomorrowOfficers?.listOfficers?.() || [];
    if (!officers.length) return null;
    const onDuty = officers.filter(o => o.status === 'on_duty');
    const onLeave = officers.filter(o => o.status === 'leave');
    const total = officers.length;
    const dutyRate = Math.round((onDuty.length / total) * 100);

    if (dutyRate > 55) {
      // Over-deployed — flag for relief planning
      return {
        kind: 'load',
        urgency: dutyRate > 70 ? 2 : 3,
        title: T('insights.loadHighTitle'),
        body:  T('insights.loadHighBody', { rate: dutyRate, on_duty: onDuty.length, total })
      };
    }
    if (onLeave.length > total * 0.25) {
      return {
        kind: 'load',
        urgency: 3,
        title: T('insights.loadLeaveTitle'),
        body:  T('insights.loadLeaveBody', { leave: onLeave.length, total })
      };
    }
    return {
      kind: 'load', urgency: 4,
      title: T('insights.loadOkTitle'),
      body:  T('insights.loadOkBody', { rate: dutyRate, total })
    };
  }

  // ---------- Aggregate + render ----------

  function generate() {
    return [
      modelPrecisionInsight(),
      vulnerabilityInsight(),
      officerLoadInsight()
    ].filter(Boolean);
  }

  function topUrgent() {
    const all = generate();
    return all.sort((a, b) => a.urgency - b.urgency)[0] || null;
  }

  function urgencyClass(u) {
    return u <= 2 ? 'critical' : u === 3 ? 'warning' : 'normal';
  }

  function urgencyIcon(kind) {
    switch (kind) {
      case 'precision':     return 'target';
      case 'vulnerability': return 'shield-alert';
      case 'load':          return 'users';
      default:              return 'lightbulb';
    }
  }

  function renderInto(container) {
    if (!container) return;
    const list = generate();
    container.innerHTML = `
      <div class="insights-section">
        <div class="insights-head">
          <i data-lucide="lightbulb"></i>
          <span>${T('insights.title')}</span>
        </div>
        ${list.length === 0
          ? `<div class="empty-state">${T('insights.none')}</div>`
          : `<div class="insights-list">${list.map(i => `
              <div class="insight-card ${urgencyClass(i.urgency)}">
                <div class="insight-icon"><i data-lucide="${urgencyIcon(i.kind)}"></i></div>
                <div class="insight-body">
                  <div class="insight-title">${i.title}</div>
                  <div class="insight-text">${i.body}</div>
                </div>
              </div>
            `).join('')}</div>`
        }
      </div>
    `;
    if (window.TomorrowApp?.renderIcons) TomorrowApp.renderIcons();
  }

  function init() {
    // Hook into the analytics tab — append our section to its KPI container
    // after the tab is shown.
    TomorrowApp?.register?.('insights', {
      onTabActivate: (name) => {
        if (name !== 'analytics') return;
        // analytics.js takes a beat to refresh; defer until next paint
        setTimeout(() => {
          const kpiC = document.getElementById('an-container-kpi');
          if (!kpiC) return;
          let host = document.getElementById('an-insights-host');
          if (!host) {
            host = document.createElement('div');
            host.id = 'an-insights-host';
            kpiC.appendChild(host);
          }
          renderInto(host);
        }, 80);
      }
    });
    document.addEventListener('tomorrow-lang-change', () => {
      const host = document.getElementById('an-insights-host');
      if (host) renderInto(host);
    });
  }

  return { init, generate, renderInto, topUrgent };
})();

# TOMORROW — Functional / Behavioral Audit (2026-05-26)

Scope: real bugs and broken behaviors in the vanilla-JS predictive policing
dashboard at `C:\Users\User\Desktop\DEV\Tomorrow`. Source quoted verbatim
from the working tree. Severity:

- **P0** — broken (feature does not work, or computes a wrong value silently)
- **P1** — bug, works only partially / in some conditions
- **P2** — smell / will bite later
- **P3** — cleanup

---

## P0 — broken

### P0-1 · `layers.js:247` — `getDistance()` is mathematically broken; RTM proximity check ignores longitude

```js
function getDistance(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lat1 - lat2) ** 2) * 111000; // rough meter estimation
}
```

`(lat1-lat2)` is squared **twice** and `lng1`/`lng2` are **never read**. This
function is the gatekeeper for every RTM contextual-layer boost in
`checkRTMImpact()` (called from `prediction.js:103`). Effects:

- Two points on the same latitude but 50 km apart east-west return `distance = 0` →
  every hotspot east-west of a bar/ATM/dark-zone passes the proximity test.
- Latitudinal distance is over-counted by `√2` (~41%).

**Repro:** with `bars` and `dark` layers active (the defaults at `layers.js:18-22`),
any hotspot whose latitude is within ~0.0019 deg of a bar marker (≈212m on lat
axis) gets a +14 violent-crime boost — regardless of longitude.

**Fix:** use the same haversine that `app.js:52` / `osint.js:20` already implement.

---

### P0-2 · `index.html:91` + `layers.js:148-156` — hamburger "שכבות הקשר (RTM)" item is a dead button

The hamburger menu item triggers `btn-sim`:

```html
<li class="hm-item" data-trigger="btn-sim"><i data-lucide="layers"></i><span>שכבות הקשר (RTM)</span></li>
```

But `layers.js` renames the element at boot:

```js
existingSimBtn.id = 'btn-layers';
// …
const newBtn = existingSimBtn.cloneNode(true);
existingSimBtn.parentNode.replaceChild(newBtn, existingSimBtn);
newBtn.addEventListener('click', toggleLayersModal);
```

After `TomorrowLayers.init()` (called by `app.js:326`), `getElementById('btn-sim')`
returns `null` — the hamburger handler in `index.html:278` silently no-ops.

**Repro:** open on mobile, tap hamburger → tap "שכבות הקשר (RTM)" → nothing
happens. The modal can only be opened from the desktop timeline bar.

**Fix:** either keep the `id="btn-sim"` and use `name`/`title` to brand, or set
`data-trigger="btn-layers"` in `index.html:91`.

---

### P0-3 · `analytics.js:551` — Canvas `strokeStyle = 'var(--cyan)'` does not resolve; ROC curve renders in default black

```js
ctx.strokeStyle = 'var(--cyan)';
ctx.lineWidth = 2.4;
ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
```

The 2-D canvas API does **not** parse CSS custom properties. The string is
invalid, so `strokeStyle` falls back to the previous value (the grid stroke
`rgba(255,255,255,0.15)` set at line 513) — the ROC curve renders washed-out
white on a dark canvas, not the bright cyan the design implies (the shadow
glow does work because it's a real `rgba(...)` literal).

**Fix:** `ctx.strokeStyle = '#00e5ff';` (the same hex used everywhere else).

---

### P0-4 · `app.js:316` + `prediction.js:262` — toggling a strategic event / layer / weight slider WIPES every OSINT boost on the forecast

`TomorrowPrediction.regenerate()` runs `State.forecast = generate()` from
scratch (`prediction.js:264`). `generate()` does not call OSINT's
`applyBoost()`, and OSINT only re-applies in `init()` (`osint.js:169`) or on
the live-poll timer (`osint.js:187`, gated by `CONFIG.FIREBASE_URL` which is
empty → no polling).

Triggers that call `regenerate()`:

- `app.js:316` — strategic event toggle
- `analytics.js:294` — weights slider input
- `layers.js:241` — RTM layer toggle
- `index.html:235` — "הרץ מודל" button

Symptom: the OSINT badge on cards (`prediction.js:191`), the OSINT XAI bump in
the map popup (`map.js:121`), and the OSINT-derived risk-level escalation
(`osint.js:90`) all disappear after the very first interaction with any of the
above controls, and stay missing until page reload.

**Fix:** after `generate()`, call `TomorrowOsint.applyBoost?.()` (export it
from osint.js) or rebuild the forecast non-destructively.

---

### P0-5 · `index.html:209` + `app.js:656` — `app.js` and the inline UI-wiring script both listen for `DOMContentLoaded`; the inline script can fire before `TomorrowState` exists

`window.TomorrowState` is set at the top of `app.js` (line 7) at script eval —
fine. But the inline `<script>` in `index.html:221` reads
`TomorrowState.forecast_hour` inside `slider.input`. That's after the user
moves the slider, so probably safe in practice, but on the FIRST input event
the `if (window.TomorrowPrediction) TomorrowPrediction.refresh();` guard at
line 231 means: if the user moves the slider on the login screen (timeline is
in the layout, login overlay is on top with `z-index` only), nothing redraws.
Cosmetic smell.

Real bug: the slider's `nowHour` is captured at DOMContentLoaded
(`index.html:224`) and never updated. A session that crosses an hour boundary
will still treat the *old* hour as "now"; once `nowHour` is "11" but the wall
clock rolls to "12:00", moving the slider to 12 sets `forecast_hour = 12`
(non-null) and the badge reads `12:00` instead of `עכשיו`.

---

## P1 — works partially

### P1-1 · `analytics.js`, `intel.js`, `lpr.js` — three drawers, no mutual exclusion → "כרטיסיות נכנסות אחת מאחורי השניה"

Each drawer keeps its own `isOpen` flag, sits at `right: var(--rail-w)` /
`right: 0` with `z-index: 1000`, and toggling one never closes the others.
Open Analytics, then open Intel → Intel renders on top of Analytics, both
stay mounted. Closing Intel reveals Analytics underneath. This is the exact
user complaint from the brief.

- `analytics.js:230-240` — toggle()
- `intel.js:173-180` — toggle()
- `lpr.js:172-179` — toggle()

**Fix:** introduce a `TomorrowApp.openDrawer(name)` that closes the others
before opening the new one.

---

### P1-2 · `dispatch.js:159` + `app.js:13` — state leak: `unit.lpr_alert_id` never cleared on return-to-station

When a unit completes an LPR dispatch, the return-arrival branch only resets:

```js
unit.status = 'available';
unit.text = 'זמינה · בתחנה';
unit.dest = null;
unit.hotspot_id = null;
```

(`dispatch.js:204-207`). `unit.lpr_alert_id` (set at line 374) is left on the
unit forever. Persists into `localStorage` via `TomorrowApp.saveState()`. Not
fatal but pollutes audits and the next session.

---

### P1-3 · `app.js:24` — `loadState()` blindly merges localStorage into `State`; no schema migration

```js
function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (raw) Object.assign(State, JSON.parse(raw));
  } catch (e) { console.warn('loadState failed', e); }
}
```

The `STORAGE_KEY = 'tomorrow_state_v2'` bump (config.js:10) covers the
known v1→v2 shape change, but any future field added to a forecast item (e.g.
the `glyph`/`code` fields, which were the trigger for the v2 bump per
`.claude/memory/ARCH_PATTERNS.md:53`) is permanently absent from any forecast
loaded from v2 storage. Generated forecast is saved on first run, then
reloaded forever — `prediction.js:253` `if (State.forecast.length === 0)`
skips regeneration. A new field on hotspots → `undefined` in icons / labels
for every existing session.

**Fix:** version inside the payload (`{version, payload}`) and discard
non-matching versions, or always regenerate on load.

---

### P1-4 · `prediction.js:253` — forecast persists between sessions; "stuck" stale data masquerades as fresh

`if (!State.forecast || State.forecast.length === 0) State.forecast = generate();`
means: after the first visit, every reload reuses the cached forecast (with
all its `dispatched`/`resolved` flags) until the user hits "הרץ מודל". Threat
level, hotspot counts, KPIs all reflect yesterday's run. Combined with P1-3,
once you've dispatched all hotspots, the dashboard shows 100% coverage forever
until manual regen.

---

### P1-5 · `dispatch.js:226-231` — `onSceneSecure` ring `setInterval` is not tracked; cannot be cancelled

```js
let r = 25;
const iv = setInterval(() => { … if (r > 360) { clearInterval(iv); map.removeLayer(ring); } }, 50);
```

`iv` is captured locally and never registered in `active`. If the user logs
out mid-pulse (`btn-logout` calls `location.reload()`), the interval gets GC'd
with the page, fine. But if anything else tried to "stop all activity" (no
such API exists today), it couldn't reach these. Minor — listed because the
brief asked about interval-clear hygiene.

---

### P1-6 · `dispatch.js:166-170` and `198-202` — fade-out interval also never tracked

Same pattern, same severity. Two fade `setInterval`s per dispatch (going + returning).

---

### P1-7 · `osint.js:88-90` — `applyBoost()` is non-idempotent on `probability` if called twice without regenerate

```js
if (best && bestD <= CONFIG.SIGNAL_BOOST_RADIUS_M && !best.osint) {
  best.osint = true;
  …
  best.probability = Math.min(100, best.probability + Math.round(sig.confidence * CONFIG.FACTORS.osint));
```

The `!best.osint` guard prevents a re-boost on the same hotspot, **but**: when
the live-poll arrives and `applyBoost()` runs again with new signals, any
hotspot that absorbed a signal at boot is now ineligible — even if a fresher,
higher-confidence signal lands near it later. The model can only ever
*upgrade* a hotspot once.

---

### P1-8 · `prediction.js:65,74` + `layers.js:257,287` — `getDay()`/`getHours()` use local time, no DST guard; daily / nightly boundaries flicker around midnight

```js
const day = new Date().getDay();
…
if ((day === 4 || day === 5) && (hour >= 21 || hour <= 3)) tags.push('סופ״ש · חיי לילה');
```

For the generated forecast, `hour` is the hotspot's own hour (0..23 from the
loop), but `day` is the live wall-clock day at generation time. A forecast
generated at Thu 23:55 and viewed at Fri 00:05 still reports day=4 (Thursday)
boosts. Plus the `hour <= 3` includes hour 0..3 but the surrounding day flips
at midnight, so the "Thu/Fri night" tag is mis-applied to Wednesday→Thursday
midnight if forecast was kicked off then. Off-by-one across the day boundary.

Likewise `layers.js:257` `hour >= 20 || hour <= 4` for the bars layer ignores
that "hour" here is the *forecast* hour, not the live one; a forecast for
midnight Sunday gets the same +14 boost as midnight Friday. Probably the
intended behavior, but worth documenting as a known limitation.

---

### P1-9 · `app.js:225-228` — `showLogin` early-out skips re-attaching the `attempt` handler

```js
if (sessionStorage.getItem('tomorrow_auth') === '1') {
  overlay.style.display = 'none';
  onPass();
  return;
}
```

When auth is cached, the function returns *before* attaching `btn.click` and
the `Enter`-key listener. If `tomorrow_auth` is later cleared via
`btn-logout` (`index.html:255`) and the user clicks "Cancel" on the reload,
the login overlay is `display:none` and the buttons would not work — but the
reload triggers anyway via `setTimeout(() => location.reload(), 350)`, so this
is mostly moot. Smell.

---

### P1-10 · `app.js:330` vs `app.js:337` — `TomorrowOsint.init()` is fired **after** the modules that depend on its boost

Boot order in `startSystem()`:

```js
if (window.TomorrowPrediction) TomorrowPrediction.init();   // renders forecast list
if (window.TomorrowMap)        TomorrowMap.init();          // renders hotspots
…
if (window.TomorrowAnalytics)  TomorrowAnalytics.init();
…
if (window.TomorrowOsint)      TomorrowOsint.init();        // ← async, fires last
```

OSINT init is `async` and calls `TomorrowPrediction.refresh()` on completion
(`osint.js:180`) — fine. But `Analytics` (initial `refresh()` at
`analytics.js:34`) computes `dispatchedCount` against `State.forecast` before
the OSINT boost lands. Since dispatched count doesn't depend on OSINT, the
visible artifact is minimal — but the "אותות היתוך" stat
(`prediction.js:243`) reads `(State.signals || []).length`, which is `0`
until the fetch resolves. First-frame visual flicker.

---

## P2 — smells

### P2-1 · `analytics.js:551` family — duplicated boilerplate across drawers + zero coordination

P1-1 already calls this out functionally; structurally, `analytics.js`,
`intel.js`, `lpr.js` each maintain their own `panelEl` and `isOpen`, with
copy-pasted `injectHUDButton()` (analytics:37, intel:60, lpr:54) and
near-identical `toggle()` bodies. A single `Drawer` base would have caught
the stacking bug.

### P2-2 · `config.js:10` — `STORAGE_KEY = 'tomorrow_state_v2'` but the saved blob is unversioned

The key encodes the version, but the value is just `JSON.stringify(State)`
with no `__version` field, so future v3 code can't introspect a v2 payload to
selectively migrate. Costs nothing to add now; expensive once users have
3 KB of v2 cached.

### P2-3 · `dispatch.js:65` — unit type assignment is hard-coded to station-rank, not station `cars` count

```js
for (let i = 1; i <= Math.min(4, s.cars); i++) {
  const type = i === 1 ? 'patrol' : (i === 2 ? 'motor' : (i === 3 ? 'swat' : 'undercover'));
```

Stations configured with `cars: 6` (`config.js:84`) get only 4 units. The
`cars: 5/4` values in CONFIG are decorative — only the patrol/motor/swat/undercover
ladder of 4 ever spawns. Either trim CONFIG values or honor them with a real
crew composition.

### P2-4 · `dispatch.js:87` — `unit.callsign + '_' + Date.now() + Math.random().toString(36).slice(2,5)`

`Date.now()` has ms granularity; `Math.random().slice(2,5)` is 3 base-36 chars
(~46K possibilities). Two dispatches in the same ms with the same callsign
would collide ~1 in 23K. Not impossible in `saturateArea()` which fires up to
4 dispatches with 900ms stagger — fine — but the construction is fragile.
Prefer `crypto.randomUUID()`.

### P2-5 · `map.js:73-76` — tactical grid cells overlap forecast points stored at exact lat/lng

`makeHotspotMarker` snaps `h.lat/h.lng` to a 0.0014×0.0016 grid for the
rectangle, but the marker icon and popup are positioned at the cell *center*
(line 92-93). The hotspot's true coordinate (used in `nearestEta`, `applyBoost`,
heatmap) sits up to ~80 m from the visible marker. For demo, fine; for
"why is the ETA different from the marker position" debugging, confusing.

### P2-6 · `prediction.js:90,91` — `count = 1 + Math.floor(rng() * 3)`; up to 3 hotspots × 24h = 72; CRIME_TYPES are picked uniformly

The model is described as weighted by `base_rate` (`config.js:60-69`) but
`generate()` actually picks `CRIME_TYPES[Math.floor(rng() * len)]` — uniformly
random. `base_rate` only feeds the final score (line 123), so the *distribution*
of crime types in the forecast does not match the documented base rates.

### P2-7 · `osint.js:50` — `timeAgo` falls back to "עכשיו" if no `mins_ago` and no `ts`

```js
if (s.mins_ago != null) { … }
if (s.ts) { … }
return 'עכשיו';
```

For a malformed Firebase entry missing both, the UI shows "now" forever.
Defensively log/skip.

### P2-8 · `intel.js:140` — inline `onclick` calls `TomorrowMap.getMap().flyTo(…)` with no null guard

If the user opens Intel before Map has fully initialized (race), `getMap()`
returns `undefined`, and `.flyTo` throws. In practice Map inits before Intel
in `startSystem()`, but the contract is fragile.

### P2-9 · `app.js:107` — `setInterval(tick, 1000)` clock interval never stored / cleared

Probably benign (it lives for the page's life), but combined with the boot
interval at `app.js:184` and OSINT poll at `osint.js:187`, the app has no
global "tear-down" function. Hot-reload during dev keeps stacking timers.

### P2-10 · `index.html:75` (logo tag says `v0.2`) vs commit `a80e3be feat: Intel + LPR drawers + mobile hamburger menu (v0.4)`

`<span class="logo-tag">v0.2</span>` and the hamburger footer `TOMORROW v0.2 · נבנה ע״י אלחי פיין`
are stale.

---

## P3 — cleanup

### P3-1 · `index.html:59` — leftover `<i data-lucide="radar"></i>` after the radar mark removal

Brief says `radarEl` was supposed to be removed. The DOM `radarEl` is gone
(no JS refs), but the lucide `radar` icon is still rendered in the header
logo mark. Cosmetic, but contradicts the "radar removed" claim.

### P3-2 · `app.js:18` — `window.TomorrowApp = (function () { … })()` declared but `window.TomorrowState` declared *outside* the IIFE

`State` is read via the global `window.TomorrowState` in app.js but each other
module captures `const State = window.TomorrowState` at its own IIFE eval
time. Since `TomorrowState` is set before any module IIFE runs (config →
sounds → app loads State before prediction/map/etc. eval), this is OK — but
fragile. If someone moves `<script src="app.js">` after another module, the
references break silently.

### P3-3 · `dispatch.js:64-66` — minified unit-type ladder makes per-station composition unreviewable

```js
const type = i === 1 ? 'patrol' : (i === 2 ? 'motor' : (i === 3 ? 'swat' : 'undercover'));
```

Extract to a constant array.

### P3-4 · `analytics.js:599` — string-concat math (`progress = stepCount / totalSteps`) with floating-point compare to `1.0`

`stepCount >= totalSteps` is integer-safe, so OK. But `progress` is then
used in `drawRocCurve(progress)` where `points.length * progress` could land
mid-segment. Cosmetic only — backtest visual is best-effort.

### P3-5 · `signals.sample.json` — schema mostly matches the client, **but** the demo lacks any signal whose `risk` would actually beat a default hotspot's risk

Sample signals have `risk: 1..3`. Hotspots default to whatever
`scoreToRisk(score)` returns (mostly 2-4 in observed runs). `osint.js:90`
`if (sig.risk < best.risk) best.risk = sig.risk;` ⇒ the OSINT-driven risk
escalation IS exercised in the demo (sample tg-2041 has risk 1, tg-2044 has
risk 1). Just noting that the contract is fragile: if a future signal has
`risk = null` or string `"1"`, the comparison silently fails.

### P3-6 · `scripts/mcp-sheets/server.js` — top-level `await` is valid (ESM), and the deps in `package.json` look correct, but the MCP `tool()` signatures pass a Zod *schema object* (positional arg 3) where MCP SDK v1.18 expects a `{ inputSchema: z.object({…}) }` wrapper

`server.tool('sheets_read_range', 'description', { spreadsheetId: z.string(), … }, async (…) => {…})`

The SDK's `tool()` historically accepted a raw Zod *object shape*, but as of
v1.x it requires `z.object({…})` or an `inputSchema` key. Worth a smoke-run
(`npm start`) to verify; if it throws on registration, this is P0. Listed
here because the audit asked specifically.

---

## Summary

| Severity | Count |
|----------|-------|
| P0 | 5 |
| P1 | 10 |
| P2 | 10 |
| P3 | 6 |
| **Total** | **31** |

Highest-impact one-line fixes:

1. `layers.js:247` — replace `(lat1-lat2)**2 + (lat1-lat2)**2` with real haversine.
2. `analytics.js:551` — `ctx.strokeStyle = '#00e5ff';` (not `'var(--cyan)'`).
3. `index.html:91` — `data-trigger="btn-layers"` (not `btn-sim`).
4. `app.js:316` / `prediction.js:262` — re-apply OSINT boost after every `regenerate()`.
5. Introduce a single `TomorrowApp.openDrawer(name)` so Intel / LPR / Analytics close each other.

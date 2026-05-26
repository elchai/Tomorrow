# Reality Check Report

**Target:** c:/Users/User/Desktop/DEV/Tomorrow
**Date:** 2026-05-26
**Focus:** all

## Summary

| Category | Critical | Warning | Minor | Info |
|----------|----------|---------|-------|------|
| Mock Abuse | — | — | — | — |
| Fake Implementations | 2 | 3 | 1 | 1 |
| Error Handling | — | 1 | 2 | 1 |
| Meaningless Tests | — | — | — | 1 |
| Hidden Debt | 1 | 2 | 2 | — |
| Shallow Health Checks | — | — | — | — |
| **Total** | **3** | **6** | **5** | **3** |

Static frontend, no test suite → mock/test/health categories mostly N/A. The deception risk in this codebase is **false confidence in demo data** — not silent error swallowing.

---

## Findings

### [FAKE-001] Whole-product demo data presented through a "AUTHORIZED PERSONNEL ONLY" gate (critical)
**Files:** `signals.sample.json`, `intel.js:13-55`, `lpr.js:13-45`, `prediction.js:1-30`, `config.js:67-128` (STRATEGIC_EVENTS), `index.html:21` (classification banner)
**Evidence:**
```
// prediction.js
mock model — designed so a real model / API can be dropped in behind getForecast()

// intel.js
// ---- Demo target dossier (placeholder; later wired to real OSINT pipeline) ----

// lpr.js
// ---- Demo LPR feed (placeholder; later wired to live camera grid + stolencar API) ----

// signals.sample.json
"source": "@telaviv_police_scanner",
"text_he": "דיווח על קטטה אלימה ..."   // fabricated quote attributed to a real-sounding handle
```
**Problem:** The login screen says `SECURE OPERATIONS SYSTEM // AUTHORIZED PERSONNEL ONLY` and the app shows realistic-looking criminal dossiers, cellular pings, named police stations, "@telaviv_police_scanner" sources — all fabricated, but no top-level disclaimer to a casual viewer. Disclaimers exist *inside* the Intel + LPR drawers (intel.js:162, lpr.js:122) but they're discovered only by clicking through.
**Recommendation:** Add a persistent DEMO ribbon at the top of the dashboard (`.demo-ribbon { position: fixed; ... background: var(--medium); }`) saying "תצוגת דמו · נתונים פיקטיביים". Rename Telegram handles in signals.sample.json to `_example` suffixes (matches scanner/channels.js convention).
**Effort:** S

### [FAKE-002] Backtest "success" toast lies about validation (critical)
**File:** `analytics.js:666-667`
**Evidence:**
```js
TomorrowApp.toast('✅ אימות המודל לאחור הושלם בהצלחה!', 'success');
TomorrowApp.logEvent('model', 2, `📊 אימות מודל (Backtest) מול 30 ימי עבר בוצע בהצלחה: ROC-AUC = ${finalRoc}, Precision = ${finalPrec}%, Recall = ${finalRec}%`);
```
**Problem:** The backtest doesn't actually run a model against historical data — it generates the metrics. The toast and operational log entry both claim formal validation occurred. A buyer (Guy Nir) reading the intel log sees "מודל אומת מול 30 ימי פשיעה" and may believe a real statistical test happened.
**Recommendation:** Either (a) implement a real rolling backtest using a stored historical buffer, or (b) change the strings to "סימולציית הדגמת אימות" / "demo simulation" and gate the button with a disclaimer.
**Effort:** S (relabel) / L (real impl)

### [DEBT-001] No tracking IDs on placeholders (critical)
**Files:** `intel.js:14`, `lpr.js:13`, `prediction.js:4`, `osint.js:3-6`, `config.js:21`, `dispatch.js:106`
**Evidence:**
```js
// intel.js:14
// ---- Demo target dossier (placeholder; later wired to real OSINT pipeline) ----

// config.js:21
const FIREBASE_URL = '';                 // e.g. 'https://tomorrow-xxxx-rtdb.firebaseio.com'
```
**Problem:** Every "wire later" comment lacks a ticket/issue reference, so they accumulate silently. The whole product is built on these temporary placeholders; without IDs they become permanent.
**Recommendation:** Track each "wire later" item in `docs/audits/2026-05-26-mega-audit/03-findings/future.md` (just produced) and add `// see future.md#S1-X` references in the code. Or create GitHub issues labelled `wire-later`.
**Effort:** S

### [FAKE-003] LPR drawer claims `match_src: 'stolencar · גניבת רכב 2026-05-20'` for fabricated plates (warning)
**File:** `lpr.js:18`
**Evidence:**
```js
status: 'stolen', match_src: 'stolencar · גניבת רכב 2026-05-20',
```
**Problem:** The `match_src` string implies the alert was confirmed against the actual gov.il/police/stolencar registry. A demo viewer who doesn't read the disclaimer at the bottom of the drawer (lpr.js:122) may misread these as real hits.
**Recommendation:** Prefix demo statuses: `match_src: 'demo · stolencar simulation 2026-05-20'`. Keeps the UX shape, removes the credibility steal.
**Effort:** S

### [FAKE-004] Strategic events behave as if real, but boosts are hand-tuned magic numbers (warning)
**File:** `config.js:74-128`
**Evidence:**
```js
{ key: 'football_riot', ..., crime_boosts: { assault: 32, disorder: 25, vandalism: 18 }, ... },
{ key: 'heatwave',      ..., crime_boosts: { domestic: 18, assault: 15 }, ... },
```
**Problem:** Numbers like `+32%` for football riots have no source citation. In a demo they're fine, but the analytics drawer pulls them through into the ROC metrics — a buyer asking "what justifies +32%?" gets no answer.
**Recommendation:** Either cite a source per multiplier in a comment (`// boost magnitude from Greenfeld 2008 study, p.42`) or visibly mark them as `demo_boost` in the data model and exclude from ROC math.
**Effort:** S-M

### [FAKE-005] `printPatrolOrder` uses `document.write` to render a fake "official" order (warning)
**File:** `app.js:405`, `app.js:550`
**Evidence:**
```js
printWindow.document.write(`<!doctype html>...
  <h1>פקודת סיור מונחת</h1>
  <p>סמכות: מפקד מרחב ...</p>
`);
```
**Problem:** Generates a print-ready document styled as an official patrol order, with police-station letterhead. If anyone screenshots this from the demo and shares it, it could be misread as a real document.
**Recommendation:** Watermark the output with "DEMO – לא לשימוש מבצעי" diagonally across the page (CSS `background: linear-gradient` repeating watermark text). Also: this print path was previously called "מגוחך" by the user — the button is removed from the popup but the function still exists in app.js. Consider deleting.
**Effort:** S

### [ERROR-001] `scanner/telegram-client.js:54` swallows getChat errors silently (warning)
**File:** `scanner/telegram-client.js:54`
**Evidence:**
```js
try {
  const chat = await msg.getChat();
  key = chat && (chat.username || String(chat.id));
} catch { /* ignore */ }
```
**Problem:** When `getChat()` fails (auth issue, network blip, banned channel), the message gets classified with `key = 'unknown'` and reliability defaults to 5 — silently misclassifying real intel as low-trust. No log breadcrumb.
**Recommendation:** `catch (e) { console.warn('getChat failed for msg', msg.id, e.message); }`. Don't downgrade to silent.
**Effort:** S

### [ERROR-002] Async fire-and-forget after init — `osint.js` loadSignals (minor)
**File:** `app.js:337` and `osint.js:142-165`
**Evidence:**
```js
if (window.TomorrowOsint) TomorrowOsint.init();   // OSINT signals (async) — boosts forecast
```
`TomorrowOsint.init()` returns a promise that's never awaited. If fetch fails, `console.warn` happens (good) but the rest of `startSystem` already completed and the toast `'📡 N אותות OSINT נטענו ...'` runs anyway with N=0.
**Problem:** The toast misleads — a network failure produces "📡 0 אותות OSINT נטענו (דמו)" which a viewer may interpret as "no threats detected" instead of "fetch failed".
**Recommendation:** In the fetch catch, emit a distinct toast: `'⚠ טעינת OSINT נכשלה — חיווי לא זמין'`.
**Effort:** S

### [ERROR-003] Listener for module clicks attached BEFORE the module guarantees its panel exists (minor)
**File:** `intel.js:69`, `lpr.js:64`
**Evidence:**
```js
btn.addEventListener('click', toggle);  // before buildPanel() in init()
```
**Problem:** Rapid first-click before init completes → `toggle()` tries `panelEl.classList.toggle('open')` on a not-yet-built panel. Probably never happens (init runs synchronously), but it's fragile.
**Recommendation:** Move the listener registration *after* `buildPanel()`. Order: inject → build → wire.
**Effort:** S

### [DEBT-002] `sounds.js` has a no-op catch that hides AudioContext errors (warning)
**File:** `app.js:93`
**Evidence:**
```js
try { lucide.createIcons(); } catch (e) { /* noop */ }
```
**Problem:** This is the lucide call, not sounds — but the pattern: `/* noop */` swallows the error and never reports if icon rendering breaks. A buyer who sees missing icons on the live site has no clue why.
**Recommendation:** Replace with `catch (e) { console.warn('lucide.createIcons failed', e); }`.
**Effort:** S

### [DEBT-003] `_audit_capture.mjs` and root `package.json`/`package-lock.json` are untracked but should be gitignored (minor)
**Evidence:**
```bash
$ git status --short
?? _audit_capture.mjs
?? package-lock.json
?? package.json
```
**Problem:** Local audit-tooling artifacts. If accidentally committed, they introduce a phantom Node project at repo root that confuses readers.
**Recommendation:** Add to `.gitignore`:
```
/_audit_*.mjs
/_verify.mjs
/package.json
/package-lock.json
/node_modules
```
**Effort:** S

### [DEBT-004] Stale `v0.2` version label in HUD while latest commit is v0.5+ (minor)
**File:** `index.html:78`
**Evidence:**
```html
<span class="logo-tag">v0.2</span>
```
**Problem:** Public-facing version is wrong. A buyer using the site link cannot tell which version they're seeing.
**Recommendation:** Either bump manually to `v0.5` now and on each release commit, or replace with a build hash injected at deploy time.
**Effort:** S

### [TEST-001] Zero automated tests in the project (info)
**Evidence:** No `*.test.js`, `*.spec.js`, `__tests__/`, `tests/` directories anywhere.
**Problem:** Not flagged as critical because Tomorrow is a vanilla-JS visual product and `_verify.mjs` Playwright scripts serve as the de facto E2E test. But once Firebase, real OSINT, and real auth land, this becomes unsafe.
**Recommendation:** When backend integration starts (Sprint 1 per future.md), add Vitest for prediction.js classifier logic + Playwright for E2E. Defer until then.
**Effort:** M (when needed)

---

## Verdict

**Honest framing, but easy to misread.** The codebase consistently admits its mock nature in JSDoc comments, dot-files, and per-drawer disclaimers. The danger is not silent error swallowing or fake green tests — it's that the **chrome around the demo (login gate, official-looking print order, "backtest completed successfully" toast, named police-scanner Telegram handles) outpaces the disclaimers**. Anyone showing this to a buyer for 60 seconds without context will form a stronger impression of completeness than the code claims.

**Top 3 fixes for credibility hygiene:**
1. Persistent demo ribbon at the top of the dashboard (FAKE-001)
2. Re-label the backtest success toast (FAKE-002)
3. Rename fabricated Telegram handles + add demo prefix to LPR `match_src` (FAKE-003)

Total time to honest: ~2 hours.

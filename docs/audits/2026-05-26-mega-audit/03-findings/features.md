# Feature Proposals — Tomorrow (v0.4 → v1.0)

Audit date: 2026-05-26
Author: Tomorrow product audit
Scope: New features to make Tomorrow a credible B2B sale to Israeli Police (Mahoz Telef-Aviv pilot → district expansion).

---

## Framing

The current product (v0.4) is a polished tactical *visualizer* — forecast cards, animated dispatch, OSINT layer, Intel drawer, LPR drawer, RTM contextual layers, analytics drawer. It looks good. But to win a procurement, three gaps must close:

1. **Workflow gap** — today the user "looks" at the map. Police buy software that *does work for them* between shifts: hand-over notes, BOLO ingestion, after-action reports, briefing prints.
2. **Truth gap** — every demo today is mock data. Even a single live feed (one camera, one Telegram channel, weather API) flips the conversation from "looks nice" to "this is real".
3. **Multi-user gap** — there is exactly one user. A district has dispatchers, ש"ג at the תחנה, מודיעין analysts, מ"מ צוותים in the field, and a קצין תורן above all of them. Without role separation Tomorrow can only sell to one seat per district.

The 17 features below are grouped by how much each closes those gaps. Every feature lists what touches what — so the engineering manager can plan the next sprint without re-reading the codebase.

**Severity legend**
- **MH** — *Must-have*: without this the demo lands flat. Build these first.
- **SD** — *Strong differentiator*: turns "interesting" into "we need to buy this".
- **NH** — *Nice-to-have* / future moat.

**Complexity legend**: S ≤ 1 day, M ≤ 3 days, L ≤ 1 week, XL > 1 week.

---

## Must-haves (credible demo)

### 1. Shift handover & briefing mode — **MH** — complexity **M**
A full-screen "תדריך משמרת" view triggered from the HUD that walks through: yesterday's events that bled into today, top 5 forecast hotspots for the next 8h, active strategic events (Kaplan protest, derby, heatwave), open BOLO targets, LPR hot hits in last 12h. Auto-advances slide by slide (15s each) or click-through; ends with a "אישור קבלת משמרת" stamp. Why it matters: every Israeli police shift opens with a `יומן משמרת` briefing — if Tomorrow becomes the medium for that briefing, the system becomes mandatory, not optional. Fits in the existing nav-rail as a new icon (`presentation` lucide); reuses forecast/intel/lpr data sources.
*Modules:* new `briefing.js` (drawer or fullscreen overlay), reads from prediction/intel/lpr/layers, adds a "shift_handover" log entry.

### 2. After-action review (AAR) + shift summary PDF — **MH** — complexity **M**
At end of shift, generate a printable PDF: predicted vs. actual hits, dispatches made, ETA achieved vs. promised, hot LPR plates resolved/open, OSINT signals processed, top 3 zones that consumed patrol minutes. Hebrew RTL, header with תחנה logo + שעות משמרת + שם תורן. Why it matters: this is the artifact that travels up the chain to מפקד מרחב and that קצין מבצעים needs for the weekly מעקב. It's also the cheapest "the system saves me time" sell because today this report is hand-typed in Word. UI: button in analytics drawer footer.
*Modules:* new `report.js` (uses `window.print()` with a print-only stylesheet, or jsPDF). Pulls from `State.intel_log`, `State.forecast`, dispatch history (needs a small dispatch log addition in `dispatch.js`).

### 3. Role-based views (Commander / Dispatcher / Analyst) — **MH** — complexity **L**
`CONFIG.ROLES` already exists with 4 levels but nothing reads it. Wire it so:
- **Dispatcher** sees forecast + units + dispatch buttons + LPR hot list only — strips analytics, RTM editor, model weights.
- **Analyst** sees forecast + RTM layers + analytics drawer + intel drawer; no dispatch button.
- **Commander** sees everything plus a district-wide aggregate strip across all 5 stations.
- **Viewer** = read-only audit mode.
Picker at login (below the access code) or auto-bind to user identity once real auth is in. Why it matters: a single screen with 40 controls scares procurement; three focused screens reassure them. Also lets sales price-per-seat.
*Modules:* `app.js` (role state + apply gate), `index.html` (role picker on login), each drawer's `init()` short-circuits if role mismatch. Touches: `analytics.js`, `intel.js`, `lpr.js`, `dispatch.js`, `prediction.js` (hide dispatch CTA).

### 4. Live LPR ingestion (one real camera, demo or pilot) — **MH** — complexity **M**
Today LPR is a static array of 5 hard-coded alerts in `lpr.js`. Replace with a polling loop against either (a) a Firebase `/lpr-hits` node mirroring the OSINT pattern, or (b) a public LPR demo feed (e.g., the [stolencar.gov.il](https://www.gov.il/he/Departments/Guides/iden_car) RSS-ish lookup) to do hourly cross-check of known-stolen plates near each TLV camera point. Even *one* real camera makes the rest of the demo feel real. Why it matters: LPR is the closest thing Tomorrow has to "we plug into your existing infrastructure" — and the police already have the camera grid.
*Modules:* `lpr.js` (replace `ALERTS` const with `let alerts = []` + `pollLPR()` mirroring `osint.js:pollSignals`), `config.js` (LPR_FEED_URL).

### 5. Dispatch decision-support: "Suggest closest unit" — **MH** — complexity **S**
On the dispatch button, instead of just sending whatever unit `responseCard` says, show a 1-click suggestion: *"מומלץ: ניידת 1041 (4 דק׳ ETA, צוות בן 2 שוטרים, סטטוס זמין)"* with the option to override. Pulls from existing `nearestEta` + `responseCard`. The point isn't AI — it's making the dispatcher's choice visible to their commander and audit-loggable. Why it matters: a חוקר זנב later asking "למה הזנקת את 1041 ולא 1099?" finds an answer in the log. Compliance gold.
*Modules:* `dispatch.js` (add suggestion preview), `prediction.js` forecast card (show suggested unit chip below ETA).

### 6. Audit log — who saw what target & when — **MH** — complexity **S**
Every open of an Intel target drawer, every dispatch, every LPR alert clicked, every export gets a row: `{when, user, action, entity_id, station_id}`. Stored in localStorage now (mock), wired to backend later. Surface it as a "יומן פעולות" tab inside analytics drawer. Why it matters: Israeli police data privacy (חוק המידע הפלילי, תקנון 90.221) requires this. Without it the procurement officer's first question shuts the demo down.
*Modules:* new `audit.js` (tiny — `record(action, payload)` + `getAll()`), instrument `intel.js`/`lpr.js`/`dispatch.js` to call it. Add tab in `analytics.js`.

### 7. Weather + heat overlay on prediction — **MH** — complexity **S**
Pull a single weather data point (Open-Meteo or IMS public API — both free, no key) for TLV every 30 min: temperature, rain, wind. Inject as a `weather` boost in `prediction.js` similar to the `STRATEGIC_EVENTS` mechanism. Heatwave → +15% on domestic + assault (already in `STRATEGIC_EVENTS.heatwave`, just auto-toggle). Heavy rain → -20% on outdoor crime. Show a tiny weather chip in HUD. Why it matters: it's the single cheapest "real data integration" win — Open-Meteo is one fetch call, no auth, and it lets the demo say "the model already reads live weather".
*Modules:* `app.js` (weather poll on boot + every 30m), `prediction.js` (apply weather coefficient), HUD chip in `index.html`.

---

## Strong differentiators

### 8. PWA companion for field patrol — **SD** — complexity **L**
A mobile-only PWA at `/field` showing: my assigned hotspots, my route, panic/בקול קודי button, photo upload from scene tagged to a hotspot ID, voice memo for incident note. Works offline (service worker + IndexedDB queue, like FireOps's `sw.js` pattern). Pushes back to the dispatcher's screen as "ניידת 1041 הגיעה ליעד #4082 — ראה תצלום". Why it matters: the cars in TLV have rugged Samsung tablets running outdated apps; a clean PWA that opens in a browser bypasses MDM hell. Also it doubles seat count.
*Modules:* new directory `field/` with its own `index.html` + minimal JS; shared `config.js`. Reuses Leaflet + the dispatch trail data.

### 9. Real-time multi-user collaboration via Firebase — **SD** — complexity **L**
The OSINT layer already reads from `/crime-signals` (when wired). Extend to: dispatchers see each other's cursor on the map (442-style live presence), assignments to hotspots show which dispatcher claimed them ("נתפס ע״י מוקדן יוסי · 14:22"), intel notes append-only with name+timestamp, log entries broadcast. Why it matters: a district has 3–5 simultaneous dispatchers; without collab they overlap dispatches. With it, the system becomes the canonical state of the shift.
*Modules:* `app.js` (firebase init + presence channel), small wrapper `realtime.js`, instrument dispatch + intel + log to publish + subscribe. Needs the FIREBASE_URL config that's currently empty.

### 10. AI incident summarizer — **SD** — complexity **M**
A "סכם מבצע" button on any dispatched hotspot card that, after the unit returns, asks an LLM (Anthropic API or local) to write a 3-line summary: what was predicted, what happened, what the unit reported. Stored in the AAR. Why it matters: the part of police work that everyone hates is writing it down. If Tomorrow auto-drafts and the תורן just edits, you've saved them 20 minutes per shift.
*Modules:* new `ai.js` (single function `summarize(events) → string`), called from dispatch on `onArrive`/`onReturn`. Server-side proxy needed to hide API key.

### 11. Anomaly detector — "this is unusual" badge — **SD** — complexity **M**
A small ML-lite check: for each hotspot, compare today's score against the 14-day rolling average for the same crime+zone+hour. If z-score > 2.5, badge the card "חריג · +250% מהממוצע". Same for LPR hit clusters (5+ stolen-plate hits in same 1km in 1h → "אשכול חריג"). Why it matters: a chief skimming 30 cards doesn't read every one — but they look at the red badge. It's also the seed of a real predictive moat.
*Modules:* new `anomaly.js`, needs a tiny history buffer in `localStorage` (rolling 14d). Calls into prediction render to add the badge.

### 12. BOLO ingestion (Be On The LookOut list) — **SD** — complexity **M**
A dedicated drawer (or tab inside Intel) that reads the day's BOLO list — vehicles, persons, plates, addresses — from a simple JSON feed (Firebase node or pasted-in CSV upload for the demo). Cross-references against: LPR hits (auto-flag), Intel targets (link), forecast hotspots (proximity warning). The "BOLO · התראת מפקד" tag already exists in `lpr.js:42` — promote it to a first-class feed. Why it matters: BOLO management is a paperwork nightmare in current police IT. Owning this workflow is sticky.
*Modules:* new `bolo.js` drawer, instrument `lpr.js` to check plate against BOLO list, instrument `intel.js` to show BOLO badge on target.

### 13. Predicted vs. actual analytics + model precision — **SD** — complexity **M**
Extend the existing analytics drawer with a real backtesting tab: every closed shift, log "predicted hotspots" vs. "actual events that occurred near them" (within 500m, ±2h). Compute precision, recall, F1 over a rolling 30 days. Display as a single big number: "*דיוק המודל ב-30 ימים אחרונים: 64%*". Why it matters: the buyer's hardest objection is "is the prediction real?". A precision number that updates weekly disarms it. This is what makes Tomorrow defensible against in-house spreadsheets.
*Modules:* `analytics.js` (new tab "אמינות מודל"), needs the same 14-day buffer as feature 11. Mock for v0.5; real once actual incident feed is wired.

### 14. Hierarchical command view (district → station → patrol) — **SD** — complexity **L**
A "מפת המרחב" toggle that zooms out to all 5 stations side-by-side: each shows its own forecast count, hot LPR count, units available/deployed, current DTI level. Drill-down to a station opens its detail view (today's flow). Why it matters: this is the slide that wins the deal with קצין מרחב — they don't care about one station, they care about all of them at once. Also unlocks the multi-district expansion story.
*Modules:* new `district.js` (overview), shared station registry, reuses prediction/lpr/dispatch aggregations.

### 15. Push notifications + escalation tree — **SD** — complexity **M**
When a critical (risk=1) hotspot appears and no unit is dispatched within 5 min, escalate: toast → ping the תורן → if still ignored after 10 min, send a (mock) SMS to the station commander. Configurable per role. Browser Notification API for the desktop side, Firebase Cloud Messaging for the PWA. Why it matters: this is the difference between a passive map and an active operational system. Pairs with role-based views (feature 3).
*Modules:* new `notify.js`, hooked into prediction render + a 5/10-min cron in `app.js`. Settings UI inside role config.

---

## Future / nice-to-have

### 16. Replay / time-machine — **NH** — complexity **M**
Drag the timeline backward (it currently only goes 0–23 forward). Show what was predicted at that time vs. what actually happened. Animate dispatch trails from history. Why it matters: in training and AAR, "play yesterday's shift" is gold. Also a great sales demo: "watch the night of the protest play out in 30 seconds".
*Modules:* `app.js` (timeline mode toggle), needs incident history (depends on feature 13 buffer).

### 17. Cellular anomaly heatmap (from Guy Nir's sheet) — **NH** — complexity **L**
A separate map layer showing aggregate cellular density anomalies — unusual concentrations of devices (e.g., 800 phones in a 200m radius at 02:00 in an industrial zone = suspicious gathering). Sourced from a mock CDR feed for demo, later from telecoms / שב"כ feeds via the appropriate legal channel. Why it matters: Guy Nir specifically called this out as a high-value angle and it's the kind of capability that makes Tomorrow look like SIGINT-grade, not just GIS.
*Modules:* new `cell.js` layer, reuses `layers.js` pattern. Feed mock first.

### 18. Multi-district / national expansion — **NH** — complexity **XL**
GeoJSON boundaries for all 14 police districts, station registry expansion (~80 stations countrywide), district-level KPIs, cross-district BOLO propagation. Sprint after pilot wins. Why it matters: this is the post-pilot growth story — same product, more seats.
*Modules:* `config.js` STATIONS becomes data-driven (`stations.json`), `prediction.js` ZONES likewise, plus a new district picker above the station chip.

### 19. Integration: Interpol I-24/7 + Sheba detention follow-up — **NH** — complexity **XL**
Plate/identity matches against Interpol watch-lists (legal channel via INP only), and a "Sheba" workflow that tracks a detained suspect from arrest → station → court → release, alerting if their cellular ping returns near the predicted hotspot they were arrested in. Why it matters: this is the moat. Once you're the system tracking custody-to-release loops, you're embedded.
*Modules:* new `integrations/` directory; `interpol.js` + `detention.js`. Heavily backend; client just consumes.

### 20. Voice-driven dispatch (Hebrew) — **NH** — complexity **L**
"*קלוד, הזנק ניידת לתחנה המרכזית, רמת קריטי*" using Web Speech API (Hebrew Chrome) or a server-side Whisper proxy. The dispatcher's hands stay on the radio. Why it matters: it's the "wow" moment in a sales demo and aligns with the wider trend of voice-first ops. Not a procurement-mover on its own, but it makes the video that gets shared internally.
*Modules:* new `voice.js`, Web Speech API → parse → call `dispatch.js`/`prediction.js` functions.

---

## Suggested sprint order (next 4 weeks)

| Week | Build |
|------|-------|
| 1 | **Audit log (6)** + **Weather (7)** + **Suggest closest unit (5)** — three small wins, all visible in the demo |
| 2 | **Role-based views (3)** — unlocks the multi-seat sales pitch |
| 3 | **Shift handover briefing (1)** + **AAR PDF (2)** — the workflow story |
| 4 | **Live LPR ingestion (4)** — pivots demo from "mock" to "real" |

After this, the demo can credibly say: "*Tomorrow ingests real LPR + weather, distinguishes 3 roles, audits every action, opens with a briefing and closes with a PDF report*". That's enough to ask for a pilot signature.

Then v1.0 adds the differentiators (PWA, multi-user, AI summarizer, anomaly detector, BOLO, model precision, district view, notifications) — in that order, since each builds on the last.

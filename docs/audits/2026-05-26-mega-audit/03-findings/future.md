# Future Roadmap — Tomorrow

**Author:** Tomorrow product audit, Claude Opus 4.7
**Date:** 2026-05-26
**Context:** Synthesis of `ui-ux.md`, `bugs.md`, `security.md`, `mobile.md`, `features.md`
plus `CURRENT_SPRINT.md`, `ARCH_PATTERNS.md`, `REGISTRY.md`, feedback memory.
**Audience:** Elchai Fine (builder) selling to former Deputy Commissioner **Guy Nir**.

---

## North star

Stop calling this a "demo". Within **8 weeks** Tomorrow must:
1. Survive a 30-minute live walkthrough with Guy Nir without a P0 visual bug.
2. Show **one real data feed** wired end-to-end (weather is the cheapest; LPR is the loudest).
3. Have a defensible answer to *"מה ההבדל בינך לבין אקסל?"* — that answer is **the precision number** (feature 13) + **the audit log** (feature 6) + **role separation** (feature 3).

Anything that doesn't move the needle on those three things is a distraction until pilot signature.

---

## Sprint 0 — Demo readiness (1 week)

Block all P0 findings that would embarrass us in front of Guy Nir. **Nothing in this list takes more than 4 hours.** No new features.

### Visual / UX P0 — items that look broken on screen-share

1. **`layers.js:247` haversine fix** (bugs P0-1). Today `getDistance()` squares `(lat1-lat2)` twice and never reads longitude — every RTM boost is wrong. Replace with the haversine that already exists in `osint.js:20`. *15 minutes. This is the single most embarrassing line of code in the repo.*
2. **Drawer → map gray tiles** (ui-ux P0 #1). Call `TomorrowMap.getMap().invalidateSize()` 320ms after every drawer toggle. Apply in `analytics.js:229`, `intel.js:173`, `lpr.js:172`. *30 minutes.*
3. **Unify drawer slide mechanism + mutual exclusion** (ui-ux P0 #2, bugs P1-1). Introduce `TomorrowApp.openDrawer(name)` that closes other drawers and uses the `.drawer-panel.open` class. Migrate `analytics.js` off its inline `right: -310px` system. *2 hours.*
4. **Surface the footer** (ui-ux P0 #3). `#layout { height: calc(100vh - var(--hud-h) - var(--footer-h)); }` with `--footer-h: 56px`. Daghazahav credit is contractual. *15 minutes.*
5. **Version label** (ui-ux P0 #4). Bump `v0.2` → `v0.6` everywhere (hamburger footer + HUD), behind a single `CONFIG.VERSION` constant. *10 minutes.*
6. **OSINT re-application after `regenerate()`** (bugs P0-4). Export `TomorrowOsint.applyBoost` and call it after every `prediction.regenerate()`. Without this, the OSINT badge disappears the moment Guy toggles any RTM layer — instantly killing the OSINT story. *20 minutes.*
7. **Hamburger → RTM modal is dead button** (bugs P0-2). `data-trigger="btn-layers"` in `index.html:91`. *5 minutes.*
8. **ROC canvas color** (bugs P0-3). `ctx.strokeStyle = '#00e5ff'` (canvas API ignores CSS vars). *2 minutes.*

### Security / credibility P0

9. **Demo banner on the live site** (security P0-1, P0-2). One line on login + one on hamburger footer: *"קונספט · נתוני דמו · לא משטרת ישראל"*. Drops the "AUTHORIZED PERSONNEL ONLY" misrepresentation. *15 minutes.*
10. **Rename fabricated Telegram handles** (security P0-3). Change `@telaviv_police_scanner`, `@florentin_live`, etc. to `@tlv_alerts_demo`, `@florentin_demo`, etc. — in `signals.sample.json` *and* `intel.js`. Eliminates impersonation/defamation risk. *15 minutes.*
11. **Remove personal phone from public footer** (security P1-4). Move to contact form or remove. *5 minutes.*
12. **CSP meta + SRI + pin `lucide@<version>`** (security P1-2). One-line CSP, three `integrity=` hashes. Optional but cheap. *45 minutes.*

### Mobile P0 — Guy might open it on his iPhone

13. **Drawer position fix on mobile** (mobile P0 #1, #2). Inside `@media (max-width:768px)`: `.drawer-panel { position: fixed; top: var(--hud-h); }`. Move analytics drawer onto the same CSS class. *1 hour.*
14. **Intel-feed Hebrew overflow** (mobile P0 #5). `.intel-row { min-width: 0; } .intel-text { word-break: break-word; }`. *5 minutes.*

**Exit criteria for Sprint 0:** Playwright run captures the 11 desktop + 11 mobile + 11 tablet screenshots with **zero gray map tiles, no overflowing red text, no fabricated Telegram handles, footer visible, all drawers mutually exclusive**.

---

## Sprint 1 — Real-data wiring (2-3 weeks)

The transition from demo to MVP. **One real feed at a time, smallest first**, each fully wired before the next starts.

### Order and rationale

15. **Weather → prediction** (features #7, complexity S). Open-Meteo, no auth, one fetch every 30 minutes. Inject into `prediction.js` as a boost coefficient. Lowest integration cost in the entire roadmap. **First** because: it proves the "live data" muscle without any procurement, and the heatwave story for TLV summer is *immediately* relatable.
16. **Audit log infrastructure** (features #6, complexity S). New `audit.js` with `record(action, payload)` + `getAll()`. Instrument `intel.js` / `lpr.js` / `dispatch.js`. Stored in localStorage now, designed for backend swap. **Second** because: every subsequent integration adds audit rows for free — it's free metadata.
17. **"Suggest closest unit" + dispatch rationale logging** (features #5, complexity S). Already have `nearestEta` + `responseCard`. Just surface the choice as a tooltip and log it. Pairs naturally with audit log. **Third** because: small, cheap, demo-flashy.
18. **Predicted-vs-actual rolling buffer** (features #13 — buffer only, no UI yet). Start logging a 14-day history of `{forecast_id, predicted_score, occurred_within_500m_2h, actual_crime}` into `localStorage`. We need this data accreted *before* we can show a precision number; start now even though the UI ships in Sprint 2.
19. **Live LPR feed — Firebase node** (features #4, complexity M). Replace `lpr.js` static `ALERTS` with a poll against `${FIREBASE_URL}/lpr-hits`. Even a hand-curated Firebase node updated by Elchai daily counts as "live". This is **the** demo pivot: from "mock LPR" to "the system received a new alert at 14:22". This requires the **Firebase backend decision** below.
20. **OSINT scanner goes live** — only **after** XSS hardening lands. The escape work below is non-negotiable.

### Hard prerequisites that ship within Sprint 1

21. **Real auth + drop the "2024" gate** (security P0-1). Firebase Auth with email magic link, or Auth0 free tier. The current gate is the **single biggest credibility risk in the entire app**: anyone who looks at the HTML sees a string `"2024"` literal. Replace with real auth before *any* live feed lands, because the moment data becomes sensitive the "AUTHORIZED PERSONNEL ONLY" theatre becomes a legal exposure.
22. **`escapeHtml()` + URL allowlist** (security P1-1, P2-5). Five-line helper, applied to every OSINT field. **Must land before the live scanner ever runs against a Telegram channel.** Without it, the first attacker-controlled Telegram post becomes JS execution on every dashboard session.
23. **Firebase rules: public-read, service-write only on `/crime-signals` and `/lpr-hits`** (security P1-3). Service account, not legacy DB Secret.
24. **Forecast no longer persists across sessions** (bugs P1-3, P1-4). Either version the payload `{version, payload}` and discard mismatches, or regenerate every load. Today the app shows yesterday's run forever.

**Exit criteria for Sprint 1:** Weather chip ticks in HUD. Audit drawer shows real rows. LPR list updates from Firebase live during the demo. Auth is real. XSS-resistant.

---

## Sprint 2 — Differentiation features (1-2 months)

These features make the conversation move from "interesting visualizer" to "we can't run a shift without this".

25. **Role-based views (Commander / Dispatcher / Analyst)** (features #3). `CONFIG.ROLES` already exists and is unused. Three focused screens beat one cluttered one — and lets sales price per seat. **Highest commercial leverage** of any feature in the entire roadmap.
26. **Shift handover & briefing mode** (features #1). Fullscreen "תדריך משמרת" walkthrough. Why it matters: Israeli police shifts already start with a briefing — if Tomorrow *is* the briefing, the system becomes the calendar, not a tool. This is how it becomes mandatory.
27. **After-action review + shift summary PDF** (features #2). The artifact that travels up the chain to מפקד מרחב. Today this is hand-typed in Word every shift. The cheapest *"the system saves me time"* sell in the roadmap.
28. **Model precision number — *"דיוק המודל ב-30 ימים אחרונים: 64%"*** (features #13). Now we have 30 days of buffer from Sprint 1. The single hardest objection in procurement is *"is the prediction real?"*. A precision number that updates weekly disarms it permanently. **This is the moat** against in-house Excel.
29. **Anomaly detector — "חריג · +250% מהממוצע" badge** (features #11). Z-score against the same 14-day buffer. Visual: a single red badge that the eye catches in a list of 30 cards. Seed of a real ML story later.
30. **BOLO ingestion drawer** (features #12). BOLO management is a paperwork nightmare in current police IT. Owning this workflow is sticky in a way prediction alone is not.
31. **Hierarchical district view** (features #14). The slide that wins the deal with קצין מרחב — they care about all 5 stations at once. Also unlocks the multi-district expansion narrative.

**Exit criteria for Sprint 2:** Tomorrow can run a full mock shift end-to-end with three roles, a real briefing, a real PDF, a real precision number. Ready to ask Guy Nir for a paid pilot.

---

## Sprint 3 — Scale + Multi-tenant (2-3 months)

Once a pilot signs, the next chassis upgrade.

32. **Multi-tenant data isolation** — every Firebase read scoped by `district_id` + `station_id`. RBAC enforced server-side, not just client-hidden. Audit log immutable and exportable.
33. **Real-time multi-user collaboration** (features #9). Cursor presence, hotspot claim ("נתפס ע״י מוקדן יוסי · 14:22"), append-only intel notes with `name+timestamp`. Without it, three dispatchers overlap dispatches.
34. **PWA companion for field patrol at `/field`** (features #8). Offline-first via service worker + IndexedDB queue (FireOps pattern). Doubles seat count and bypasses MDM hell on the rugged Samsungs in the cars.
35. **Push notifications + escalation tree** (features #15). Browser Notification API + Firebase Cloud Messaging. The difference between a passive map and an active operational system.
36. **AI incident summarizer** (features #10). "סכם מבצע" button → Anthropic API via server proxy. Saves 20 minutes per shift on after-action write-ups. The "everyone hates writing it down" wedge.
37. **Real auth → SSO via משטרה identity (LDAP / SAML / IDF Sapir)**. By this point we're integrating with the customer's IDP, not running our own users.
38. **Multi-district national expansion** (features #18). 14 districts, ~80 stations. `STATIONS` becomes data-driven from a backend, not `config.js`. GeoJSON boundary layer.

---

## Sprint 4 — Vision / "Year 1" (6-12 months)

Bold ideas. Some are sales theatre, some are real moats. Be honest about which.

39. **AI co-pilot — natural-language ops** ("מה הסיכון בכספית הלילה?", "הזנק ניידת לתחנה המרכזית — קריטי"). Anthropic Claude with tool use; the tools are exactly the functions already exposed (`dispatch`, `prediction.refresh`, `intel.openTarget`). **Strong moat** because it requires deep knowledge of the user's domain ontology, which we accumulate every month.
40. **Cellular anomaly heatmap — SIGINT-grade layer** (features #17). Guy Nir specifically called this out. 800 devices in 200m at 02:00 in an industrial zone = suspicious gathering. Mock first, then real CDR via the appropriate legal channel (שב"כ has the data; the channel is the hard part, not the engineering).
41. **Drone / aerial layer**. Live drone feed pin on map, click → video preview, dispatch a unit to the drone-marked location. Requires existing police drone fleet integration; non-trivial procurement.
42. **Body-cam triggers**. When a unit at a hotspot draws their sidearm (body-cam telemetry), auto-flag the dispatch in audit log + push to commander. **Demanding integration, huge sticky value** — every body-cam minute becomes searchable.
43. **Predictive de-escalation**. If a hotspot is escalating *and* a unit with a community-policing trained officer is closer than the SWAT unit, recommend the de-escalation unit first. Branding angle: "Tomorrow doesn't just predict crime — it predicts the *right response*".
44. **Civilian-facing companion app**. Citizens see their neighborhood's anonymized risk-band ("בינוני") and report incidents into the OSINT feed. **Sensitive politically** — could be huge win or huge backlash. Pilot in a small municipality first (קריית אונו? רעננה?), not Tel Aviv.
45. **Interpol I-24/7 + Sheba detention follow-up** (features #19). Custody-to-release loop tracking. Once you're the system tracking that loop, you're embedded for a decade.
46. **Voice-driven dispatch in Hebrew** (features #20). Web Speech API + Whisper proxy. Not a procurement-mover on its own, but it makes the **video that gets shared internally** in police WhatsApp groups. Demo theatre, not moat.

---

## Decision points

### When does Tomorrow stop being a demo and become a product?

**Trigger to flip:** *first paying pilot signs an MOU*. Concretely, that's when:
- The `2024` access code is gone (auth is real).
- Data flows in from at least one customer system (LPR camera, station roster, weather is too cheap to count).
- We sign an SLA that obliges us to fix P0 within 24h.

Before that trigger: keep the `concept demo` banner, the `_example` Telegram handles, the public GitHub repo. After: the repo goes private, the banner comes off, the brand voice changes from "תכן ניסיוני" to "Tomorrow · משטרת ישראל מרחב ירקון".

### Who could fund Sprints 1-2?

Three credible candidates, in order of likelihood:

1. **Guy Nir personally + Daghazahav** — Guy already credentialed the project; a small angel-style cheque ($20K-$40K) to fund 3 months of part-time engineering. Highest fit, lowest dollars.
2. **Police innovation budget (חידושים)** — INP has innovation grants for vendor pilots. Requires Guy or another insider to sponsor. Higher dollars, longer cycle (6-9 months).
3. **MoIA / National Security adjacencies** — שב"כ / 8200 alumni networks. Highest dollars, requires *real* tech (not visualization). Park until Sprint 3 features ship.

**Don't take VC money before pilot signature.** Tomorrow is a procurement-driven product; VC pressure for hockey-stick will misshape the roadmap. Bootstrap until a contract signs, then raise on revenue.

### Build vs buy — LPR engine

**Buy.** Do not build LPR. There are 4-5 Israeli LPR vendors (Briefcam, Hi-Tech Solutions, et al.) with production-grade engines, certifications, and existing police deployments. **Tomorrow's value is not the OCR — it's the integration layer between LPR + forecast + dispatch + audit log.** Build the integration, license the engine. *Same logic for face recognition, ALPR, body-cam analysis: integration glue, not core CV.*

### Build vs buy — predictive ML

**Build, but later.** The current rules-based engine in `prediction.js` is *good enough for v1*. Buying a "predictive policing ML" black box from PredPol / Palantir poisons the brand (these vendors have well-known bias controversies and are politically toxic in Israel). Build a transparent (XAI) model in-house once we have 90+ days of ground-truth pairs. **The XAI angle is itself a wedge against PredPol** — be the *explainable* alternative.

### Open-source vs proprietary

**Hybrid.** Keep the demo / portfolio version (this repo) public to drive credibility and recruiting. The production / multi-tenant codebase goes private the day the first pilot signs. License the public version MIT with a `NON_COMMERCIAL.md` rider explaining the line. **Worst case is the current ambiguity** — public repo, no LICENSE file, looks like an oversight.

### Build vs buy — backend

**Buy: Firebase.** Already partially wired (`CONFIG.FIREBASE_URL`), Google-trusted, supports auth + realtime + push out of the box. The day a customer requires data residency in Israel, migrate to a managed Postgres + Hasura in IL-east. Don't preempt that migration; cost-of-delay is low.

### When does Tomorrow get a real backend?

**The moment a second user exists.** Multi-user dispatch coordination (feature 9) requires shared state. localStorage cannot do this. Sprint 3 forces backend infrastructure regardless — bring it in at the start of Sprint 3 deliberately, not by accident mid-sprint.

---

## Risks

### Legal / privacy backlash — **HIGH**

Predictive policing in Israel is politically charged. הסנגוריה הציבורית, ACRI (האגודה לזכויות האזרח), and Knesset members on the left will publicly oppose **any** deployment. Specific exposures:

- **חוק הגנת הפרטיות + חוק המידע הפלילי**: any storage of identifying data triggers DPO obligations, אגף הסייבר במשרד המשפטים registration, and breach disclosure rules.
- **Bias / disparate impact**: PredPol-style products have been demolished in US/UK media for over-policing minority neighborhoods. Tomorrow must publish its precision/recall **per-zone** to preempt this — being able to say *"דיוק שווה בכל השכונות"* is a defensive moat.
- **The XAI angle (already in product)** is the single best mitigation. Every dispatch decision must be explainable in court. Keep the "factors" breakdown front-and-center.

**Mitigation:** before pilot signature, engage a privacy lawyer (preferably one who's done MoIA work) for a one-day review. Budget $3K-$5K. Cheaper than the alternative.

### Data quality dependency — **HIGH**

The product is only as good as the historical incident data feeding the model. Israeli police data is **notoriously messy** — Free-text Hebrew incident reports, geocoding gaps, classification inconsistencies between stations. If the customer hands us a CSV of last year's incidents and 30% are unusable, the precision number stays at 40% and the pitch dies.

**Mitigation:** spend the first 2 weeks of any pilot on data quality — a `clean.py` ETL that normalizes the customer's data and reports back *"מתוך X אירועים, Y נטענו בהצלחה"*. Make the cleanliness number a deliverable, not a hidden assumption.

### Police politics — **MEDIUM-HIGH**

Procurement at INP is glacial (6-12 months minimum for >₪50K). Internal politics: different מרחבים compete; the מרחב that adopts first wants exclusivity, but national leadership wants standardization. Guy Nir's network helps but doesn't solve the structural problem.

**Mitigation:** target a **single מרחב pilot** first (ירקון via Guy), but architect for multi-tenant from day one (Sprint 3). Avoid getting trapped as "the Yarkon system" — every demo screenshot should show the district picker even if only one district is wired.

### Tech debt in the vanilla-JS architecture — **MEDIUM**

The vanilla-JS choice (copied from FireOps) was right for v0.1-v0.4. It is becoming wrong:
- Three drawers, three near-copies of the same boilerplate (bugs P2-1).
- Inline `<script>` in `index.html` doing UI wiring (`index.html:209-253`) — already racing with module load order (bugs P0-5).
- No type safety: the `glyph`/`code` field issue (ARCH_PATTERNS, gotcha 2) cost real debug time.
- No tests. **There are zero unit tests in the repo today.** Every change is verified by Playwright screenshot or manual eyeballing.

**Trigger to migrate:** at the start of Sprint 3, when multi-user state synchronization arrives. See architecture migration below.

### Solo-founder bus factor — **HIGH** but unspoken

Elchai is currently the only person who can build this. Guy Nir is a domain advisor, not a coder. **Before pilot signature, find a co-founder or first employee** — ideally one with police-IT experience (ex-מ"י IT, ex-קצין מודיעין who knows SQL). The product won't survive a 2-week vacation otherwise.

---

## Architecture migration — vanilla JS → React/Vue + build pipeline

### When?

**At the start of Sprint 3.** Not earlier (vanilla JS still ships fast for Sprint 1-2 features), not later (the BOLO drawer + briefing fullscreen + PWA companion + multi-user collab would each become spaghetti without componentization).

### Symptoms that say "migrate now"

Watch for these. The first one is already present:
- ✅ Three near-identical drawer modules with copy-pasted boilerplate (bugs P2-1).
- More than one place using `innerHTML` with string interpolation of state (the XSS surface today).
- A feature ships with a race-condition bug that takes >2h to find (boot order / `regenerate()` / OSINT timing).
- Adding a new field to `CONFIG.STATIONS` requires touching 5+ files.

### Migration target

**Vue 3 + Vite + TypeScript.** Specifically *not* React, because:
- The team is one person who prefers HTML-shaped templates over JSX.
- Hebrew/RTL is better-served by Vue's scoped styles than React's typical CSS-in-JS.
- Vite hot-reload is faster than CRA / Next dev.
- TypeScript catches the `glyph` / `code` / `STORAGE_KEY` schema bugs we've already hit.

If we hire a React-native co-founder, switch to React + Vite. Don't bikeshed.

### Migration path (incremental, not big-bang)

1. **Week 0:** Add Vite + TS to the repo. Keep the existing IIFE modules running unchanged. Configure Vite to output a single bundle that the existing `index.html` can still load.
2. **Week 1-2:** Port `config.js` → `config.ts` with proper types (`Crime`, `Unit`, `Station`, `Hotspot`, `Signal`). No behavior change, just types. This catches every undocumented field assumption immediately.
3. **Week 3:** Port one drawer (Analytics) to a Vue 3 component. Mount it inside the existing layout. Old drawers keep working.
4. **Week 4-5:** Port the other two drawers using a shared `<Drawer>` component that finally enforces mutual exclusion at the component layer, not the bus.
5. **Week 6-8:** Port the map module last (it's the messiest and most-coupled). The wins from steps 3-5 should already justify the migration.
6. **Week 9:** Delete `index.html` inline script. All wiring is in Vue components by now.
7. **Week 10:** Drop IIFE modules. Pure Vue + TS.

**Budget:** 8-10 weeks of part-time work alongside Sprint 3 features. **Do not pause feature shipping** for the migration — shop with both hands.

### What not to migrate

- **Leaflet** stays. It's not the bottleneck; the Vue ecosystem around Leaflet (`vue-leaflet`) is fine but adds little.
- **The XAI factor display** stays vanilla-JS-ish for now — it's already declarative-ish.
- **The dispatch animation engine** (`dispatch.js`) stays. It's mature, working, and well-tuned. Wrap it, don't rewrite it.

### Cost of *not* migrating

Each Sprint 3+ feature is roughly **2x effort in vanilla JS** vs componentized:
- Multi-user presence cursors: trivial in Vue, painful in IIFE event-bus.
- PWA `/field` companion: requires re-architecting state from scratch in vanilla.
- AI co-pilot with tool-use: needs a typed function registry; impossible to maintain ad-hoc.

A 10-week migration buys back 3-5x that in Sprint 4-onwards feature velocity. Easy ROI call.

---

## TL;DR for Guy Nir (if asked "מה הצעד הבא?")

**8 weeks to a paid pilot:**
- Week 1: clean up the demo (Sprint 0).
- Weeks 2-4: weather + LPR live + audit log + real auth (Sprint 1).
- Weeks 5-8: role-based views + briefing + AAR PDF + precision number (Sprint 2).
- Week 9: pilot pitch. Ask for ₪80K-₪150K for 3-month proof-of-value at one מרחב.

The bet: Sprint 0+1+2 are ~$30K-$50K of Elchai's time. The pilot pays it back within the first month and funds Sprint 3.

**If Guy says yes, the work below is the real product.**
**If Guy says no, the work above is still a portfolio piece that helps the next conversation.**

Either way, ship Sprint 0 this week.

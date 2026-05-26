# TOMORROW — Integrations & Ecosystem Readiness Audit (2026-05-26)

**Scope:** how the vanilla-JS predictive-policing dashboard at `C:\Users\User\Desktop\DEV\Tomorrow` plugs into the outside world — CDNs it loads, data sources it reads/writes, backends it doesn't have yet, and what would be needed to ship to a paying customer.

**TL;DR**
- The app is a static SPA. The *only* live integration seams that actually do network I/O today are: CartoDB map tiles, Leaflet/leaflet.heat/Lucide/Heebo CDN assets, and one configurable Firebase RTDB endpoint that's commented out by default (`config.js:21`). The OSINT scanner, the Sheets MCP, and the cellular/LPR/Cellebrite/stolencar/100-dispatch references in the UI are all either Claude-side tooling or pure demo stubs.
- The Telegram OSINT scanner *does* exist as a real Node process at `scanner/` (not a gap, contrary to the audit prompt). It writes to `${FIREBASE_URL}/crime-signals.json` over REST. What's missing is the Firebase project, the `.env`, and the always-on host.
- For a real B2B deploy almost every "feature" advertised in the UI — LPR, cellular ping, target dossiers, multi-user, push, 100-dispatch — is a placeholder. None of them has an integration layer behind the UI; only OSINT does.

---

## Integration seams already in place

These are the wired *configuration knobs and call sites* where a real backend can be slotted in today with no architectural change. Each is a place an integrator can connect a real service in <1 day.

- **`CONFIG.FIREBASE_URL`** (`config.js:21`) — empty string = read demo. Set to a Firebase RTDB URL and `osint.js:56-68` flips to live polling at `${URL}/crime-signals.json`. `osint.js:185-191` starts a `setInterval` at `CONFIG.SIGNAL_REFRESH_MS` (60 s, `config.js:25`). **This is the only true live integration seam in the client.**
- **`CONFIG.SIGNALS_PATH`** (`config.js:22`) — RTDB child path (`'crime-signals'`). Same path is written by `scanner/firebase.js:11` via `PUT`. Renaming here cascades to the scanner if matched.
- **`CONFIG.SIGNAL_BOOST_RADIUS_M` / `CONFIG.FACTORS.osint`** (`config.js:24`, `config.js:40-45`) — how strongly an OSINT signal lifts the risk of a nearby forecast hotspot. Tunable from the Analytics drawer at runtime.
- **`CONFIG.ACCESS_CODE`** (`config.js:15`) — single string compared in `app.js:236`. Trivial to swap for a `fetch('/auth')` against any IdP without touching the rest of the app.
- **`CONFIG.STATIONS`** (`config.js:83-89`) — hard-coded array of 5 Tel Aviv stations. Adding a real station registry = replace this array (e.g. with a `fetch('/stations.json')` at boot).
- **`CONFIG.PATROL_SPEED_KMH` / `PATROL_BASE_MIN`** (`config.js:31-32`) — statistical ETA model. Already consumed by `app.js:61-71` (`etaMinutes`, `nearestEta`) and shown in LPR cards (`lpr.js:130, 143`). Real swap = override `TomorrowApp.nearestEta()` with an async call to a routing/AVL service.
- **`prediction.js` → `getForecast()`** — the doc/comment in `prediction.js` and `README.md:36` explicitly mark this as the seam to replace with a real ML/API call. The whole UI consumes `State.forecast[]` agnostic to its source.
- **OSINT signal schema (`signals.sample.json`)** — `{id, source, source_type, text_he, crime, risk, zone, lat, lng, confidence, ts/mins_ago, keywords, msg_url}`. The scanner writes this exact shape (`scanner/telegram-client.js:46-67`), the client reads it (`osint.js:55-74`). Any third-party intel pipeline that adheres to this schema plugs in for free.
- **Scanner `.env` contract** (`REGISTRY.md:13-15`, `scanner/firebase.js:5-7`) — `TELEGRAM_API_ID/HASH/PHONE/SESSION`, `FIREBASE_URL`, `FIREBASE_DB_SECRET`, `SIGNAL_TTL_HOURS`, `MIN_CONFIDENCE`. All env-driven, nothing hard-coded.
- **`TomorrowApp.register(name, hooks)` + `broadcast(method, ...)`** (`app.js:84-88`) — module pub/sub. Adding a new integration module (e.g. real-LPR drawer, FCM push handler) is just a new file + `register('myMod', {onForecastChange: …})`.
- **`TomorrowDispatch.dispatchToLpr(alert)`** (`lpr.js:97`) — already-defined entry point from LPR drawer into dispatch. When a real LPR feed arrives, only the `ALERTS` array (`lpr.js:14-45`) needs replacement; downstream wiring is done.
- **Strategic-events boosts** (`config.js:124-131`) — events with `crime_boosts` are folded into the forecast. A "current events" API (weather, holidays, protests) could populate this array dynamically with a single fetch at boot.

## Integration gaps & opportunities (sorted by priority)

| # | Integration | Why it matters | What's needed | Effort |
|---|---|---|---|---|
| 1 | **Subresource Integrity (SRI) + version-pinned CDNs** | Three external scripts loaded with no SRI hashes: `cdnjs/leaflet@1.9.4` (`index.html:204`), `jsdelivr/leaflet.heat@0.2.0` (`index.html:205`), and **`unpkg/lucide@latest`** (`index.html:206`) which is *unpinned* — a malicious or breaking publish to `lucide@latest` rewrites every icon in the UI on the next deploy. Same for Google Fonts CSS and CartoDB CSS. Supply-chain risk + Friday-night-breakage risk. | Pin `lucide` to a specific version (e.g. `lucide@0.469.0`), add `integrity="sha384-…"` + `crossorigin="anonymous"` to the three `<script>` and the leaflet `<link>`. Generate hashes with `openssl dgst -sha384 -binary file \| openssl base64 -A`. | **S** |
| 2 | **Self-host critical CDN assets (fallback)** | App is unusable in air-gapped networks, Israeli classified networks, China, or when a CDN has an outage. Procurement officer for any police/security customer will reject "depends on Cloudflare + unpkg + jsdelivr + Google + CartoDB to render". | Vendor Leaflet, leaflet.heat, Lucide UMD, Heebo woff2 files into `assets/vendor/`. Reference locally first; keep CDN as a `<link>` only for non-air-gapped builds. ~600 KB total. | **S** |
| 3 | **Replace cosmetic access gate with real auth** | `ACCESS_CODE = '2024'` in plain JS on a public repo. No multi-tenant story, no audit log, no role enforcement (CONFIG.ROLES exists but is dead code). Hard blocker for any B2B sale. | Firebase Auth (matches the rest of the OSINT stack — RTDB rules + Auth tokens), or Auth0 / IL gov SSO ("הזדהות ממשלתית" / קוד IDF) for a real police pilot. Wire `TomorrowApp.register('auth', …)` and gate `app.js` boot on a real token. | **L** |
| 4 | **Firebase project not created — OSINT pipeline is "dry"** | The whole OSINT story (scanner → Firebase → client) is implemented end-to-end but `CONFIG.FIREBASE_URL=''` and there is no project. Until then the live feature is invisible — the dashboard shows the demo file. | Create Firebase project, RTDB in `europe-west1` (IL data residency), set DB rules (`crime-signals` write-only via secret, read with auth), populate `scanner/.env`, host scanner on a small always-on VM (Cloud Run/Fly/Raspberry Pi). Wire `CONFIG.FIREBASE_URL`. | **M** |
| 5 | **No backend for any multi-user state** | App is single-user single-browser: `localStorage` (`app.js:31`) holds `forecast`, `units`, `intel_log`, `active_events`. Two dispatchers in two browsers see two independent worlds. Dispatching a unit from terminal A doesn't update terminal B. Kills the "מוקד" pitch immediately. | Move `TomorrowState` writes into Firebase RTDB (same project) with `onChildAdded`/`onValue` listeners. Or pick a hosted realtime backend (Supabase, Ably, Liveblocks). Smallest viable: RTDB `tenant/{org}/state` mirroring `STORAGE_KEY` schema. | **L** |
| 6 | **No real LPR camera grid integration** | `lpr.js:14-45` is a hard-coded `ALERTS` array of 5 stubs. The disclaimer (`lpr.js:120-124`) is honest, but the feature is shipped as visible in the HUD with a hot-count badge — high promise, zero substance. | Real LPR requires either (a) RTSP feeds + edge OCR (OpenALPR / Cellebrite Pathfinder / Israeli vendor like Aeronautics/Briefcam) pushing into the same Firebase node with `source_type='lpr'`, or (b) a vendor API. UI layer ready; data layer empty. | **XL** |
| 7 | **No `stolencar.gov.il` integration** | Same `lpr.js` references "stolencar · גניבת רכב 2026-05-20" in match strings — looks like a real cross-check, isn't. No API exists publicly; integration requires either MoP MoU + internal API, or a scraper that runs into the Robots/ToS wall. | Real path: get משטרת ישראל MoU → access internal vehicle registry. Demo path: deduplicate the literal string `'stolencar'` into a `lpr-source` enum so the swap is one diff. | **XL** |
| 8 | **No cellular tracking provider** | `intel.js:22, 35, 47` shows `last_cell: {lat, lng, when, precision}` per target as if it were live. There is no integration; values are literals. Cellular triangulation in IL legally requires court order + Cellebrite/Verint/Rayzone tier vendor — none cheap, none simple. | If pursued: legal review first, then Cellebrite Pathfinder / Verint X-Cell — both expose REST APIs. Shape: extend `intel.js` with `async fetchLastPing(target_id)`. Otherwise: **remove this field from demo** and label "מודיעין מבצעי — נדרשת אינטגרציה ייעודית". | **XL** + legal |
| 9 | **No "100" dispatch integration** | Dispatch animation is purely client-side cosmetic (`dispatch.js` from FireOps). A real dispatcher needs to actually send the unit. משטרת ישראל has no public dispatch API. | Pilot path: side-channel via radio/SMS/WhatsApp Business — `TomorrowDispatch.dispatchToHotspot()` adds a `.then(() => post('/notify-station-dispatch'))` POST to an internal webhook. Long path: gov.il integration. | **L–XL** |
| 10 | **No push notifications** | Two dispatchers in different rooms; one dispatches; the other doesn't know. Single most-asked B2B feature. | Firebase Cloud Messaging (FCM) — already inside Firebase if (#4) is done. Add `service-worker.js`, register FCM token per logged-in user, fan out on `crime-signals` `onChildAdded` (Cloud Function). OneSignal as a non-Firebase alt. | **M** |
| 11 | **No PWA / offline mode** | A police MDT often has flaky 4G in carparks/tunnels. Today: zero connectivity = white screen (CDN, fonts, tiles all fail). `README.md` mentions "PWA + offline (sw.js כמו FireOps)" as future, not done. | Add `manifest.webmanifest` + `sw.js` (Workbox or hand-rolled), precache the vendor bundle from (#2), use CartoDB MBTiles bundle for the AOI (Tel Aviv ~50 MB at z11-15). `signals.sample.json` becomes fallback when RTDB is offline. | **M** |
| 12 | **Map tiles — CartoDB attribution-only, no SLA** | `map.js:22` uses `basemaps.cartocdn.com/dark_all` with `© CARTO` attribution. CARTO's free Basemap service is "free for non-commercial" — for a paid B2B product, you need [CARTO Basemaps for Commercial Use](https://carto.com/basemaps/) (paid) or migrate to MapTiler / Mapbox / Stadia Maps / self-hosted OSM raster tiles. Today: legally grey + no uptime guarantee. | Decision: pay CARTO, switch to Mapbox `dark-v11` (~$0.50/1k tile loads, has SLA), or self-host TileServer-GL on a small VM. All four are 1-line swaps in `L.tileLayer()`. | **S** + $ |
| 13 | **Heebo from Google Fonts — China/restricted networks** | Heebo loaded from `fonts.googleapis.com` (`index.html:12`, also duplicated in printable report template `app.js:411`). Google Fonts is blocked in China, frequently degraded in IL gov networks. Falls back to David (Arch noted in `feedback_il_terminology.md`) which is the bug a prior commit (`af27662`) tried to fix. | Self-host Heebo woff2/woff (subset to Hebrew + Latin) under `assets/fonts/`. Drop Share Tech Mono (cosmetic) or self-host. Update `app.js:411` printable report too. | **S** |
| 14 | **Sheets MCP is Claude-side only — not used by the app** | `scripts/mcp-sheets/` exposes a stdio MCP server (`server.js`) that Claude Code calls via `claude mcp add sheets`. The running browser app has **zero** awareness of it. It's a *developer-productivity* integration (auto-logging client demos / status into Guy Nir's sheet — see `CURRENT_SPRINT.md:44`), not a product integration. | Document this distinction in `README.md` so a future reader doesn't expect the app to read Sheets. If Sheets-in-app is ever wanted (e.g. exporting forecast to a customer's sheet), it needs a separate browser-side OAuth flow + `gapi` lib. | **S** (docs) |
| 15 | **No analytics / observability** | Zero `gtag`/`plausible`/`mixpanel`/`amplitude`/`sentry` references anywhere. Sales can't answer "how many sessions / which buttons / which crashes". Privacy-positive but commercially blind. | For a B2B SaaS pilot: **PostHog self-hosted** (Tel Aviv-residency-friendly, EU host) or **Plausible** (no cookie banner needed). For errors: **Sentry** (essential — the app silently swallows `localStorage`/`fetch` errors, see `app.js:28, 35`). Wrap in a config flag so air-gapped customers can disable. | **S** |
| 16 | **No contact / sales lead capture** | Footer (`index.html:192-201`) has personal phone `054-201-2000` and a `daghazahav.com` link. No LinkedIn, no `mailto:`, no contact form, no "Request demo" CTA. A B2B SaaS landing page that can't capture a lead is leaving every passing visitor on the table. The audit's "B2B pivot" framing in `CURRENT_SPRINT.md:28` is contradicted by zero lead-gen UI. | Add a small "צור קשר" button in the HUD or login footer → modal with email + org + "I'm a __ (police / municipality / private security)" picker → POST to Formspree / HubSpot / Airtable. Add a "Book demo" CTA on login. Surface LinkedIn of the founder. | **S** |
| 17 | **No CI/CD / no deploy gate** | Repo has `package-lock.json` for Playwright but no `.github/workflows/`. Every `git push main` ships to GitHub Pages immediately with no link-check, no Playwright smoke test, no Lighthouse budget. Tests *exist* mentally (`CURRENT_SPRINT.md` mentions "אומת ב-Playwright") but aren't enforced. | Add `.github/workflows/ci.yml`: `npm i playwright`, run a 1-screen smoke (login → boot → forecast appears), and Lighthouse-CI budget. Gate deploy on green. | **S** |
| 18 | **`LICENSE` + `DISCLAIMER.md` missing** | Public repo with police-themed concept, no license = "all rights reserved" by default = nobody can fork or use. Also no demo disclaimer at the repo root (the security audit P0-2 covers this). | Add `LICENSE` (MIT or proprietary depending on B2B strategy). Add `DISCLAIMER.md` ("Concept demo — fictional data — not affiliated with Israel Police"). Reference both from `README.md` and from a banner on the live site. | **S** |
| 19 | **Scanner has no deploy story** | `scanner/README.md:36` says "pm2/systemd/Docker on a server שמאזין רציף" — but no `Dockerfile`, no `pm2.config.cjs`, no systemd unit. Even if all secrets are filled, there's nothing to `docker run`. | Add `scanner/Dockerfile` (node:20-alpine, copy, install, CMD) and `scanner/fly.toml` or `scanner/render.yaml`. Document `SIGNAL_TTL_HOURS` and `MIN_CONFIDENCE` defaults. | **S** |
| 20 | **CSP / security headers** | GitHub Pages doesn't let you set HTTP response headers. No `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`. With Lucide loaded from `unpkg@latest` (see #1), an inline-script CSP would also catch the inline `<script>` block in `index.html:220-283`. | Add `<meta http-equiv="Content-Security-Policy" content="…">` to `index.html`. Refactor the inline script to an external file so CSP can be `script-src 'self' cdnjs.cloudflare.com cdn.jsdelivr.net unpkg.com`. Or move off GitHub Pages to Cloudflare Pages (which *does* support `_headers`). | **M** |

## Production readiness checklist

Use this as the gate before any external customer pilot.

### Tier 0 — block the public demo from being mistaken for a real product
- [ ] Add `LICENSE` file and `DISCLAIMER.md` (gap #18).
- [ ] Add "DEMO · נתונים מומצאים" banner to the live site (cross-ref `security.md` P0-2).
- [ ] Replace fabricated Telegram handles in `signals.sample.json` and `intel.js` with obvious placeholders like `@example_demo_channel`.
- [ ] Either remove `ACCESS_CODE` gate or relabel the login as "Demo access" (gap #3 short-term).

### Tier 1 — minimum to ship to a friendly pilot
- [ ] Pin `lucide@latest` to a specific version + add SRI on all 3 CDN scripts (gap #1).
- [ ] Self-host vendor bundle + Heebo fonts (gaps #2, #13).
- [ ] Decide on map tile provider with a paid SLA, swap `L.tileLayer()` URL (gap #12).
- [ ] Create Firebase project + RTDB rules + deploy scanner to always-on host (gap #4).
- [ ] Hook up FCM push notifications for new `crime-signals` (gap #10).
- [ ] Add Sentry + PostHog (gap #15) with a per-tenant disable flag.
- [ ] Add `.github/workflows/ci.yml` Playwright smoke gate (gap #17).
- [ ] Add a real "Request demo" form to the live site (gap #16).
- [ ] Migrate off GitHub Pages to a host that supports headers (Cloudflare Pages) and add CSP (gap #20).

### Tier 2 — required for a paying multi-user customer
- [ ] Real auth (Firebase Auth or IL gov SSO) replacing `ACCESS_CODE` (gap #3).
- [ ] Multi-user realtime state sync (RTDB or equivalent) replacing `localStorage` (gap #5).
- [ ] Wire `prediction.js` → real ML model behind `getForecast()` (covered in features audit).
- [ ] PWA + offline + MBTiles for the AOI (gap #11).
- [ ] Real station registry endpoint instead of `CONFIG.STATIONS` hard-code.

### Tier 3 — features that are currently *visible UI* but *unwired backend*
**Do not promise these to a buyer until at least one of each pair is integrated:**
- [ ] Real LPR camera feed + `stolencar` cross-check (gaps #6, #7) — or remove the LPR drawer.
- [ ] Real cellular triangulation provider (gap #8) — or remove `last_cell` from `intel.js` dossiers.
- [ ] Real dispatch handoff to 100/station (gap #9) — or relabel "הזנקה" as "סימולציית הזנקה".

### Tier 4 — nice-to-have once Tier 1–3 land
- [ ] Dockerize the scanner (gap #19).
- [ ] In-app Sheets export via browser-side `gapi` (gap #14, optional).
- [ ] Strategic-events auto-population from a holidays/weather/protests API (seam in `config.js:124`).

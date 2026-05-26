# Security & Privacy Audit — Tomorrow

**Audit date:** 2026-05-26
**Target:** `c:\Users\User\Desktop\DEV\Tomorrow` (commit `2b904b8` on `main`)
**Deploy:** https://elchai.github.io/Tomorrow/ (PUBLIC GitHub Pages, public repo)
**Severity scale:** P0 = exploitable now / regulatory exposure · P1 = realistic risk under foreseeable usage · P2 = hardening gap · P3 = nice-to-have / cosmetic

---

## TL;DR — the two things that actually matter

1. **The "access code 2024" login gate is theatre, not security.** The full app source, the access code itself (`config.js:15`), all "intel" / "LPR" / "targets" demo data, and all module behaviour are statically served on a public GitHub Pages site under a public repo. Anyone can `view-source`, run the modules from devtools, or just type `2024`. The codebase acknowledges this in a comment (`config.js:13-14`) and in `REGISTRY.md`, but the **UI screams "AUTHORIZED PERSONNEL ONLY"**, which is misleading and is the single biggest credibility/legal risk.
2. **The product *narrative* — predictive policing, criminal dossiers with cellular pings, OSINT scraping of named Israeli Telegram channels, LPR matched against `stolencar.gov.il` — is sensitive, and the repo is PUBLIC.** No secrets are leaked, but the *concept demo presented as real* is itself a reputational/legal surface that needs prominent disclaimers it currently lacks at the top level.

No exploitable secret leaks were found in code or git history. Credentials handling for the local-only MCP / scanner is sound on paper. The XSS surface in the OSINT layer becomes real **the moment the live scanner is wired up** — today it's gated by hard-coded demo JSON.

---

## P0 — Critical (fix before any external demo)

### P0-1 — "Login gate" is cosmetic, but UI presents it as real security
- **Where:** `index.html:19-42` ("SECURE OPERATIONS SYSTEM // AUTHORIZED PERSONNEL ONLY"), `config.js:13-15` (`ACCESS_CODE = '2024'`), `app.js:221-253` (`showLogin`).
- **Reality:** Access code is a literal string in JS served to every visitor; `sessionStorage.tomorrow_auth='1'` from devtools bypasses it; the app modules (`intel.js`, `lpr.js`, `prediction.js`, …) are all unconditionally loaded **before** the gate runs.
- **Why this is P0, not P3:** The code comment ("NOT real security … Replace before any sensitive data") is honest, but **nothing in the UI is**. A reviewer / journalist / regulator landing on the live site sees "SECURE / AUTHORIZED PERSONNEL ONLY" and reasonably assumes it's a real police-grade login. That misrepresentation is the actual risk, more than the technical bypass.
- **Fix:** Either (a) add a visible "Concept demo · no real data · access code public: 2024" line on the login screen, or (b) drop the login gate entirely (it's not protecting anything) and replace it with a brief "this is a portfolio concept" splash. Long-term: real auth = Firebase Auth / server-side session, with the static site moved off the public Pages domain.

### P0-2 — Concept demo published on a PUBLIC GitHub repo without prominent demo disclaimer
- **Where:** repo root, `README.md`, `index.html` (no top-level banner), live site `elchai.github.io/Tomorrow/`.
- **Risk surface:** the product mock contains, all presented as if real:
  - Named **Israeli police stations with coordinates** (`config.js:83-89`),
  - "Criminal records" of named demo "targets" with last cellular ping coords/precision (`intel.js:14-52`),
  - LPR alerts cross-referenced to `stolencar.gov.il`, with plate numbers and "BOLO" matches (`lpr.js:13-45`),
  - OSINT scraping of named Telegram channels (`@telaviv_police_scanner`, `@florentin_live`, `@south_tlv_news`, `@jaffa_alerts`, `@city_watch_tlv` in `signals.sample.json`; `@telaviv_police_scanner` even **deep-linked** as if it had said specific things about target T-1042 in `intel.js:26`),
  - Police-style classified marker ("סודי — לשימוש מבצעי בלבד") in the printable patrol-order (`app.js:556`),
  - "Drone" / saturation patrol concepts.
- **Why P0:** Two of those Telegram handles likely don't even exist; the others might exist but never published the quoted text. Presenting fabricated quotes attributed to a real-sounding "police scanner" channel — on a public predictive-policing demo — is reputationally toxic if it gets crawled, screenshotted, or shared. Israeli predictive-policing also touches GDPR / Israeli Privacy Law (חוק הגנת הפרטיות) if anyone reads it as a real product.
- **Fix:** Add a hard-to-miss banner on the live site ("DEMO · קונספט · נתונים מומצאים · לא משטרת ישראל"). Add `LICENSE` + `DISCLAIMER.md`. Consider renaming the fabricated channel handles to obviously-fake placeholders (e.g. `@example_tlv_alerts_demo`) — same demo value, no risk of impersonation. Consider making the repo private and gating the demo behind a private link.

### P0-3 — Fabricated Telegram channel handles presented as live OSINT sources
- **Where:** `signals.sample.json:6-67` (`@telaviv_police_scanner`, `@florentin_live`, `@south_tlv_news`, `@jaffa_alerts`, `@city_watch_tlv`), `intel.js:24-49` (same handles, with quotes attributed to them about a named "target"), `osint.js:35-39` (renders the handle as a clickable `t.me/` link).
- **Risk:** if any of those handles is real and unaffiliated, this is defamation / impersonation. If they're not real, the deep-links still resolve as 404s on telegram.org and look broken. Either way, this is the single textual element most likely to surface in a Google image search for the live page.
- **Fix:** rename to `@demo_*_example` (or `tlv_alerts_demo`) everywhere, both in `signals.sample.json` *and* in `intel.js` (target T-1042's three OSINT quotes are hard-coded to those handles). Note: `scanner/channels.js` already does the right thing — it uses `_example` suffixes. The dashboard demo data does **not**.

---

## P1 — High (fix before this leaves prototype)

### P1-1 — XSS via OSINT signal fields (latent until scanner goes live)
- **Where:** `osint.js:107-135` interpolates `sig.text_he`, `sig.zone`, `sig.source`, `sig.source_url`, `sig.msg_url`, `crime.name`, `sig.lat.toFixed()` into a popup via `mk.bindPopup(\`…${sig.text_he}…\`)`. None of them are escaped.
- **Today:** safe — values come from `signals.sample.json`, which is repo-controlled.
- **The day `CONFIG.FIREBASE_URL` is filled:** the data path becomes `Telegram message text → scanner/classifier.js → Firebase REST PUT → fetch on client → innerHTML`. `scanner/telegram-client.js:68` does `sig.text_he = text.slice(0, 280)` — no sanitisation. A `<img src=x onerror=…>` in any monitored Telegram channel becomes JS execution in every dashboard session.
- **Same problem, narrower vector:** `sig.source_url` and `sig.msg_url` land *inside an `href` attribute* (`osint.js:39`). A Telegram channel whose ID happens to contain `"` (it can't, but the scanner constructs the URL — see `scanner/telegram-client.js:66-67`, derived from `chat.username` or `chat.id`) bypasses the quote. Lower risk but worth fixing together.
- **Also affects:** `intel.js:153` (`o.text`, `o.src` from the hard-coded `TARGETS`; not currently attacker-controlled), `lpr.js:142` (`a.match_src`, `a.model`; same).
- **Fix:** an `escapeHtml(s)` helper (5 lines) applied to *every* signal field before string interpolation, and a strict URL validator for `bestUrl()` (allowlist `https://t.me/…` only, drop anything else). This is the single highest-leverage code change for security posture.

### P1-2 — No CSP, no SRI on third-party CDN scripts
- **Where:** `index.html:204-206` loads from `unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com` without `integrity=`; no `<meta http-equiv="Content-Security-Policy">`; `lucide@latest` (mutable tag — `index.html:206`).
- **Risk:** classic supply-chain. `unpkg.com/lucide@latest` resolves to whatever the lucide team last published; if their npm account is compromised, every dashboard session executes the attacker's code. `unpkg` itself has had outages but not known compromises, but `@latest` is the bad pattern.
- **Fix order:**
  1. Pin `lucide@0.x.y` (specific version) — same fix prevents silent breakage.
  2. Add SRI hashes (`integrity="sha384-…"` `crossorigin="anonymous"`) on all four CDN tags.
  3. Add a CSP meta tag: `default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https://*.tile.openstreetmap.org https://cartodb-basemaps-*.global.ssl.fastly.net; font-src https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com;` (tune `connect-src` once Firebase URL is known).
  4. Consider self-hosting Leaflet + Lucide in `assets/vendor/` so the CDN goes away — it's <200KB.

### P1-3 — Firebase Realtime DB to-be-configured with legacy `?auth=<DB_SECRET>` header in the scanner
- **Where:** `scanner/firebase.js:5-6`, `scanner/.env.example:10`. Plan is to append the **deprecated** Firebase DB Secret as `?auth=…` on every REST call.
- **Risk:** DB Secrets are bearer credentials that grant *full admin* access to the Realtime DB; if the scanner host is compromised, exfiltrating the env vars gives the attacker write access to the same `/crime-signals` path the public dashboard reads (→ stored XSS, see P1-1, against every dashboard visitor).
- **Fix:** when the scanner goes live, replace DB Secret auth with a service-account token (Firebase Admin SDK), and configure DB rules so `/crime-signals` is **public read, service-only write** — never wide-open write.

### P1-4 — Footer credit links to external commercial brand with no licence / copyright header
- **Where:** `index.html:192-201` ("פותח ע״י דג הזהב" → daghazahav.com, plus phone number), `index.html:41` (login footer with personal phone `054-201-2000`), `index.html:95` (hamburger footer "נבנה ע״י אלחי פיין"), no `LICENSE` file in the repo.
- **Risk:** (a) **Personal phone number on a public site** = open spam/phishing/impersonation vector. (b) **No licence on a public repo = "all rights reserved" by default** under Israeli/US copyright, but visitors don't know that — anyone can fork, rename, slap their own footer, and there's no notice file to point to in a takedown. (c) Linking out to a commercial brand from a concept demo loosely associates that brand with predictive-policing rhetoric.
- **Fix:** Add `LICENSE` (MIT? proprietary?) and a `Copyright © 2026 …` line in the footer/HEAD. Move the phone number behind a contact form or remove it.

### P1-5 — `package-lock.json` (root) and `_audit_capture.mjs` committed/staged unintentionally
- **Where:** `git status` shows untracked `package.json` (just declares `playwright`), `package-lock.json`, and `_audit_capture.mjs`; `_verify.mjs` was apparently in an earlier state.
- **Risk:** `_audit_capture.mjs` is the Playwright harness for *this* audit — fine, but it shouldn't be in the published repo. ARCH_PATTERNS line 74 explicitly says "מנקים `_verify.mjs`/`package.json`/`node_modules` לפני commit".
- **Fix:** Add `_*.mjs`, `package.json`, `package-lock.json` (root) to `.gitignore`, or move audit tooling under `docs/audits/.../tools/` and commit nothing dev-only to the deploy root.

---

## P2 — Medium (hardening, not urgent)

### P2-1 — Local MCP `token.json` lifecycle for Google Sheets is long-lived and broadly scoped
- **Where:** `scripts/mcp-sheets/authorize.js:20` (`scopes: ['https://www.googleapis.com/auth/spreadsheets']`), `auth.js`, `server.js` — refresh token persists indefinitely; scope is read+write to **every spreadsheet the user can access**, not a specific one.
- **Verified:** `git check-ignore -v` confirms `credentials.json` and `token.json` are ignored. They are **not** in git history (`git log -p --all -- scripts/mcp-sheets/` only shows the gitignore/README/code, never a `credentials.json` add/remove). 
- **Risk:** local-only — if the laptop is compromised, the attacker gets refresh-token-level access to every Google Sheet the user owns. That's the trade-off of any MCP / local agent.
- **Fix (optional):** narrow `SCOPES` to `spreadsheets.readonly` plus a separate write scope only on a specific sheet ID, or use a service account with explicit per-sheet sharing. Also document a rotation plan ("delete `token.json`, re-`authorize` quarterly").

### P2-2 — Telegram MTProto via personal user account — ToS + privacy
- **Where:** `scanner/telegram-client.js`, `scanner/README.md:9-13` ("⚠️ לפני שמתחילים — חוקי ואתי").
- **Status:** good — the README explicitly warns to use a dedicated account, never commit `.env`/`*.session`, that scraping is OSINT and must comply with Telegram ToS and applicable privacy law. `scanner/.gitignore` covers `.env`, `*.session`, `.session`.
- **Gap:** no equivalent disclaimer in the **dashboard UI** about where the OSINT data comes from — the popup just says "מקור היתוך מידע: פיד מודיעין OSINT" (`osint.js:128`). For a B2B pitch this is fine; for a public demo it's misleading-by-omission.
- **Fix:** add a one-liner in the OSINT popup: "אותות לדוגמה · בפריסה בפועל יידרש הסכם שימוש מול ערוצי המקור" (or similar).

### P2-3 — `localStorage` retains intel log + sim score across sessions, including OSINT-derived events
- **Where:** `app.js:130-139` (`logEvent` pushes into `State.intel_log`, persisted via `saveState()` at line 138; key `tomorrow_state_v2` per `config.js:10`). Each log entry has `text` containing the raw `srcLink(sig)` HTML (`osint.js:176`) including the Telegram handle.
- **Risk:** if XSS lands in `text_he` (see P1-1), the malicious payload is stored in localStorage and replayed on every subsequent page load via `renderIntelLog()` (`app.js:148-155`, which uses `innerHTML`). Stored-XSS upgrade for the same root cause.
- **Fix:** part of the P1-1 fix — sanitise *before* `logEvent`, not just at render time. Or store structured data (`{src, url, label}`) and template-render with text-content for the variable parts.

### P2-4 — `printPatrolOrder` opens `window.open('','_blank')` and `document.write`s untrusted-ish data
- **Where:** `app.js:404-631`. Interpolates `h.crime_name`, `h.zone`, `h.factors[i]`, station name, `eventFactors[i]` (which derives from `CONFIG.STRATEGIC_EVENTS.name`), etc. into a full HTML document via `document.write`.
- **Today:** safe — everything comes from `CONFIG.*` and the deterministic prediction RNG. No user input.
- **Risk if any of these later become server-loaded:** `document.write` is the worst possible XSS sink. Fix order is: stop using `document.write`; build the print page server-side or with `DOMParser.createHTMLDocument` + safe insertion.
- **Fix:** when this gets real data, refactor; for now, a `// TODO(sec): unsafe document.write — refactor before connecting real forecast API` comment is enough.

### P2-5 — `data:`-URI / `javascript:` not blocked anywhere
- **Where:** generally — no validation that `h.osint_url` / `s.msg_url` / `s.source_url` are `https://t.me/…`. `osint.js:29-34` blindly trusts the field.
- **Risk:** if a malicious signal sets `msg_url: "javascript:alert(1)"`, the popup link `<a href="javascript:alert(1)">…</a>` fires on click.
- **Fix:** in `bestUrl()`, return `null` unless the candidate starts with `https://t.me/`.

### P2-6 — `localStorage` persistence has no schema validation on load
- **Where:** `app.js:25-29` — `Object.assign(State, JSON.parse(raw))` blindly merges whatever's in `localStorage.tomorrow_state_v2` into `State`. A user with devtools (or another tab on the same origin, including a hypothetical sibling site on `elchai.github.io`) can pre-poison `forecast[]`, `intel_log[]`, `active_events`.
- **Risk:** same-origin policy on `elchai.github.io` means *any other GitHub Pages project of the same user* shares this localStorage origin. Each can read/write the others' storage. Not exploitable today, but if another `elchai.github.io/*` project ever takes untrusted input, it can poison Tomorrow's state, and vice-versa.
- **Fix:** treat localStorage as untrusted: validate shape on load, drop unknown keys. Bonus: `STORAGE_KEY` already supports versioning (`_v2` in `config.js:10`) — a quick schema check on load is cheap.

### P2-7 — Login error message is silently spammable
- **Where:** `app.js:241-246` — no rate limit on wrong-code attempts, no lockout. Doesn't matter because the gate is cosmetic, but flagging for parity if it ever becomes real.

---

## P3 — Low (notes / non-issues confirmed)

### P3-1 — No analytics / tracking pixels
- Verified `index.html`, all `.js` files: zero references to `gtag`, `googletagmanager`, `fbevents`, `hotjar`, `mixpanel`, `amplitude`, `segment`. Good.

### P3-2 — No mixed content
- Verified: no `http://` URLs outside of `localhost:8777` in dev comments. All CDNs, fonts, tile servers (CartoDB Dark in `map.js`) are HTTPS. Good.

### P3-3 — No secrets in git history
- Verified via `git log -p --all` searched for `client_secret`, `api_hash`, `refresh_token`, `firebaseio.com`, `TELEGRAM_SESSION`, `FIREBASE_DB_SECRET`. Only matches are: env var *names* in `.env.example` / `REGISTRY.md` / docs / code that *reads* `process.env.*`. **No values.** `git ls-files` confirms `credentials.json` and `token.json` were never tracked. Good.

### P3-4 — `.gitignore` is comprehensive
- Root `.gitignore` covers `.env*`, `*.key`, `*.pem`, `client_secret*.json`, `credentials.json`, `token.json`, `*.oauth.json`, `node_modules/`, `dist/`, `.vscode/`, plus `.claude/cache/` and `.claude/sessions/`. `scripts/mcp-sheets/.gitignore` and `scanner/.gitignore` add scope-local ignores (`*.session` etc.). `git check-ignore` confirms both critical files are ignored. Good.

### P3-5 — External link hardening present
- All three places that emit `<a href="…" target="_blank">` (`osint.js:39`, `intel.js:152`, `prediction.js:192`) correctly use `rel="noopener noreferrer"`. Good. (`reverse-tabnabbing` and Referer leaks both blocked.)

### P3-6 — Memory file `REGISTRY.md` references env var names only
- Verified `REGISTRY.md:14` lists `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_PHONE`, `TELEGRAM_SESSION`, `FIREBASE_URL`, `FIREBASE_DB_SECRET` as **names**, with the explicit note "המשתמש מזין אותם בעצמו" (no values stored). Good.

### P3-7 — Disclaimers exist in Intel + LPR drawers, missing at top level
- `intel.js:160-164` says "איכון/האזנות סלולאריות מותנים בצו שיפוטי. הנתונים כאן הם דמו לצורך תכן UI." ✓
- `lpr.js:120-124` says "פיד דמו. הצלבה בפועל מול stolencar.gov.il מצריכה אינטגרציית API משטרת ישראל." ✓
- Missing: equivalent at login / homepage / footer / OSINT popup. See P0-2.

---

## Recommended remediation order (1 sprint of polish)

1. **Banner** the live site as a concept demo (P0-1, P0-2) — 30 min.
2. **Rename** all fabricated Telegram handles to `*_example` (P0-3) — 15 min, two files.
3. **escapeHtml + URL allowlist** for OSINT fields (P1-1, P2-5) — 1 hour.
4. **CSP meta + SRI** on the three CDN tags + pin `lucide@<version>` (P1-2) — 1 hour.
5. **LICENSE + copyright + remove phone number from public footer** (P1-4) — 15 min.
6. **`.gitignore` updates** for dev-only audit tooling (P1-5) — 5 min.
7. (Later, when scanner goes live) Firebase rules + service-account auth (P1-3).

After all P0s and P1s above are done, this is a defensible portfolio piece. Without them, the biggest single risk is that someone screenshots a fabricated quote attributed to "@telaviv_police_scanner" and shares it as if real.

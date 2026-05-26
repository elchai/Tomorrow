# Mega-Audit — Tomorrow — 2026-05-26

> סבב #1 (Baseline). Vanilla JS / Leaflet / Lucide. סה"כ ממצאים: **172** (אחרי דה-דופ).
> שפת ניתוח: עברית + ציטוטי קוד באנגלית. ל-Hebrew RTL — file:line + screenshot ref בכל ממצא.

צילומי מסך נלקחו ב-4 viewports (mobile 390 · tablet 768 · desktop-1440 · desktop-1920) × 11 מצבים = **44 PNGs**. סוכני ניתוח רצו במקביל (~17 דק׳ כוללת).

---

## תקציר מנהלים

| חומרה | כמות | מהי הסכנה |
|---|---|---|
| **P0 (קריטי)** | **20** | באגים פונקציונליים שבורים + טענות שווא של "אבטחה" + פיצ'רים מתים — חוסמים דמו אמין |
| **P1 (משמעותי)** | **30** | בעיות UX/באגים שמשפיעות על השימוש אבל לא חוסמות |
| **P2 (חשוב)** | **42** | חוב טכני, edge-cases, חוסר עקביות — יצטברו אם לא יטופלו |
| **P3 (Nice to have)** | **30** | ניקיון קוד, נגישות, מטא-מידע |
| **המלצות חדשות** | **50** | פיצ'רים (20), שיפורי אינטגרציה (20), שלבי פיתוח עתידיים (10) |

**מסקנה אחת:** המוצר במקום מצוין מבחינת **רעיון וכיוון**, אבל יש ~20 פגמי P0 שהמשתמש (גיא ניר) ימצא בתוך **5 דקות** של דמו. עדיפות מס׳ 1: פאזת "Demo Readiness" (Sprint 0) של ~5 ימי עבודה לתקן את כל ה-P0 — אחרי זה Tomorrow מוכן להדגמת מכירה.

---

## P0 — Critical (20)

הסדר לפי כמה מהר ימצאו בדמו.

### א. באגים פונקציונליים (5)

| # | קובץ:שורה | בעיה | תיקון | מאמץ |
|---|---|---|---|---|
| P0-1 | `layers.js:247` | **`getDistance()` שבור מתמטית** — מחשב `(lat1-lat2)²` פעמיים ומתעלם מ-lng. כל בדיקות RTM מקבלות מרחק 0 בהשוואת east-west | החזרת `Math.hypot(lat1-lat2, lng1-lng2) * 111000` או haversine | S |
| P0-2 | `prediction.js:262` | **`regenerate()` מוחק את ה-OSINT boost** — כל שינוי משקלים/אירוע אסטרטגי/RTM מוחק את התגית "OSINT" מהכרטיסים לתמיד | לאחר `generate()` להפעיל מחדש `TomorrowOsint.applyBoost()` (לחשוף את הפונקציה) | S |
| P0-3 | `index.html:91` (תפריט המבורגר) | **פריט "שכבות הקשר (RTM)" מת במובייל** — `data-trigger="btn-sim"` אבל `layers.js:148` משנה שם ל-`btn-layers` | לעדכן ל-`data-trigger="btn-layers"` | S |
| P0-4 | `analytics.js:551` | **`ctx.strokeStyle = 'var(--cyan)'`** — Canvas 2D לא מבין CSS vars; עקומת ROC ברנדור צבע ברירת מחדל | להחליף ב-hex: `'#00e5ff'` | S |
| P0-5 | `map.js` (חסר) | **Leaflet `invalidateSize()` לא נקרא אחרי toggle של drawer** — מותיר ריבועי טייל אפורים גדולים בכל פתיחת drawer | אחרי כל toggle: `setTimeout(() => map.invalidateSize(), 320)` | S |

### ב. תיאום UI שבור (5)

| # | קובץ:שורה | בעיה | תיקון | מאמץ |
|---|---|---|---|---|
| P0-6 | `analytics.js:230` + `intel.js:173` + `lpr.js:172` | **3 drawers בלי mutual exclusion** — תלונת המשתמש "כרטיסיות נכנסות אחת מאחורי השניה" | להוסיף `TomorrowApp.openDrawer(name)` ב-app.js שיסגור את האחרים | S-M |
| P0-7 | `style.css:209` | **`#layout` בגובה `calc(100vh - var(--hud-h))` חוסם את הפוטר** — הקרדיט "דג הזהב" לא נראה בלי גלילה | להחליף ל-`min-height: ...` במקום `height: ...`, או להוסיף `body { padding-bottom: footer-h }` | S |
| P0-8 | `index.html:78` | **תג v0.2** ב-HUD בעוד הקומיט האחרון v0.5+ — מבליט שהמוצר לא מתעדכן | להעלות ידנית לכל release או להחליף ב-hash בנייה | S |
| P0-9 | `intel.js / lpr.js` ב-mobile | **Drawer מתבסס על `position:absolute` של `#layout`** ב-`height:auto` במובייל → drawers "תלויים" בגלילה | להפוך drawers ב-mobile ל-`position:fixed` ב-`@media (max-width:768px)` | M |
| P0-10 | `analytics.js:56-66` | **Analytics drawer inline `width: 300px`** ב-mobile (לא responsive) | במקום CSS inline להעביר ל-class .drawer-panel ולתת `width: min(320px, 92vw)` | S |

### ג. אבטחה ואמינות (5)

| # | מיקום | בעיה | תיקון | מאמץ |
|---|---|---|---|---|
| P0-11 | `config.js:15` | **`ACCESS_CODE='2024'` ב-repo ציבורי + UI אומר "AUTHORIZED PERSONNEL ONLY"** — סיכון אמינות/משפטי | להוסיף באנר ראשי במסך הכניסה "תצוגת דמו · ללא אבטחה אמיתית" | S |
| P0-12 | כללי | **אין באנר "DEMO" עליון ב-dashboard** — האתר נראה כמערכת אמיתית, ובו נתוני אסירים פיקטיביים | להוסיף `.demo-ribbon` fixed top, גוון צהוב/אדום, "תצוגת דמו · נתונים פיקטיביים" | S |
| P0-13 | `signals.sample.json` + `intel.js:14-55` | **@telaviv_police_scanner** וציטוטים אמיתיים-למראה בערוצים מומצאים — סיכון אמינות | הוספת סיומת `_demo` לכל handle (כמו `_example` ב-scanner/channels.js) | S |
| P0-14 | `index.html:206` | **`lucide@latest` ב-CDN לא נעוץ** — supply-chain risk | להחליף ל-`lucide@0.474.0` (גרסה קונקרטית) + SRI hash | S |
| P0-15 | `analytics.js:666` | **toast "✅ אימות המודל לאחור הושלם בהצלחה"** — backtest לא באמת רץ; משדר אמון מזוייף | שינוי הטקסט ל-"סימולציית הדגמה הסתיימה" + להבהיר בכפתור עצמו | S |

### ד. דמו-וויברציה / לאומיות (5)

| # | מיקום | בעיה | תיקון | מאמץ |
|---|---|---|---|---|
| P0-16 | `app.js:550` | **`printPatrolOrder` יוצר "פקודה רשמית" מודפסת** — אם משתמש יצלם, ייראה כמסמך משטרתי אמיתי | הוספת watermark "DEMO – לא לשימוש מבצעי" ברקע דיאגונלי | S |
| P0-17 | `style.css` (intel-feed) | **טקסט יומן מבצעי בפאנל ימני **שולח גלישה אופקית** במובייל וטאבלט | `.intel-text { min-width: 0; word-break: break-word; }` | S |
| P0-18 | `style.css` (forecast list) | **קונפליקט `height: calc(100% - 130px - 210px)` + `flex: 1`** על אותו אלמנט ב-`index.html:122` | בחירה אחת — קלאסי flex: 1 1 0; min-height: 0 | S |
| P0-19 | `style.css` (forecast cards) | **`.forecast-card::after` LIVE/SECURED badge** משתמש ב-`left:` (אנגלי) במקום `inset-inline-start:` (RTL נכון) | החלפה ל-logical properties | S |
| P0-20 | `style.css` (login-logo) | **לוגו רנדור ~296px** למרות שמקור 720px — נראה רך/מטושטש בגלל פרופורציות PNG | להגדיל `max-width: 460px` או להוסיף `image-rendering: -webkit-optimize-contrast` | S |

**זמן כולל לכל ה-P0:** ~14-18 שעות עבודה (סדר גודל של 2-3 ימי-עבודה רצופים).

---

## P1 — Significant (30 נבחרים)

| # | מקור | בעיה | תיקון |
|---|---|---|---|
| P1-1 | bugs | state leak: `unit.lpr_alert_id` שלא מתנקה בחזרה לתחנה | `delete unit.lpr_alert_id` ב-return arrival |
| P1-2 | bugs | אין schema migration ב-`loadState()` — `Object.assign` עיוור | בדיקת `state.version` + drop אם לא תואם |
| P1-3 | bugs | forecast נשמר בין sessions ולכן הכרטיסים נשארים ב-100% תמיד | timestamp + TTL של שעה ל-forecast |
| P1-4 | bugs | off-by-one דרך חצות ב-`weekendUplift`/`factorTags` | להעביר ל-`State.forecast_hour` במקום `new Date().getDay()` |
| P1-5 | bugs | `seedUnits` מתעלם מ-`cars: 6` ב-CONFIG, חותך ב-4 | `for i=1..Math.min(s.cars, ...)` |
| P1-6 | bugs | `nowHour` ב-`index.html:224` לא מתעדכן כשהשעון חוצה שעה | `setInterval` שבודק ומעדכן |
| P1-7 | security | XSS פוטנציאלי דרך `text_he`/URL ב-OSINT עם Firebase אמיתי | `escapeHtml()` לפני interpolation |
| P1-8 | security | אין CSP meta tag, אין SRI hashes על Leaflet/heat/Heebo | להוסיף CSP `script-src` + SRI |
| P1-9 | security | טלפון אישי 054-... בפוטר ציבורי + אין LICENSE | להוסיף `LICENSE` (NON_COMMERCIAL) + להחליף לטופס יצירת קשר |
| P1-10 | ui-ux | strategic-events RTL slider knobs באנימציה הפוכה | בדיקת `.toggle::before` עם logical properties |
| P1-11 | ui-ux | canvas charts ב-analytics לא DPR-scaled — מטושטשים על retina | להכפיל את width/height ב-`devicePixelRatio` |
| P1-12 | ui-ux | threat-box + clock דחוסים ב-1440 — אין breakpoint בין 1200 ל-768 | להוסיף `@media (max-width:1300px)` — להסתיר תאריך |
| P1-13 | mobile | אין `viewport-fit=cover` + אין `env(safe-area-inset-*)` | הוספה ל-`<meta viewport>` + ל-padding של HUD/footer |
| P1-14 | mobile | tablet 768px במצב mobile-mode (no nav-rail) — אבוד באמצע | להוסיף `@media (min-width:769px)` שמראה rail גם בטאבלט |
| P1-15 | mobile | LPR action buttons + analytics tabs פספסו את ה-44px override | להרחיב את הסלקטור |
| P1-16 | mobile | close-X buttons עם inline `background:transparent` — אין hover affordance | להוסיף `:focus-visible` ring |
| P1-17 | reality | backtest claim של "30 ימי פשיעה" בלי data — toast לא כנה | תיוג "סימולציית הדגמה" |
| P1-18 | reality | LPR `match_src: 'stolencar · גניבת רכב 2026-05-20'` עבור צלחת מומצאת | prefix `demo · ` |
| P1-19 | integrations | unpkg/lucide@latest unpinned — supply chain risk | גרסה נעוצה + SRI |
| P1-20 | integrations | אין lead-capture (טופס יצירת קשר) — רק טלפון אישי | להוסיף `<form mailto:>` או Formspree |
| P1-21..P1-30 | אחרים | ראה קבצים נפרדים | — |

---

## P2 + P3 (72)

ראה קבצי הממדים. תקציר:
- **42 P2** — חוב טכני, edge cases, חוסר עקביות
- **30 P3** — ניקיון קוד, נגישות, מטא-מידע, גרסאות

---

## ממצאים לפי ממד

- **[Mobile + Tablet](03-findings/mobile.md)** — 24 ממצאים (5 P0, 8 P1, 7 P2, 4 P3)
- **[UI/UX Desktop](03-findings/ui-ux.md)** — 30 ממצאים (4 P0, 9 P1, 12 P2, 5 P3)
- **[Bugs](03-findings/bugs.md)** — 31 ממצאים (5 P0, 10 P1, 10 P2, 6 P3)
- **[Security + Privacy](03-findings/security.md)** — 20 ממצאים (3 P0, 5 P1, 7 P2, 7 P3)
- **[Features (20)](03-findings/features.md)** — מומלצות חדשות בקטגוריות must-have / differentiator / future
- **[Integrations (20)](03-findings/integrations.md)** — seams קיימים + פערים + production checklist
- **[Future Roadmap (46)](03-findings/future.md)** — 5 פאזות, מ-Sprint 0 (week 1) עד Sprint 4 (vision)
- **[Reality Check (17)](99-raw-agent-outputs/reality-check.md)** — דמו מטעה כ"אמיתי"; backtest שווא; אין tests

---

## סדר ביצוע מומלץ (Top 10 ל-Demo Readiness)

| # | מקור | תקן | זמן |
|---|---|---|---|
| 1 | P0-1 | layers.js haversine fix — שורה אחת | 10 דק׳ |
| 2 | P0-6 | TomorrowApp.openDrawer(name) coordinator (סוגר את האחרים) | 30 דק׳ |
| 3 | P0-5 | invalidateSize() אחרי toggle | 15 דק׳ |
| 4 | P0-11+12+13 | באנר DEMO + שינוי שמות handles + watermark print order | 45 דק׳ |
| 5 | P0-3 | hamburger btn-sim → btn-layers | 5 דק׳ |
| 6 | P0-2 | OSINT re-apply boost אחרי regenerate | 20 דק׳ |
| 7 | P0-7 | פוטר נראה בלי גלילה (`min-height` במקום `height`) | 10 דק׳ |
| 8 | P0-14 | pin lucide version + SRI | 15 דק׳ |
| 9 | P0-9+10 | Drawer mobile fix (fixed position במובייל) | 45 דק׳ |
| 10 | P0-8 | bump version v0.5 + LICENSE file | 15 דק׳ |

**זמן כולל:** ~3.5-4 שעות. אחרי זה — Tomorrow מוכן לדמו מולה גיא ניר.

---

## ממצאים חיוביים

- ✅ **אין secrets ב-git history** (security agent אימת `git log -p --all`)
- ✅ **`rel="noopener noreferrer"`** נכון על כל `target="_blank"`
- ✅ **`credentials.json` + `token.json`** מעולם לא נכנסו ל-tracked files
- ✅ **אין mixed content** (כל ה-assets ב-HTTPS)
- ✅ **אין analytics/tracking** (Mixpanel/GA וכו') — privacy-friendly by default
- ✅ **MCP scanner stub** syntactically valid + structurally correct (ES modules, deps ב-package.json)
- ✅ **ארכיטקטורת drawer + nav-rail** עברה pivot ל-B2B נקייה (אחרי תיקוני ה-overlap)
- ✅ **התיעוד הפנימי** (`.claude/memory/`) עשיר ועדכני — `ARCH_PATTERNS.md` ו-`CURRENT_SPRINT.md` תופסים את כל ההיסטוריה
- ✅ **גישת ה-pivot מ-SWAT-game ל-B2B SaaS** מתועדת בקוד — feedback memories מתעדכנים
- ✅ **Hebrew RTL כיסוי כללי טוב** — שורה ארוכה של תיקונים ספציפיים (תפריט המבורגר, popups, מסך כניסה)
- ✅ **Lucide line icons** במקום אמוג'י — שדרוג מקצועי שכבר אומץ
- ✅ **Realistic ETA** מבוסס סטטיסטיקה (32 קמ"ש + 2 דק׳ overhead) — מציאותי ושקוף

---

## מה השתנה מסבב קודם

זה הסבב הראשון של mega-audit — אין baseline. סבב הבא ישווה כנגד 00-index.md הזה.

---

## הערות

- צילומי מסך: [`01-mobile-screenshots/`](01-mobile-screenshots/) (22 PNGs) + [`02-desktop-screenshots/`](02-desktop-screenshots/) (22 PNGs)
- פלט גולמי של סוכנים: [`99-raw-agent-outputs/`](99-raw-agent-outputs/)
- Iterate command: `mega-audit --baseline docs/audits/2026-05-26-mega-audit/00-index.md`

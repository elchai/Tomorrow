# Architecture Patterns — Tomorrow

Implementation patterns and gotchas. Use aliases from REGISTRY, never raw IDs.

## סטאק
Vanilla JS, ללא build, dependencies מ-CDN (Leaflet 1.9.4 + leaflet.heat, Google Fonts).
ארכיטקטורה מועתקת מ-FireOps (`C:\Users\User\Desktop\DEV\fireops`): מודולים כ-IIFE על `window`,
state גלובלי יחיד + localStorage עם debounce, רישום מודולים ו-broadcast לאירועים.

## מודולים (סדר טעינה קריטי!)
`config.js → app.js → prediction.js → map.js → dispatch.js`
**גוטצ'ה:** prediction/map/dispatch תופסים `const State = window.TomorrowState` בזמן eval של ה-IIFE.
`TomorrowState` מוגדר ב-app.js — לכן **app.js חייב להיטען לפני** השאר. אחרת:
`Cannot read properties of undefined (reading 'forecast')`.

## State + Broadcast
- `window.TomorrowState` — current_station_id, forecast[], units[], intel_log[], forecast_hour, settings
- `TomorrowApp.register(name, {onStationChange})` + `broadcast('onStationChange')` — תגובתיות בין מודולים
- `TomorrowApp.saveState()` — debounced (CONFIG.SYNC_DEBOUNCE_MS)

## מנוע ניבוי (prediction.js)
- mock מבוסס-כללים עם RNG דטרמיניסטי (seed=1337) → תחזית יציבה בתוך session
- score = base_rate + timeFit(peak_hours) + היסטוריית zone + jitter, מוכפל ב-weekendUplift
- `scoreToRisk()` → רמה 1..4 (קריטי..נמוך) שמניעה את כל צבעי ה-UI
- **להחלפה במודל אמיתי:** החלף את `generate()` / חשוף `getForecast()` כ-async API call
- ZONES = מוקדים היסטוריים (centroids) — מוקדים מתפזרים סביבם

## מפה (map.js)
- CartoDB Dark tiles. `hotspotRefs[id] = {marker, ring}`, `stationRefs[id]`.
- heatmap דרך leaflet.heat (אופציונלי — נבדק `if (L.heatLayer)`). gradient כחול→ירוק→צהוב→כתום→אדום.
- getVisibleForecast() מסנן לפי שעה נבחרת (±1h) + תחנה.

## הזנקה (dispatch.js) — עיבוד מ-FireOps tactical.js
- `dispatchVehicle(unit, from, to, color, onArrive)`: מסלול bezier (כדי שרכבים לא יחפפו),
  סמן SVG שמסתובב לכיוון התנועה כל tick, trail חי, "טבעת אבטחה" בהגעה, fade והסרה.
- `dispatchToHotspot(h)`: בוחר תחנה (h.station_id / nearestStation), CONFIG.responseCard(crime,risk)
  קובע תמהיל יחידות, בוחר ניידות זמינות, מזניק במרווחים. רכב חוזר ל-available בסיום.
- ETA ריאלי = distanceMeters / unit.speed_kmh; משך אנימציה = settings.demo_seconds.

## אייקונים (Lucide) + מראה טקטי
- אייקוני קו מונוכרום דרך Lucide CDN (UMD) במקום אמוג'י. כל crime/unit ב-config נושא `glyph` (שם Lucide) + `code` (קוד מבצעי).
- **גוטצ'ה:** Lucide ממיר `<i data-lucide="...">` ל-SVG רק כשקוראים `lucide.createIcons()`. עוטף ב-`TomorrowApp.renderIcons()` — **חובה לקרוא אחרי כל render דינמי** (forecast list, units, hotspot markers) ובאירוע `popupopen` של Leaflet.
- מספרים = קריאת-נתונים מונוספייס (`.fc-prob`/`.tp-prob` עם `<b>` גדול + `<i>%</i>` קטן) + מד `.fc-gauge`. פינות חדות (4px), `risk-chip` מונוספייס. כל popup `dir="rtl"` עם class `tac-popup`.
- CSS משתמש ב-`color-mix(in srgb, var(--rc) N%, transparent)` — דורש דפדפן מודרני (Chrome 2023+).

## חוף הים — אין מוקדים במים
`prediction.js` → `coastLng(lat)=34.745+(lat-32.04)*0.5` מקרב את קו החוף של ת"א-יפו; `clampToLand()` דוחף כל lng שמערבית לחוף חזרה ליבשה. נקרא בתוך `generate()`.

## גרסת State
`STORAGE_KEY='tomorrow_state_v2'` — שינוי מבנה (glyph/code) מצריך bump כדי לזרוק forecast/units ישנים מ-localStorage.

## RTL
`dir="rtl"`. בגריד 3 עמודות: panel-left (ראשון ב-DOM) מופיע ויזואלית מימין. תחזית=ימין, ניידות=שמאל.

## בדיקה ויזואלית
אין build. `npx http-server -p 8777` ואז Playwright (node, `npm i playwright`).
boot ~2.9s — לחכות ~4s לפני בדיקת DOM. אזהרת Canvas2D של leaflet.heat שפירה.

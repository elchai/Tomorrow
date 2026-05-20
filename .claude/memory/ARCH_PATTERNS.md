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

## RTL
`dir="rtl"`. בגריד 3 עמודות: panel-left (ראשון ב-DOM) מופיע ויזואלית מימין. תחזית=ימין, ניידות=שמאל.

## בדיקה ויזואלית
אין build. `npx http-server -p 8777` ואז Playwright (node, `npm i playwright`).
boot ~2.9s — לחכות ~4s לפני בדיקת DOM. אזהרת Canvas2D של leaflet.heat שפירה.

# Project Registry — Tomorrow

IDs, credentials, URLs, webhooks.

## Deploy
- GitHub repo: https://github.com/elchai/Tomorrow (PUBLIC)
- Live (GitHub Pages): https://elchai.github.io/Tomorrow/ — קוד גישה לקליינט: 2024 (client-side בלבד, לא אבטחה)

## OSINT data source (config.js)
- `CONFIG.FIREBASE_URL` — ריק כברירת מחדל → הקליינט קורא מ-`signals.sample.json` (דמו). כשמוגדר → קורא חי מ-`${FIREBASE_URL}/crime-signals.json`.
- נתיב signals: `crime-signals`. סכמת signal: id, source, source_type, text_he, crime, risk, zone, lat, lng, confidence, ts/mins_ago, keywords.

## Scanner secrets (scanner/.env — לא בריפו, אל תקרא/תדפיס ערכים)
שמות מפתחות בלבד: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_PHONE`, `TELEGRAM_SESSION`, `FIREBASE_URL`, `FIREBASE_DB_SECRET`, `SIGNAL_TTL_HOURS`, `MIN_CONFIDENCE`.
המשתמש מזין אותם בעצמו. הסורק רץ על שרת always-on (`npm run scan`).

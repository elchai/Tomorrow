# Tomorrow scanner — חיבור חי לטלגרם

> פטרן זהה ל-`mabat-443/SETUP.md`. אם הסוכן של 443 רץ אצלך, רוב הסודות כבר קיימים — צריך רק להצביע אותם על Tomorrow.

---

## הארכיטקטורה בקצרה

```
Telegram channels  →  scanner/telegram-client.js (GramJS)
                          ↓ classify (crime/risk/zone/lat/lng/confidence)
                      scanner/firebase.js (Admin SDK)
                          ↓ PUT /crime-signals/<id>
                      Firebase Realtime DB  (shared with mabat-443)
                          ↓ GET /crime-signals.json
                      Tomorrow dashboard  (osint.js · CONFIG.FIREBASE_URL)
```

ה-Firebase שאנו כותבים אליו הוא **אותו פרוייקט** של 443
(`https://mabat443-default-rtdb.asia-southeast1.firebasedatabase.app`),
רק בנתיב אחר: `/crime-signals` במקום `/auto-news`.
ה-`service-account.json` של 443 כבר מסוגל לכתוב לשני הנתיבים.

---

## הצעדים החד-פעמיים

### 1. הסביבה — `.env`

צור `Tomorrow/scanner/.env`:

```bash
# טלגרם — אותם credentials של 443
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcd1234...
TELEGRAM_PHONE=+972XXXXXXXXX
TELEGRAM_SESSION=                # ימולא אוטומטית אחרי `npm run auth`

# Firebase — JSON מלא של service-account, על שורה אחת
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"mabat443",...}'

# אופציונלי
FIREBASE_URL=https://mabat443-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_SIGNALS_PATH=crime-signals
MIN_CONFIDENCE=0.5
SIGNAL_TTL_HOURS=72
```

> **טיפ:** ה-JSON של ה-service account של 443 כבר נמצא ב-
> `github/mabat-443/service-account.json`. תעתיק את התוכן כשורה אחת
> ל-`FIREBASE_SERVICE_ACCOUNT`, או טען את הקובץ במישרין:
>
> ```bash
> export FIREBASE_SERVICE_ACCOUNT="$(cat ../github/mabat-443/service-account.json | tr -d '\n')"
> ```

### 2. תלויות

```bash
cd scanner
npm install
```

### 3. אימות חד-פעמי

```bash
npm run auth
```

→ הזן קוד SMS + סיסמת 2FA. בסיום יודפס `TELEGRAM_SESSION` ארוך — העתק אותו ל-`.env` (שורת `TELEGRAM_SESSION=`). מהרגע הזה ההפעלה היא ללא אינטראקציה.

### 4. הצטרפות לערוצים

מהאפליקציה הרגילה של טלגרם בסים הייעודי, **הצטרף ידנית** לערוצים הרשומים ב-`channels.js`:

- `@ynetnews`, `@mako_news`, `@walla_news`, `@n12news`, `@kann_news`
- `@amitsegal`, `@israel_radar`
- `@south_tlv_news`

הוסף כל ערוץ נוסף שאתה רוצה לסרוק (סקאנרים אזרחיים, קבוצות שכונה,
התראות עירוניות) ועדכן את `channels.js` באותה השורה:
```js
{ username: 'channel_handle_here', region: 'שכונה / מרחב', reliability: 6 }
```

> אם הסוכן של 443 כבר מחובר לערוצים האלה — הוא יקלוט אותם אוטומטית.
> אין כפל הודעות כי כל ערוץ מסומן לפי handle ייחודי.

### 5. ריצה חיה

```bash
npm run scan
```

הסקריפט מתחבר, מאזין, מסווג, ודוחף ל-Firebase. ידפיס:

```
🛰  TOMORROW scanner online.
  ✓ listening: ynetnews (ישראל)
  ...
📡 signal: assault · נווה שאנן · conf 0.85 · @south_tlv_news
```

---

## חיבור הדאשבורד לפיד החי

בקובץ `config.js` של Tomorrow, שנה:

```js
const FIREBASE_URL = 'https://mabat443-default-rtdb.asia-southeast1.firebasedatabase.app';
const SIGNALS_PATH = 'crime-signals';
```

מהרגע שזה מוגדר, `osint.js` יעבור אוטומטית מקובץ הדמו (`signals.sample.json`) לקריאת ה-feed החי כל `SIGNAL_REFRESH_MS` מילישניות (ברירת מחדל 60s).

---

## בדיקה מהירה ללא טלגרם

לפני אימות מלא, אפשר לוודא שכל החיבורים מסביב עובדים:

```bash
# בדיקת סיווג בלי טלגרם
npm run classify:test

# בדיקת כתיבה ל-Firebase בלי טלגרם
node -e "require('./firebase').pushSignal({id:'test-1',crime:'assault',risk:2,zone:'בדיקה',lat:32,lng:34,confidence:0.7,keywords:['בדיקה']}).then(()=>console.log('ok')).catch(console.error)"
```

---

## בטיחות

- כל הסודות (`*.env`, `*.session`, `*.json` של credentials) נשמרים מחוץ ל-git
  (כבר ב-`scanner/.gitignore`).
- אם session דלף, הרץ `npm run auth` מחדש — מחרוזת חדשה תיווצר ותפסול את הישנה.
- ה-Firebase rules צריכים להיות **public read, service-only write** על
  `/crime-signals`. סקריפט להגדרה: `mabat-443/set-rules.js`.

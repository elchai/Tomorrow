# TOMORROW Scanner — סורק טלגרם OSINT 🛰

תהליך Node רציף (always-on) שמאזין לערוצי/קבוצות טלגרם רלוונטיים, מסווג כל הודעה
ל**סוג פשע + חומרה + מיקום**, ודוחף את הממצאים ל-Firebase. דשבורד Tomorrow קורא
מאותו נתיב (`/crime-signals`) ומציג כשכבת OSINT שגם **מעלה את ציון הסיכון בחיזוי**.

> ארכיטקטורה במחזור מ-443: סורק MTProto (חשבון משתמש, לא בוט) → מסווג מילות-מפתח → Firebase → קליינט.

## ⚠️ לפני שמתחילים — חוקי ואתי
- סריקת קבוצות = OSINT. ודא שאתה פועל בהתאם ל-ToS של טלגרם ולחוק (פרטיות, שימוש מותר).
- השתמש ב**מספר/חשבון ייעודי** עם פרופיל ניטרלי. אל תשתף לעולם את `.env` או את קובץ ה-session.
- הקוד **לא קורא** סודות מהריפו — הכל מ-`process.env`.

## התקנה
```bash
cd scanner
npm install
cp .env.example .env      # מלא את המפתחות (Windows: copy .env.example .env)
```
מלא ב-`.env`: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_PHONE` (מ-https://my.telegram.org),
ו-`FIREBASE_URL` (פרויקט Firebase Realtime DB).

## התחברות חד-פעמית
```bash
npm run auth
```
זה יבקש קוד מטלגרם, ויידפיס מחרוזת `SESSION` — הדבק אותה ב-`.env` תחת `TELEGRAM_SESSION`.

## ערוצים
ערוך את `channels.js` והכנס את הערוצים האמיתיים שתרצה לנטר (שם משתמש בלי @) + דירוג אמינות 1–10.

## הרצה (always-on)
```bash
npm run scan
```
מומלץ תחת מנהל תהליכים (pm2 / systemd / Docker) על שרת שמאזין רציף.

## חיבור לדשבורד
ב-`../config.js` הגדר את `FIREBASE_URL` לאותו פרויקט. Tomorrow יחליף אוטומטית
מנתוני הדמו (`signals.sample.json`) לקריאה חיה מ-`/crime-signals` ויעדכן כל דקה.

## בדיקת המסווג בלי טלגרם
```bash
npm run classify:test
```

## קבצים
| קובץ | תפקיד |
|------|--------|
| `index.js` | נקודת כניסה — תהליך רציף + ניקוי TTL |
| `telegram-client.js` | חיבור MTProto (GramJS), האזנה, סיווג, דחיפה |
| `classifier.js` | מנוע מילות-מפתח → crime/risk/zone/lat-lng/confidence |
| `firebase.js` | דחיפת signal ל-Firebase REST + purge פג-תוקף |
| `channels.js` | רשימת ערוצים לניטור |
| `.env.example` | תבנית משתני סביבה (ללא ערכים) |

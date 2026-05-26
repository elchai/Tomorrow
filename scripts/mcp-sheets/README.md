# Tomorrow Sheets MCP

שרת MCP מקומי שחושף את Google Sheets ל-Claude Code. שלך, בריפו שלך, לעד.

## הגדרה חד-פעמית

```powershell
cd C:\Users\User\Desktop\DEV\Tomorrow\scripts\mcp-sheets
npm install
npm run authorize        # יפתח דפדפן — תאשר גישה
claude mcp add sheets node "C:/Users/User/Desktop/DEV/Tomorrow/scripts/mcp-sheets/server.js"
```

אחרי `authorize` ייווצר `token.json` (gitignored). הוא חי לעד — לא צריך לחדש.
אחרי `mcp add` — סוגרים ופותחים את Claude Code; הכלים החדשים זמינים.

## כלים שהשרת חושף

| כלי | תיאור |
|---|---|
| `sheets_read_range` | קריאת תאים מטווח A1 |
| `sheets_append_rows` | הוספת שורות לסוף טבלה |
| `sheets_update_range` | החלפת תאים בטווח מסוים |
| `sheets_get_metadata` | רשימת טאבים בגיליון |
| `sheets_batch_update` | פעולות מבניות/פורמט (low-level) |

## קבצים

| | |
|---|---|
| `credentials.json` | OAuth client מ-Google Cloud (gitignored) |
| `token.json` | refresh token אחרי authorize (gitignored) |
| `authorize.js` | בוט-סטראפ OAuth חד-פעמי |
| `auth.js` | טוען את ה-token, מחזיר client מאומת |
| `server.js` | שרת ה-MCP עצמו (stdio) |

## scopes

`https://www.googleapis.com/auth/spreadsheets` — קריאה + כתיבה לכל גיליון שיש לי גישה אליו.

להוספת scope (Drive listing, Calendar, Gmail…) → לערוך `SCOPES` ב-`authorize.js`, להריץ `npm run authorize` שוב.

/* Channels the scanner listens to. The dedicated Telegram account (see SETUP.md)
   must be a member of every channel/group below — the GramJS event listener only
   fires on chats the account is joined to. Add channels via Telegram client on
   the SIM, then list the username (without @) here.

   `reliability` (1–10) feeds the confidence score in classifier.js: higher =
   trusted faster, lower confidence still passes the MIN_CONFIDENCE gate. */
module.exports = [
  // ------- National / mainstream news (broad coverage, lower priority but high reliability) -------
  { username: 'ynetnews',          region: 'ישראל',     reliability: 8 },
  { username: 'mako_news',         region: 'ישראל',     reliability: 8 },
  { username: 'walla_news',        region: 'ישראל',     reliability: 7 },
  { username: 'n12news',           region: 'ישראל',     reliability: 8 },
  { username: 'kann_news',         region: 'ישראל',     reliability: 8 },
  { username: 'amitsegal',         region: 'ישראל',     reliability: 7 },
  { username: 'israel_radar',      region: 'ישראל',     reliability: 6 },

  // ------- Tel Aviv urban — neighborhood-level scanners + watch groups -------
  { username: 'south_tlv_news',    region: 'דרום ת"א',  reliability: 7 },
  // Add the rest after joining them from the Telegram client on the dedicated SIM.
  // Examples of what to look for (must be PUBLIC + JOINED by the scanner account):
  //   - תל-אביב-יפו 24/7 / קרייני העירייה
  //   - דרום ת"א — נווה שאנן / שפירא / פלורנטין מקומיים
  //   - "תאונות עכשיו" / סקאנרים אזרחיים של הצלה
  //   - קבוצות שיטור קהילתי / מתנדבי שיטור
  // Once joined, append rows here:
  // { username: 'channel_handle_here', region: 'שכונה / מרחב', reliability: 6 }
];

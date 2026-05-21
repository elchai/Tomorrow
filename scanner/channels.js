/* Channels/groups the scanner listens to.
   Use public channel usernames (without @) or numeric ids the account has joined.
   Replace these placeholders with the real crime-relevant sources you want to monitor
   (local-area news, municipal watch groups, police/press channels, etc.).
   `reliability` (1–10) feeds the confidence score in classifier.js. */
module.exports = [
  { username: 'telaviv_alerts_example',   region: 'תל אביב',  reliability: 7 },
  { username: 'south_tlv_news_example',    region: 'דרום ת"א', reliability: 7 },
  { username: 'florentin_live_example',    region: 'פלורנטין', reliability: 6 },
  { username: 'jaffa_alerts_example',      region: 'יפו',      reliability: 6 },
  { username: 'city_watch_tlv_example',    region: 'תל אביב',  reliability: 5 }
];

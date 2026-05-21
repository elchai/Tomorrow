/* ============================================================
   TOMORROW scanner — classifier
   Turns raw (Hebrew) Telegram text into a structured crime signal:
   { crime, risk, zone, lat, lng, confidence, keywords }
   Mirrors the 443 news-fetcher approach (keyword tiers + location
   match + severity), scoped to urban crime instead of security.
   Returns null when no crime is detected.
   ============================================================ */

// crime type → trigger keywords (Hebrew). Keys match Tomorrow's CONFIG.CRIME_TYPES.
const CRIME_KEYWORDS = {
  burglary:   ['פריצה', 'פרצו', 'התפרצות לדירה', 'גנב נכנס', 'פריצה לבית'],
  auto_theft: ['גניבת רכב', 'גנבו רכב', 'נגנב רכב', 'פריצה לרכב'],
  robbery:    ['שוד', 'שדדו', 'שודד', 'איום בנשק', 'שוד עוברי אורח'],
  assault:    ['תקיפה', 'קטטה', 'מכות', 'אלימות', 'דקירה', 'נדקר', 'ירי', 'יריות'],
  drugs:      ['סמים', 'עסקת סמים', 'סוחר סמים', 'מעבדת סמים'],
  domestic:   ['אלימות במשפחה', 'אלימות בתוך הבית', 'בן זוג תקף'],
  vandalism:  ['ונדליזם', 'גרפיטי', 'השחתת רכוש', 'ניפוץ', 'הצתה'],
  theft:      ['גניבה', 'כייס', 'כיסנות', 'גנבו', 'נגנב'],
  disorder:   ['הפרת סדר', 'מהומה', 'התפרעות', 'התקהלות אלימה'],
  business:   ['פריצה לעסק', 'פרצו לחנות', 'התפרצות לעסק', 'שוד חנות']
};

// severity escalators → minimum risk level (1=critical … 4=low)
const SEVERITY = [
  { words: ['ירי', 'יריות', 'דקירה', 'נדקר', 'נשק חם', 'פצוע', 'פצועים', 'אנוש'], risk: 1 },
  { words: ['סכין', 'נשק', 'איום', 'נמלט', 'חשוד נמלט', 'אלימות'], risk: 2 },
  { words: ['חשוד', 'דיווח', 'נראה'], risk: 3 }
];

// neighbourhood/landmark → zone centroid (must match Tomorrow prediction.js ZONES)
const ZONES = [
  { match: ['תחנה המרכזית', 'תחנה מרכזית', 'נווה שאנן'], name: 'נווה שאנן',            lat: 32.0590, lng: 34.7790 },
  { match: ['פלורנטין'],                                    name: 'רובע פלורנטין',        lat: 32.0570, lng: 34.7700 },
  { match: ['יפו', 'שוק הפשפשים', 'נמל יפו'],               name: 'נמל יפו / שוק הפשפשים', lat: 32.0530, lng: 34.7530 },
  { match: ['דיזנגוף'],                                     name: 'דיזנגוף סנטר',         lat: 32.0760, lng: 34.7750 },
  { match: ['אלנבי', 'לב העיר', 'לב תל אביב'],              name: 'לב העיר / אלנבי',      lat: 32.0680, lng: 34.7710 },
  { match: ['טיילת', 'שפת הים', 'חוף'],                     name: 'שפת הים / טיילת',      lat: 32.0810, lng: 34.7700 },
  { match: ['הדר יוסף'],                                    name: 'הדר יוסף',            lat: 32.1080, lng: 34.8230 },
  { match: ['רכבת', 'השלום'],                               name: 'מתחם רכבת השלום',      lat: 32.0730, lng: 34.7930 }
];

function detectCrime(text) {
  const hits = [];
  for (const [crime, words] of Object.entries(CRIME_KEYWORDS)) {
    const matched = words.filter(w => text.includes(w));
    if (matched.length) hits.push({ crime, matched, count: matched.length });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.count - a.count);
  return hits[0];
}

function detectRisk(text) {
  for (const tier of SEVERITY) if (tier.words.some(w => text.includes(w))) return tier.risk;
  return 3;
}

function detectZone(text) {
  for (const z of ZONES) if (z.match.some(m => text.includes(m))) return z;
  return null;
}

/**
 * @param {string} text  raw message text (Hebrew)
 * @param {number} reliability  source reliability 1–10
 * @returns signal object or null
 */
function classify(text, reliability = 5) {
  if (!text || text.length < 4) return null;
  const crimeHit = detectCrime(text);
  if (!crimeHit) return null;
  const zone = detectZone(text);
  if (!zone) return null;                       // no geolocation → unusable for the map

  const risk = detectRisk(text);
  const keywords = crimeHit.matched;
  // confidence = source reliability (0.5) + keyword strength (0.3) + located (0.2)
  const confidence = Math.min(1,
    (reliability / 10) * 0.5 +
    Math.min(1, crimeHit.count / 2) * 0.3 +
    0.2);

  return {
    crime: crimeHit.crime,
    risk,
    zone: zone.name,
    lat: zone.lat + (Math.random() - 0.5) * 0.006,
    lng: zone.lng + (Math.random() - 0.5) * 0.006,
    confidence: Math.round(confidence * 100) / 100,
    keywords
  };
}

module.exports = { classify, detectCrime, detectZone, detectRisk, CRIME_KEYWORDS, ZONES };

// quick self-test: `npm run classify:test`
if (require.main === module && process.argv.includes('--test')) {
  const samples = [
    'דיווח על פריצה לדירה ברחוב ויטל בפלורנטין, החשוד נמלט',
    'קטטה אלימה עם דקירה סמוך לתחנה המרכזית, יש פצוע',
    'מזג האוויר היום נעים בתל אביב'
  ];
  samples.forEach(s => console.log('\n' + s + '\n →', JSON.stringify(classify(s, 7))));
}

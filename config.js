/* ============================================================
   TOMORROW — Predictive Policing Grid
   config.js · constants: crime types, risk levels, stations,
   patrol unit types, response cards (crime → recommended units)
   ============================================================ */

window.CONFIG = (function () {

  // --- Storage / sync ---
  const STORAGE_KEY = 'tomorrow_state_v2';
  const SYNC_DEBOUNCE_MS = 800;

  // --- Access gate (cosmetic, client-side only — NOT real security.
  //     For real auth use Firebase/server. Replace before any sensitive data.) ---
  const ACCESS_CODE = '2024';

  // --- Map defaults (Tel Aviv metropolitan district) ---
  const MAP_CENTER = [32.0760, 34.7850];
  const MAP_ZOOM = 13;
  const MAP_MAX_ZOOM = 19;

  // --- Risk levels (1 = critical … 4 = low) — drives all color coding ---
  const RISK = {
    1: { key: 'critical', label: 'קריטי',  color: '#ff1f4b', glow: '#ff5470' },
    2: { key: 'high',     label: 'גבוה',    color: '#ff7a18', glow: '#ffa052' },
    3: { key: 'medium',   label: 'בינוני',  color: '#ffd000', glow: '#ffe04d' },
    4: { key: 'low',      label: 'נמוך',    color: '#38e08a', glow: '#74f0b0' }
  };

  // --- Crime categories (פשיעה) ---
  // base_rate ≈ relative frequency weight · windows = typical time-of-day risk peaks
  // glyph = Lucide icon name (clean monochrome line icon) · code = tactical category code
  const CRIME_TYPES = [
    { key: 'burglary',   name: 'פריצה לבית',         code: 'B&E',    glyph: 'door-open',    base_rate: 0.85, peak_hours: [1, 2, 3, 4, 22, 23], color: '#ff7a18' },
    { key: 'auto_theft', name: 'גניבת רכב',           code: 'GTA',    glyph: 'car-front',    base_rate: 0.75, peak_hours: [0, 1, 2, 3, 4, 5],  color: '#ff7a18' },
    { key: 'robbery',    name: 'שוד',                 code: 'ROB',    glyph: 'banknote',     base_rate: 0.45, peak_hours: [20, 21, 22, 23, 0], color: '#ff1f4b' },
    { key: 'assault',    name: 'תקיפה / אלימות',      code: 'ASLT',   glyph: 'shield-alert', base_rate: 0.65, peak_hours: [22, 23, 0, 1, 2],   color: '#ff1f4b' },
    { key: 'drugs',      name: 'עברות סמים',          code: 'NARC',   glyph: 'pill',         base_rate: 0.55, peak_hours: [21, 22, 23, 0, 1],  color: '#ffd000' },
    { key: 'domestic',   name: 'אלימות במשפחה',       code: 'DV',     glyph: 'house',        base_rate: 0.50, peak_hours: [19, 20, 21, 22],    color: '#ff1f4b' },
    { key: 'vandalism',  name: 'ונדליזם',             code: 'VAND',   glyph: 'spray-can',    base_rate: 0.60, peak_hours: [0, 1, 2, 3, 23],    color: '#ffd000' },
    { key: 'theft',      name: 'גניבה / כיסנות',      code: 'THFT',   glyph: 'shopping-bag', base_rate: 0.80, peak_hours: [12, 13, 17, 18, 19], color: '#ffd000' },
    { key: 'disorder',   name: 'הפרת סדר ציבורי',     code: 'DISORD', glyph: 'megaphone',    base_rate: 0.55, peak_hours: [22, 23, 0, 1, 2],   color: '#38e08a' },
    { key: 'business',   name: 'התפרצות לעסק',        code: 'COMM',   glyph: 'store',        base_rate: 0.40, peak_hours: [2, 3, 4, 5],        color: '#ff7a18' }
  ];

  // --- Patrol / response unit types ---
  const UNIT_TYPES = [
    { key: 'patrol',   name: 'ניידת סיור',     glyph: 'siren',      speed_kmh: 60, staffing: 2 },
    { key: 'k9',       name: 'יחידת כלבנים',   glyph: 'dog',        speed_kmh: 55, staffing: 2 },
    { key: 'swat',     name: 'יס"מ / מתפרצת',  glyph: 'shield',     speed_kmh: 70, staffing: 6 },
    { key: 'motor',    name: 'אופנוע סיור',    glyph: 'bike',       speed_kmh: 75, staffing: 1 },
    { key: 'undercover', name: 'בלשים סמויים', glyph: 'eye-off',    speed_kmh: 60, staffing: 2 },
    { key: 'command',  name: 'נייד פיקוד',     glyph: 'radio',      speed_kmh: 55, staffing: 3 }
  ];

  // --- Police stations (Tel Aviv district — representative coordinates) ---
  const STATIONS = [
    { id: 'lev-ta',   name: 'תחנת לב תל אביב', region: 'מרחב ירקון', lat: 32.0668, lng: 34.7790, cars: 6 },
    { id: 'dizengoff', name: 'תחנת דיזנגוף',   region: 'מרחב ירקון', lat: 32.0809, lng: 34.7740, cars: 5 },
    { id: 'yiftach',  name: 'תחנת יפתח (יפו)', region: 'מרחב איילון', lat: 32.0500, lng: 34.7600, cars: 5 },
    { id: 'glilot',   name: 'תחנת גלילות',     region: 'מרחב ירקון', lat: 32.1300, lng: 34.8030, cars: 4 },
    { id: 'shapira',  name: 'תחנת שפירא',      region: 'מרחב איילון', lat: 32.0530, lng: 34.7850, cars: 4 }
  ];

  // --- Response cards: crime type + risk level → recommended unit mix ---
  // key = `${crimeKey}_${riskLevel}` ; value = array of unit type keys
  const RESPONSE_CARDS = {
    'robbery_1':   ['patrol', 'patrol', 'k9', 'swat'],
    'robbery_2':   ['patrol', 'patrol', 'k9'],
    'assault_1':   ['patrol', 'patrol', 'swat'],
    'assault_2':   ['patrol', 'patrol'],
    'burglary_1':  ['patrol', 'patrol', 'k9'],
    'burglary_2':  ['patrol', 'k9'],
    'auto_theft_1':['patrol', 'motor'],
    'auto_theft_2':['patrol'],
    'drugs_1':     ['undercover', 'patrol', 'k9'],
    'drugs_2':     ['undercover', 'patrol'],
    'domestic_1':  ['patrol', 'patrol'],
    'disorder_1':  ['patrol', 'command'],
    'default':     ['patrol']
  };

  function responseCard(crimeKey, riskLevel) {
    return RESPONSE_CARDS[`${crimeKey}_${riskLevel}`]
        || RESPONSE_CARDS[`${crimeKey}_1`]
        || RESPONSE_CARDS['default'];
  }

  // --- Roles (for future access control) ---
  const ROLES = {
    viewer:     { level: 1, label: 'צופה' },
    dispatcher: { level: 2, label: 'מוקדן' },
    analyst:    { level: 3, label: 'אנליסט מודיעין' },
    commander:  { level: 4, label: 'קצין תורן' }
  };

  return {
    STORAGE_KEY, SYNC_DEBOUNCE_MS, ACCESS_CODE,
    MAP_CENTER, MAP_ZOOM, MAP_MAX_ZOOM,
    RISK, CRIME_TYPES, UNIT_TYPES, STATIONS, RESPONSE_CARDS, ROLES,
    responseCard,
    crimeType: (k) => CRIME_TYPES.find(c => c.key === k) || CRIME_TYPES[0],
    unitType:  (k) => UNIT_TYPES.find(u => u.key === k) || UNIT_TYPES[0],
    station:   (id) => STATIONS.find(s => s.id === id) || null
  };
})();

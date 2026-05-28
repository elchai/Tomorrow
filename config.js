/* ============================================================
   TOMORROW — Predictive Policing Grid
   config.js · constants: crime types, risk levels, stations,
   patrol unit types, response cards (crime → recommended units)
   ============================================================ */

window.CONFIG = (function () {

  // --- Release tag (shown in HUD + hamburger footer) ---
  const VERSION = 'v0.6';

  // --- Storage / sync ---
  const STORAGE_KEY = 'tomorrow_state_v2';
  const SYNC_DEBOUNCE_MS = 800;

  // --- Access gate (cosmetic, client-side only — NOT real security.
  //     For real auth use Firebase/server. Replace before any sensitive data.) ---
  const ACCESS_CODE = '2024';

  // --- OSINT / Telegram-scan data source ---
  // When FIREBASE_URL is set, the OSINT layer reads live crime signals from
  // `${FIREBASE_URL}/${SIGNALS_PATH}.json` (written by the always-on scanner).
  // While empty, it falls back to the bundled demo feed (signals.sample.json).
  const FIREBASE_URL = '';                 // e.g. 'https://tomorrow-xxxx-rtdb.firebaseio.com'
  const SIGNALS_PATH = 'crime-signals';
  const SIGNALS_SAMPLE = 'signals.sample.json';
  const SIGNAL_BOOST_RADIUS_M = 600;       // a signal lifts the risk of forecast hotspots within this radius
  const SIGNAL_REFRESH_MS = 60000;         // re-poll cadence when live

  // --- Realistic patrol arrival (ETA) — statistical baseline ---
  // Source: Israeli police urban response avg ≈ 30-35 km/h with lights+siren in dense city;
  //         + ~2 min base for dispatch handoff + driver departure.
  // Used by forecast cards and LPR alerts to show "min away from nearest station".
  const PATROL_SPEED_KMH = 32;
  const PATROL_BASE_MIN  = 2;

  // --- Map defaults (now driven by the active country profile via TomorrowCountries) ---
  function activeCountry() {
    return (window.TomorrowCountries && TomorrowCountries.get()) || {
      mapCenter: [-23.5505, -46.6333], mapZoom: 13, stations: [], zones: [], strategicEvents: []
    };
  }
  const MAP_MAX_ZOOM = 19;
  // Getter properties keep modules backwards-compatible — `CONFIG.MAP_CENTER`
  // / `CONFIG.STATIONS` etc. transparently reflect the currently-selected
  // country.
  function get_MAP_CENTER() { return activeCountry().mapCenter; }
  function get_MAP_ZOOM()   { return activeCountry().mapZoom; }
  function get_STATIONS()   { return activeCountry().stations; }
  function get_ZONES()      { return activeCountry().zones; }
  function get_STRATEGIC_EVENTS() { return activeCountry().strategicEvents; }
  function get_INTEL_TARGETS() { return activeCountry().intelTargets || []; }
  function get_LPR_ALERTS()    { return activeCountry().lprAlerts || []; }

  // --- Prediction Weights (adjustable in analytics) ---
  const FACTORS = {
    base: 0.5,
    fit: 35,
    hist: 25,
    osint: 16
  };


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

  // --- Police stations: now sourced from the active country profile.
  // Legacy reference for fallback only — real list lives in countries.js. ---

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

  // --- Strategic / Calendar / Environmental Events ---
  // (Country-specific list now lives in countries.js — exposed via getter.)

  const exported = {
    VERSION,
    STORAGE_KEY, SYNC_DEBOUNCE_MS, ACCESS_CODE,
    FIREBASE_URL, SIGNALS_PATH, SIGNALS_SAMPLE, SIGNAL_BOOST_RADIUS_M, SIGNAL_REFRESH_MS,
    PATROL_SPEED_KMH, PATROL_BASE_MIN,
    MAP_MAX_ZOOM,
    RISK, CRIME_TYPES, UNIT_TYPES, RESPONSE_CARDS, ROLES, FACTORS,
    responseCard,
    crimeType: (k) => CRIME_TYPES.find(c => c.key === k) || CRIME_TYPES[0],
    unitType:  (k) => UNIT_TYPES.find(u => u.key === k) || UNIT_TYPES[0],
    station:   (id) => get_STATIONS().find(s => s.id === id) || null,
    // Localized display names — fall back to the static CONFIG name when i18n
    // isn't ready yet (e.g. during early module init before wiring.js loads).
    crimeName: (k) => {
      if (window.TomorrowI18n) {
        const v = TomorrowI18n.t('crime.' + k);
        if (v !== 'crime.' + k) return v;
      }
      const c = CRIME_TYPES.find(x => x.key === k);
      return c ? c.name : k;
    },
    unitName: (k) => {
      if (window.TomorrowI18n) {
        const v = TomorrowI18n.t('unit.' + k);
        if (v !== 'unit.' + k) return v;
      }
      const u = UNIT_TYPES.find(x => x.key === k);
      return u ? u.name : k;
    }
  };

  // Country-driven dynamic properties — getters so modules always see the
  // active country's data (even after the user toggles the country on the
  // login screen and triggers a re-init).
  Object.defineProperties(exported, {
    MAP_CENTER:        { get: get_MAP_CENTER,        enumerable: true },
    MAP_ZOOM:          { get: get_MAP_ZOOM,          enumerable: true },
    STATIONS:          { get: get_STATIONS,          enumerable: true },
    ZONES:             { get: get_ZONES,             enumerable: true },
    STRATEGIC_EVENTS:  { get: get_STRATEGIC_EVENTS,  enumerable: true },
    INTEL_TARGETS:     { get: get_INTEL_TARGETS,     enumerable: true },
    LPR_ALERTS:        { get: get_LPR_ALERTS,        enumerable: true }
  });

  return exported;
})();

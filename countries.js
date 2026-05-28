/* ============================================================
   TOMORROW — Country profiles
   Each profile bundles the geographic data the demo needs:
   - mapCenter / mapZoom            (Leaflet bootstrap)
   - stations  (5 representative police facilities)
   - zones     (neighborhood names used by prediction.js when
                naming hotspots; first item is the default chip)
   - strategicEvents (calendar/environmental events tied to local
                names — keys must stay stable so config knows them)
   - intelTargets / lprAlerts       (country-flavored demo dossiers)
   - osintSignals  (country-flavored OSINT sample feed; falls back
                    to the bundled signals.sample.json when absent)

   Default = brazil (per project spec). Switch via the login picker;
   value persists to localStorage as 'tomorrow_country'.
   ============================================================ */

window.TomorrowCountries = (function () {

  const STORAGE_COUNTRY = 'tomorrow_country';

  // -------- BRAZIL (São Paulo) ---------------------------------------------
  const BR = {
    code: 'brazil',
    label: 'Brasil — São Paulo',
    flagEmoji: '🇧🇷',
    timezone: 'America/Sao_Paulo',
    mapCenter: [-23.5505, -46.6333],
    mapZoom: 13,
    // 5 representative Batalhões de Polícia Militar (BPM) of São Paulo.
    stations: [
      { id: 'bpm1',  name: '1º BPM — Sé',          region: 'Centro',        lat: -23.5505, lng: -46.6333, cars: 6 },
      { id: 'bpm2',  name: '2º BPM — Mooca',       region: 'Zona Leste',    lat: -23.5575, lng: -46.5994, cars: 5 },
      { id: 'bpm3',  name: '3º BPM — Pinheiros',   region: 'Zona Oeste',    lat: -23.5667, lng: -46.6919, cars: 5 },
      { id: 'bpm4',  name: '4º BPM — Vila Mariana',region: 'Zona Sul',      lat: -23.5878, lng: -46.6361, cars: 4 },
      { id: 'bpm5',  name: '5º BPM — Lapa',        region: 'Zona Oeste',    lat: -23.5239, lng: -46.7050, cars: 4 }
    ],
    // Neighborhoods used by the hotspot generator (prediction.js).
    zones: [
      { name: 'Sé / Centro Histórico',    lat: -23.5505, lng: -46.6333 },
      { name: 'República',                 lat: -23.5435, lng: -46.6420 },
      { name: 'Bela Vista',                lat: -23.5613, lng: -46.6512 },
      { name: 'Liberdade',                 lat: -23.5587, lng: -46.6357 },
      { name: 'Vila Madalena',             lat: -23.5466, lng: -46.6900 },
      { name: 'Pinheiros',                 lat: -23.5663, lng: -46.6794 },
      { name: 'Itaim Bibi',                lat: -23.5859, lng: -46.6730 },
      { name: 'Vila Olímpia',              lat: -23.5953, lng: -46.6862 },
      { name: 'Mooca',                     lat: -23.5575, lng: -46.5994 },
      { name: 'Brás',                      lat: -23.5410, lng: -46.6166 },
      { name: 'Bom Retiro',                lat: -23.5260, lng: -46.6346 },
      { name: 'Vila Mariana',              lat: -23.5878, lng: -46.6361 },
      { name: 'Saúde',                     lat: -23.6175, lng: -46.6398 }
    ],
    strategicEvents: [
      { key: 'gp_interlagos',  name: 'GP de Fórmula 1 (Interlagos)', active: true,  crime_boosts: { disorder: 22, theft: 18, vandalism: 12 }, description: 'Concentração massiva de público e tráfego em Interlagos.', zones: ['Sé / Centro Histórico'] },
      { key: 'derby_paulista', name: 'Clássico Palmeiras × Corinthians', active: false, crime_boosts: { assault: 25, disorder: 18, vandalism: 12 }, description: 'Confronto de torcidas em zonas de bar e arenas.', zones: ['Mooca', 'Brás', 'Sé / Centro Histórico'] },
      { key: 'carnaval',       name: 'Carnaval de Rua', active: true, crime_boosts: { theft: 28, robbery: 18, drugs: 14, assault: 12 }, description: 'Blocos de rua atraem grandes multidões.', zones: ['Vila Madalena', 'República', 'Bela Vista'] },
      { key: 'heatwave',       name: 'Onda de Calor', active: false, crime_boosts: { domestic: 16, assault: 12 }, description: 'Temperaturas extremas elevam estatisticamente a violência interpessoal.', zones: [] },
      { key: 'feriado_nat',    name: 'Feriado Nacional (Casas Vazias)', active: false, crime_boosts: { burglary: 26, theft: 14 }, description: 'Êxodo da capital para o litoral deixa imóveis sem ocupação.', zones: ['Itaim Bibi', 'Vila Mariana', 'Pinheiros'] }
    ],
    intelTargets: [
      {
        id: 'T-1042', alias: 'O Jovem do Brás',
        age: 24, status: 'Ativo',
        affiliation: 'Afiliação: facção do PCC (suspeita)',
        record: ['Furto a residência · 2024', 'Agressão · 2025', 'Ameaça · 2026'],
        last_cell: { lat: -23.5410, lng: -46.6166, when: '17 min atrás', precision: 250 },
        osint: [
          { src: '@florentin_live_demo',         text: 'Visto na Rua Maria Marcolina ontem à noite',                 when: '4h atrás' },
          { src: '@south_tlv_news_demo',         text: 'Relato de tumulto com pessoa de descrição similar perto da estação', when: '12h atrás' },
          { src: '@telaviv_police_scanner_demo', text: 'Unidade solicitada para localização — hit positivo em câmera LPR', when: '1d atrás' }
        ]
      },
      {
        id: 'T-1107', alias: 'O Traficante de Sé',
        age: 31, status: 'Vigilância de inteligência',
        affiliation: 'Afiliação: rede de tráfico de entorpecentes',
        record: ['Tráfico de drogas · 2023', 'Lavagem de dinheiro · 2025'],
        last_cell: { lat: -23.5530, lng: -46.6420, when: '3h atrás', precision: 400 },
        osint: [
          { src: '@south_tlv_news_demo', text: 'Aglomeração suspeita perto da estação central',  when: '6h atrás' },
          { src: '@city_watch_tlv_demo', text: 'Relato de transação em dinheiro na praça',         when: '1d atrás' }
        ]
      },
      {
        id: 'T-1213', alias: 'O Batedor de Carteira da Vila',
        age: 19, status: 'Ativo',
        affiliation: 'Solitário · sem afiliação',
        record: ['Furto · 2025 (×3)', 'Carteirismo · 2026'],
        last_cell: { lat: -23.5466, lng: -46.6900, when: '42 min atrás', precision: 180 },
        osint: [
          { src: '@city_watch_tlv_demo', text: 'Alerta sobre carteirismo na Vila Madalena durante o dia', when: '2h atrás' }
        ]
      }
    ],
    osintSignals: [
      { id: 'br-2041', source: '@sp_alerts_demo', source_url: 'https://t.me/sp_alerts_demo', msg_url: 'https://t.me/sp_alerts_demo/1042',
        source_type: 'telegram', text_he: 'Briga generalizada perto da Sé, vários envolvidos e gritos por socorro.',
        crime: 'assault', risk: 1, zone: 'Sé / Centro Histórico', lat: -23.5505, lng: -46.6333, confidence: 0.86, mins_ago: 4,
        keywords: ['briga', 'violência', 'envolvidos'] },
      { id: 'br-2042', source: '@vila_madalena_news_demo', source_url: 'https://t.me/vila_madalena_news_demo', msg_url: 'https://t.me/vila_madalena_news_demo/803',
        source_type: 'telegram', text_he: 'Moradores relatam arrombamento em apartamento na Rua Aspicuelta, suspeito fugiu com uma bolsa.',
        crime: 'burglary', risk: 2, zone: 'Vila Madalena', lat: -23.5466, lng: -46.6900, confidence: 0.79, mins_ago: 12,
        keywords: ['arrombamento', 'apartamento', 'fugiu'] },
      { id: 'br-2043', source: '@centro_sp_demo', source_url: 'https://t.me/centro_sp_demo', msg_url: 'https://t.me/centro_sp_demo/2210',
        source_type: 'telegram', text_he: 'Atividade suspeita de venda de drogas perto da estação Sé, várias pessoas se aglomeram.',
        crime: 'drugs', risk: 2, zone: 'República', lat: -23.5435, lng: -46.6420, confidence: 0.74, mins_ago: 21,
        keywords: ['drogas', 'venda', 'aglomeração'] },
      { id: 'br-2044', source: '@liberdade_demo', source_url: 'https://t.me/liberdade_demo', msg_url: 'https://t.me/liberdade_demo/477',
        source_type: 'telegram', text_he: 'Relato não confirmado de assalto a pedestre perto da estação Liberdade.',
        crime: 'robbery', risk: 1, zone: 'Liberdade', lat: -23.5587, lng: -46.6357, confidence: 0.68, mins_ago: 33,
        keywords: ['assalto', 'pedestre'] },
      { id: 'br-2045', source: '@pinheiros_watch_demo', source_url: 'https://t.me/pinheiros_watch_demo', msg_url: 'https://t.me/pinheiros_watch_demo/1581',
        source_type: 'telegram', text_he: 'Pichação e danos a patrimônio próximo à Av. Faria Lima, três jovens vistos.',
        crime: 'vandalism', risk: 3, zone: 'Pinheiros', lat: -23.5663, lng: -46.6794, confidence: 0.61, mins_ago: 47,
        keywords: ['pichação', 'dano', 'vandalismo'] }
    ],
    lprAlerts: [
      {
        id: 'lpr-7012', plate: 'ABC-1234', mins_ago: 2,
        camera: { name: 'Câmera 14 · Av. Paulista × Bela Vista', lat: -23.5613, lng: -46.6512 },
        status: 'stolen', model: 'Hyundai HB20 branco', match_src: 'demo · registro nacional · roubo 2026-05-20',
        dispatchable: true
      },
      {
        id: 'lpr-7011', plate: 'XYZ-9876', mins_ago: 6,
        camera: { name: 'Câmera 22 · Vila Olímpia',  lat: -23.5953, lng: -46.6862 },
        status: 'flagged', model: 'Kia Picanto cinza', match_src: 'demo · inteligência · veículo em crimes recorrentes',
        dispatchable: true
      },
      {
        id: 'lpr-7010', plate: 'DEF-5544', mins_ago: 11,
        camera: { name: 'Câmera 08 · Mooca / Bresser', lat: -23.5575, lng: -46.5994 },
        status: 'clean', model: 'Toyota Corolla preto', match_src: '—',
        dispatchable: false
      },
      {
        id: 'lpr-7009', plate: 'GHI-3322', mins_ago: 18,
        camera: { name: 'Câmera 31 · Pinheiros', lat: -23.5663, lng: -46.6794 },
        status: 'stolen', model: 'Mazda 3 prata', match_src: 'demo · registro nacional · roubo 2026-05-22',
        dispatchable: true
      },
      {
        id: 'lpr-7008', plate: 'JKL-7711', mins_ago: 27,
        camera: { name: 'Câmera 17 · Liberdade', lat: -23.5587, lng: -46.6357 },
        status: 'flagged', model: 'Volkswagen Polo vermelho', match_src: 'demo · BOLO · alerta de comando',
        dispatchable: true
      }
    ]
  };

  // -------- ISRAEL (Tel Aviv) — preserved as a switchable region -----------
  const IL = {
    code: 'israel',
    label: 'ישראל — תל אביב',
    flagEmoji: '🇮🇱',
    timezone: 'Asia/Jerusalem',
    mapCenter: [32.0760, 34.7850],
    mapZoom: 13,
    stations: [
      { id: 'lev-ta',    name: 'תחנת לב תל אביב',  region: 'מרחב ירקון',  lat: 32.0668, lng: 34.7790, cars: 6 },
      { id: 'dizengoff', name: 'תחנת דיזנגוף',     region: 'מרחב ירקון',  lat: 32.0809, lng: 34.7740, cars: 5 },
      { id: 'yiftach',   name: 'תחנת יפתח (יפו)', region: 'מרחב איילון', lat: 32.0500, lng: 34.7600, cars: 5 },
      { id: 'glilot',    name: 'תחנת גלילות',      region: 'מרחב ירקון',  lat: 32.1300, lng: 34.8030, cars: 4 },
      { id: 'shapira',   name: 'תחנת שפירא',       region: 'מרחב איילון', lat: 32.0530, lng: 34.7850, cars: 4 }
    ],
    zones: [
      { name: 'לב העיר / אלנבי',           lat: 32.0668, lng: 34.7790 },
      { name: 'רובע פלורנטין',              lat: 32.0570, lng: 34.7700 },
      { name: 'נמל יפו / שוק הפשפשים',     lat: 32.0500, lng: 34.7600 },
      { name: 'מתחם התחנה המרכזית',         lat: 32.0560, lng: 34.7820 },
      { name: 'נווה שאנן',                  lat: 32.0590, lng: 34.7790 },
      { name: 'דיזנגוף סנטר',               lat: 32.0760, lng: 34.7751 },
      { name: 'מתחם רכבת השלום',            lat: 32.0676, lng: 34.7910 },
      { name: 'שפת הים / טיילת',           lat: 32.0850, lng: 34.7670 },
      { name: 'הדר יוסף',                   lat: 32.1100, lng: 34.8020 },
      { name: 'אזור התעשייה צפון',          lat: 32.1180, lng: 34.7980 }
    ],
    strategicEvents: [
      { key: 'protest_kaplan',   name: 'מחאת קפלן (הפגנה המונית)', active: true, crime_boosts: { disorder: 25, vandalism: 15 }, description: 'ריכוז קהל חריג במרכז העיר, הפרות סדר וחיכוך פוטנציאלי.', zones: ['מתחם רכבת השלום', 'לב העיר / אלנבי'] },
      { key: 'derby_bloomfield', name: 'דרבי כדורגל (איצטדיון בלומפילד)', active: false, crime_boosts: { assault: 20, disorder: 15, vandalism: 10 }, description: 'הגעת אלפי אוהדים ופוטנציאל לחיכוך אלים.', zones: ['נמל יפו / שוק הפשפשים', 'רובע פלורנטין', 'מתחם התחנה המרכזית'] },
      { key: 'summer_vacation',  name: 'חופשת הקיץ (ריכוז בני נוער)', active: true, crime_boosts: { vandalism: 12, theft: 10, auto_theft: 8 }, description: 'התקהלויות נוער בשעות לילה.', zones: ['שפת הים / טיילת', 'הדר יוסף'] },
      { key: 'heatwave',         name: 'עומס חום קיצוני (שרב)', active: false, crime_boosts: { domestic: 18, assault: 15 }, description: 'טמפרטורות גבוהות מעלות אלימות סטטיסטית.', zones: [] },
      { key: 'rosh_hashanah',    name: 'ערב ראש השנה (בתים ריקים)', active: false, crime_boosts: { burglary: 28, theft: 15 }, description: 'עזיבת המונים לטובת ארוחות חג.', zones: ['לב העיר / אלנבי', 'הדר יוסף', 'אזור התעשייה צפון'] }
    ],
    intelTargets: [
      {
        id: 'T-1042', alias: 'הצעיר מפלורנטין',
        age: 24, status: 'פעיל',
        affiliation: 'שיוך ארגוני: ארגון פשיעה דרום',
        record: ['פריצה לבית · 2024', 'תקיפה · 2025', 'איומים · 2026'],
        last_cell: { lat: 32.0572, lng: 34.7705, when: 'לפני 17 דק׳', precision: 250 },
        osint: [
          { src: '@florentin_live_demo',         text: 'נראה ברחוב ויטל אתמול בלילה',                              when: 'לפני 4 שע׳' },
          { src: '@south_tlv_news_demo',         text: 'דיווח על תקרית עם אדם בעל מאפיינים דומים סמוך לתחנה',  when: 'לפני 12 שע׳' },
          { src: '@telaviv_police_scanner_demo', text: 'יחידת סיור מתבקשת לאיתור — איתות חיובי במצלמת LPR',     when: 'לפני יום' }
        ]
      },
      {
        id: 'T-1107', alias: 'הסוחר מנווה שאנן',
        age: 31, status: 'מעקב מודיעיני',
        affiliation: 'שיוך ארגוני: רשת סחר סמים',
        record: ['החזקת סמים בכוונת מכר · 2023', 'הלבנת הון · 2025'],
        last_cell: { lat: 32.0592, lng: 34.7795, when: 'לפני 3 שעות', precision: 400 },
        osint: [
          { src: '@south_tlv_news_demo', text: 'התקהלות חשודה סמוך למתחם התחנה',     when: 'לפני 6 שע׳' },
          { src: '@city_watch_tlv_demo', text: 'דיווח על עסקה במזומן בכיכר לבנה',    when: 'לפני יום' }
        ]
      },
      {
        id: 'T-1213', alias: 'הכייס מדיזנגוף',
        age: 19, status: 'פעיל',
        affiliation: 'יחיד · ללא שיוך ארגוני',
        record: ['גניבה · 2025 (×3)', 'כיסנות · 2026'],
        last_cell: { lat: 32.0758, lng: 34.7751, when: 'לפני 42 דק׳', precision: 180 },
        osint: [
          { src: '@city_watch_tlv_demo', text: 'התראה על כיסנות בדיזנגוף סנטר בשעות הצהריים', when: 'לפני שעתיים' }
        ]
      }
    ],
    osintSignals: null,   // Israel falls back to the bundled signals.sample.json (Hebrew text).
    lprAlerts: [
      { id: 'lpr-7012', plate: '12-345-67', mins_ago: 2, camera: { name: 'מצלמה 14 · אלנבי × רוטשילד', lat: 32.0640, lng: 34.7725 }, status: 'stolen',  model: 'Hyundai i20 לבן',  match_src: 'דמו · stolencar · גניבת רכב 2026-05-20', dispatchable: true },
      { id: 'lpr-7011', plate: '88-219-44', mins_ago: 6, camera: { name: 'מצלמה 22 · דיזנגוף סנטר',   lat: 32.0760, lng: 34.7751 }, status: 'flagged', model: 'Kia Picanto אפור', match_src: 'דמו · מודיעין · רכב משמש בעבירות חוזרות', dispatchable: true },
      { id: 'lpr-7010', plate: '45-901-22', mins_ago: 11, camera: { name: 'מצלמה 08 · יפו / שוק הפשפשים', lat: 32.0530, lng: 34.7530 }, status: 'clean', model: 'Toyota Corolla שחור', match_src: '—', dispatchable: false },
      { id: 'lpr-7009', plate: '63-882-91', mins_ago: 18, camera: { name: 'מצלמה 31 · נווה שאנן', lat: 32.0590, lng: 34.7790 }, status: 'stolen', model: 'Mazda 3 כסוף', match_src: 'דמו · stolencar · גניבת רכב 2026-05-22', dispatchable: true },
      { id: 'lpr-7008', plate: '77-114-58', mins_ago: 27, camera: { name: 'מצלמה 17 · פלורנטין', lat: 32.0570, lng: 34.7700 }, status: 'flagged', model: 'Volkswagen Polo אדום', match_src: 'דמו · BOLO · התראת מפקד', dispatchable: true }
    ]
  };

  const PROFILES = { brazil: BR, israel: IL };

  let current = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_COUNTRY);
      if (stored && stored in PROFILES) return stored;
    } catch (_) { /* ignore */ }
    return 'brazil';   // default per project spec
  })();

  function get() { return PROFILES[current] || PROFILES.brazil; }
  function set(code) {
    if (!(code in PROFILES)) return false;
    current = code;
    try { localStorage.setItem(STORAGE_COUNTRY, code); } catch (_) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('tomorrow-country-change', { detail: { country: code } }));
    return true;
  }
  function getCode() { return current; }
  function listProfiles() {
    return Object.entries(PROFILES).map(([code, p]) => ({ code, label: p.label, flagEmoji: p.flagEmoji }));
  }

  return { get, set, getCode, listProfiles };
})();

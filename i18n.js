/* ============================================================
   TOMORROW — i18n layer
   Three supported UI languages (en default, he, pt). Strings are
   keyed by a stable dotted-id; missing keys fall back to English,
   then to the literal key. setLang() writes to localStorage and
   re-runs applyDom() to update every element with [data-i18n].
   Modules that build text dynamically should call TomorrowI18n.t()
   directly (e.g. inside toast() / drawer titles).
   ============================================================ */

window.TomorrowI18n = (function () {

  const STORAGE_LANG = 'tomorrow_lang';
  const SUPPORTED = ['en', 'he', 'pt'];

  // Per-language metadata: html lang + dir.
  const META = {
    en: { dir: 'ltr', label: 'English',  locale: 'en-US' },
    he: { dir: 'rtl', label: 'עברית',    locale: 'he-IL' },
    pt: { dir: 'ltr', label: 'Português', locale: 'pt-BR' }
  };

  // Translation dictionary — keys are stable IDs, values are localized text.
  const STRINGS = {
    en: {
      // Boot screen
      'boot.line1':           'Initializing prediction network and RTM context layers…',
      'boot.line2':           'Running 24h forecast model + syncing OSINT feed…',
      'boot.line3':           'TOMORROW online.',
      'boot.online':          '✅ Prediction + intelligence fusion online — RTM model loaded',

      // App-level
      'app.title':            'TOMORROW · Crime Prediction Grid',
      'app.sub':              'Crime Prediction Network',
      'app.classification':   'DEMONSTRATION ENVIRONMENT // NOT A LIVE SYSTEM',
      'app.disclaimer':       'Demo · Fictional data · No real security · Access code is cosmetic',
      'app.builtBy':          'Built by Elchai Fine',
      'app.contact':          'Contact',
      'app.poweredBy':        'Powered by',
      'app.brand':            'Dag Hazahav',

      // Login
      'login.codeLabel':      'Operational Access Code',
      'login.codePlaceholder':'• • • •',
      'login.enter':          'Enter System ▸',
      'login.wrongCode':      'Invalid access code',
      'login.language':       'Language',
      'login.country':        'Region',

      // HUD
      'hud.threat':           'DTI',
      'hud.threatLow':        'Normal Sensitivity',
      'hud.threatMed':        'Elevated Sensitivity',
      'hud.threatHigh':       'High Alert',
      'hud.threatCritical':   'Critical Alert',
      'hud.allDistrict':      'All District',
      'hud.muteOn':           'Sound on',
      'hud.muteOff':          'Sound off',
      'hud.menu':             'System Menu',
      'hud.logout':           'Logout',
      'hud.version':          'Version',

      // Crime categories — keys match CONFIG.CRIME_TYPES[].key
      'crime.burglary':       'Residential burglary',
      'crime.auto_theft':     'Vehicle theft',
      'crime.robbery':        'Robbery',
      'crime.assault':        'Assault / Violence',
      'crime.drugs':          'Drug offenses',
      'crime.domestic':       'Domestic violence',
      'crime.vandalism':      'Vandalism',
      'crime.theft':          'Theft / Pickpocketing',
      'crime.disorder':       'Public disorder',
      'crime.business':       'Commercial break-in',

      // Patrol unit types
      'unit.patrol':          'Patrol car',
      'unit.k9':              'K9 unit',
      'unit.swat':            'SWAT / Tactical',
      'unit.motor':           'Motorcycle patrol',
      'unit.undercover':      'Undercover detectives',
      'unit.command':         'Command vehicle',

      // Factor tags (used by prediction)
      'factor.peakHour':      'Peak crime hour',
      'factor.weekendNight':  'Weekend nightlife',
      'factor.poorLighting':  'Poor street lighting',
      'factor.barsNearby':    'Bars / nightlife nearby',
      'factor.atmsNearby':    'ATM / financial nearby',

      // Operational log + strategic events
      'log.title':            'Operational Log',
      'events.title':         'Strategic Events',
      'events.active':        'Active',
      'events.inactive':      'Inactive',

      // Forecast panel
      'forecast.title':       'Crime Forecast',
      'forecast.regen':       'Run Model',
      'forecast.saturate':    'Saturation Patrol',
      'forecast.dispatch':    'Dispatch Unit',
      'forecast.timeline':    'Forecast Timeline',
      'forecast.now':         'now',
      'forecast.severity.low':      'Low',
      'forecast.severity.medium':   'Moderate',
      'forecast.severity.high':     'High',
      'forecast.severity.critical': 'Critical',
      'forecast.station':     'Station',
      'forecast.window':      'Window',
      'forecast.eta':         'min',
      'forecast.empty':       'No forecast for selected area / hour',

      // Units panel
      'units.title':          'Units',
      'units.empty':          'No units at this station',
      'units.available':      'available · at station',
      'units.enroute':        'en route',
      'units.onscene':        'on scene',
      'units.onsceneSecuring':'on scene · securing ({sec}s)',
      'units.returning':      'returning to station',

      // OSINT
      'osint.toggle':         'OSINT',
      'osint.loaded':         '{n} OSINT signals loaded',
      'osint.demoSuffix':     '(demo)',
      'osint.liveSuffix':     '(live · Firebase)',
      'osint.popup.nlpHeader':  'NLP entity extraction:',
      'osint.popup.classifier': 'Predicted event classification',
      'osint.popup.coords':     'Extracted geo coordinates',
      'osint.popup.source':     'Information fusion source',
      'osint.popup.confidence': 'Confidence',
      'osint.popup.sourceLabel':'OSINT intelligence feed (demo)',

      // Intel drawer
      'intel.title':          'Target Intel',
      'intel.disclaimer':     'Cellular tracking / interception require a judicial warrant. Data shown is demo for UI design only.',
      'intel.age':            'Age',
      'intel.status':         'Status',
      'intel.affiliation':    'Affiliation',
      'intel.record':         'Criminal record',
      'intel.lastCell':       'Last cellular ping',
      'intel.osintMentions':  'OSINT mentions',
      'intel.locate':         'Locate on map',
      'intel.location':       'Location',
      'intel.precision':      'Precision',
      'intel.when':           'When',

      // LPR drawer
      'lpr.title':            'LPR Alerts',
      'lpr.disclaimer':       'Demo feed. Cross-checking against stolen-vehicle registries requires real-world police API integration.',
      'lpr.dispatch':         'Dispatch unit',
      'lpr.camera':           'Camera',
      'lpr.status.stolen':    'STOLEN',
      'lpr.status.flagged':   'FLAGGED',
      'lpr.status.clean':     'Clean',
      'lpr.status.secured':   'Secured',
      'lpr.minsAgo':          '{n} min ago',
      'lpr.focus':            'Focus',

      // Analytics drawer
      'analytics.title':      'Analytics & Model Calibration',
      'analytics.tab.kpi':    'Operational KPIs',
      'analytics.tab.val':    'Model Validation (B2B)',
      'analytics.utilization':'Unit Utilization',
      'analytics.coverage':   'Forecast Coverage',
      'analytics.backtest':   'Run demo simulation (30 days)',
      'analytics.backtest.running': 'Running demo simulation…',
      'analytics.backtest.startToast': 'Starting demo simulation (30 synthetic crime days)…',
      'analytics.backtest.doneToast':  'Demo simulation finished (synthetic data)',
      'analytics.kpis':               'KPIs',
      'analytics.coverage':           'Directed patrol coverage',
      'analytics.utilization':        'Unit utilization',
      'analytics.trend':              'Predicted crime trend (24h)',
      'analytics.crimeMix':           'Crime type breakdown',
      'analytics.weights':            'Tactical risk weights',
      'analytics.weight.base':        'Crime base rate',
      'analytics.weight.fit':         'Peak hours',
      'analytics.weight.hist':        'Historical weight',
      'analytics.weight.osint':       'OSINT signal',
      'analytics.evalMetrics':        'Model evaluation metrics (scientific)',
      'analytics.rocAuc':             'Separation ability (ROC-AUC)',
      'analytics.precision':          'Precision',
      'analytics.recall':             'Recall',
      'analytics.f1':                 'Aggregate score (F1)',
      'analytics.confusion':          'Confusion matrix (forecast vs reality)',
      'analytics.pred.crime':         'Predicted: crime',
      'analytics.pred.calm':          'Predicted: calm',
      'analytics.actual.crime':       'Actual: crime',
      'analytics.actual.calm':        'Actual: calm',
      'analytics.tp':                 'True positive (TP)',
      'analytics.fn':                 'Missed detection (FN)',
      'analytics.fp':                 'False alarm (FP)',
      'analytics.tn':                 'True negative (TN)',
      'analytics.rocCurve':           'ROC performance curve (model calibration)',
      'analytics.noCrimeData':        'No crime data available',
      'analytics.backtestLog':        '📊 Backtest vs 30 days completed: ROC-AUC = {roc}, Precision = {prec}%, Recall = {rec}%',

      // Layers
      'layers.title':         'Context Layers (RTM)',
      'layers.bars':          'Bars & Nightlife',
      'layers.atms':          'ATMs / Financial',
      'layers.lighting':      'Poor Street Lighting',
      'layers.modalTitle':    'Environmental information layers (RTM)',
      'layers.barsLayer':     'Friction hotspots & nightlife (bars)',
      'layers.atmsLayer':     'Financial hotspots (ATMs)',
      'layers.darkLayer':     'Poorly-lit zones',
      'layers.popup.bars.tag':  'GIS LAYER · Friction hotspot',
      'layers.popup.bars.desc': 'Concentrated nightlife & alcohol consumption elevates the likelihood of brawls and disorder during late hours.',
      'layers.popup.atms.tag':  'GIS LAYER · Financial hotspot',
      'layers.popup.atms.desc': 'Active ATM with high cash-transaction volume. A property/robbery vulnerability point.',
      'layers.popup.dark.tag':  'GIS LAYER · Poor street lighting',
      'layers.popup.dark.desc': 'Area with weak camera coverage and street lighting. Significantly raises concealment likelihood for property and violent crime.',

      // Hamburger menu items
      'menu.analytics':       'Analytics & Calibration',
      'menu.intel':           'Target Intel',
      'menu.lpr':             'LPR Alerts',
      'menu.osint':           'OSINT Layer',
      'menu.layers':          'Context Layers (RTM)',
      'menu.sound':           'Sound / Mute',
      'menu.logout':          'Logout',

      // Stats strip
      'stats.crisis':         'Crisis Cells',
      'stats.attacksAverted': 'Attacks Averted',
      'stats.unitsDeployed':  'Units Deployed',
      'stats.coverage':       'Patrol Coverage',

      // Toasts / log events
      'event.regenToast':     '🔄 Prediction model re-run',
      'event.regenLog':       'Model re-run — 24h forecast updated',
      'event.dispatched':     '{unit} dispatched to {target}',
      'event.arrived':        '{unit} arrived on scene',
      'event.returning':      '{unit} returning to home station',
      'event.returnArrival':  '{unit} back at home station · available for dispatch',
      'event.strategicOn':    '📅 Strategic event activated: {name}',
      'event.strategicOff':   '📅 Strategic event deactivated: {name}',
      'event.strategicOnLog': '📅 Strategic event activated: {name}',
      'event.strategicOffLog':'📅 Strategic event deactivated: {name}',

      // Toasts / dispatch
      'toast.noHotspot':      '⚠ No risk cell selected',
      'toast.noStation':      '⚠ No available station',
      'toast.noUnits':        '⚠ No available units in district',
      'toast.dispatchMutual': '🚓 Mutual aid: {n} units assigned ({mut} from neighboring stations) to cell #{id} at {zone}',
      'toast.dispatch':       '🚓 Patrol assigned: {n} units to cell #{id} at {zone}',
      'toast.dispatchLog':    'Assigned {n} directed-patrol units to cell #{id} at {zone} ({pct}%)',
      'toast.dispatchLogMutual': 'Assigned {n} directed-patrol units to cell #{id} at {zone} ({pct}%) — incl. {mut} mutual-aid',
      'toast.enroute':        'en route to {zone}',
      'toast.saturationEmpty':'No high-risk cells to saturate',
      'toast.saturation':     '🛡️ Increased preventive patrol on {n} hotspots',
      'toast.saturationLog':  'Activated saturation patrol on {n} high-risk cells',
      'toast.lprNoStation':   '⚠ No available station near the camera',
      'toast.lprNoUnits':     '⚠ No free units to LPR-dispatch at {st} or nearby',
      'toast.lprMutual':      '🚓 LPR mutual aid: unit {cs} from {st} dispatched to {cam}',
      'toast.lpr':            '🚓 LPR dispatch: unit {cs} from {st} dispatched to {cam}',
      'toast.lprLogMutual':   '🚨 LPR mutual aid: dispatched unit {cs} to capture {status} vehicle · plate {plate} · {cam}',
      'toast.lprLog':         '🚨 LPR dispatch: dispatched unit {cs} to capture {status} vehicle · plate {plate} · {cam}',
      'toast.lprChase':       'LPR pursuit · {cam}',
      'toast.arrived':        '{cs} arrived at {target} · realistic ETA {min} min',
      'toast.returning':      '{cs} finished response · returning to station',
      'toast.printOrder':     '⎙ Printed directed-patrol order issued for risk cell #{id}',
      'toast.hotspotNotFound':'⚠ Hotspot not found',
      'toast.logout':         '🚪 Logging out…',
      'toast.lprResolved':    'Resolved successfully by unit {cs}',

      // Intel log empty + access denied
      'log.empty':            'No recorded activity',
      'access.denied':        'Invalid access code // ACCESS DENIED',

      // Rail labels for relocated buttons
      'rail.analytics':       'Analytics',
      'rail.intel':           'Intel',
      'rail.lpr':             'LPR',

      // Forecast factors (already had peakHour/weekendNight)
      'factor.darkHours':     'Dark hours',

      // Time helpers
      'time.minsAgo':         '{n} min ago',
      'time.hoursAgo':        '{n} hr ago',
      'time.now':             'now',
      'osint.source':         'Source',
      'osint.openInTelegram': 'Open message on Telegram',
      'osint.logLine':        '📡 OSINT signal · {src}: {crime} at {zone} (confidence {conf}%)',

      // Footer
      'footer.tag':           'TOMORROW · Crime Prediction Network',

      // Print patrol order
      'print.title':          'Directed Patrol Order — Risk Cell',
      'print.header.country': 'State Police — São Paulo',
      'print.header.district':'Metropolitan District · Operations Division · Directed Patrol Branch',
      'print.confidential':   'DEMO — NOT FOR OPERATIONAL USE',
      'print.watermark':      'Demo · Not for operational use · DEMO · NOT FOR OPERATIONAL USE'
    },

    he: {
      'boot.line1':           'אתחול רשת ניבוי וטעינת שכבות הקשר (RTM)…',
      'boot.line2':           'הרצת מודל חיזוי 24 שעות + סנכרון מודיעין…',
      'boot.line3':           'TOMORROW מקוון.',
      'boot.online':          '✅ מערכת הניבוי והיתוך המודיעין מקוונת — מודל RTM נטען בהצלחה',

      'app.title':            'TOMORROW · רשת ניבוי פשיעה',
      'app.sub':              'רשת ניבוי פשיעה',
      'app.classification':   'תצוגת הדגמה // לא מערכת מבצעית',
      'app.disclaimer':       'דמו · נתונים פיקטיביים · ללא אבטחה אמיתית · קוד גישה קוסמטי',
      'app.builtBy':          'נבנה ע״י אלחי פיין',
      'app.contact':          'צור קשר',
      'app.poweredBy':        'פותח ע״י',
      'app.brand':            'דג הזהב',

      'login.codeLabel':      'קוד גישה מבצעי',
      'login.codePlaceholder':'• • • •',
      'login.enter':          'כניסה למערכת ▸',
      'login.wrongCode':      'קוד גישה שגוי',
      'login.language':       'שפה',
      'login.country':        'מדינה',

      'hud.threat':           'DTI',
      'hud.threatLow':        'רגישות רגילה',
      'hud.threatMed':        'רגישות מוגברת',
      'hud.threatHigh':       'כוננות גבוהה',
      'hud.threatCritical':   'כוננות קריטית',
      'hud.allDistrict':      'כל המרחב',
      'hud.muteOn':           'הפעל קול',
      'hud.muteOff':          'השתק קול',
      'hud.menu':             'תפריט מערכת',
      'hud.logout':           'יציאה',
      'hud.version':          'גרסה',

      'crime.burglary':       'פריצה לבית',
      'crime.auto_theft':     'גניבת רכב',
      'crime.robbery':        'שוד',
      'crime.assault':        'תקיפה / אלימות',
      'crime.drugs':          'עברות סמים',
      'crime.domestic':       'אלימות במשפחה',
      'crime.vandalism':      'ונדליזם',
      'crime.theft':          'גניבה / כיסנות',
      'crime.disorder':       'הפרת סדר ציבורי',
      'crime.business':       'התפרצות לעסק',

      'unit.patrol':          'ניידת סיור',
      'unit.k9':              'יחידת כלבנים',
      'unit.swat':            'יס"מ / מתפרצת',
      'unit.motor':           'אופנוע סיור',
      'unit.undercover':      'בלשים סמויים',
      'unit.command':         'נייד פיקוד',

      'factor.peakHour':      'שעת שיא לעבירה',
      'factor.weekendNight':  'סופ״ש · חיי לילה',
      'factor.poorLighting':  'אזור תאורה ציבורית לקויה',
      'factor.barsNearby':    'קרבה למוקדי חיכוך / חיי לילה',
      'factor.atmsNearby':    'קרבה לכספומט / מוקד פיננסי',

      'log.title':            'יומן מבצעי',
      'events.title':         'אירועים אסטרטגיים',
      'events.active':        'פעיל',
      'events.inactive':      'לא פעיל',

      'forecast.title':       'תחזית פשיעה',
      'forecast.regen':       'הרץ מודל',
      'forecast.saturate':    'סיור מונע',
      'forecast.dispatch':    'הזנק ניידת',
      'forecast.timeline':    'ציר זמן ניבוי',
      'forecast.now':         'עכשיו',
      'forecast.severity.low':      'נמוך',
      'forecast.severity.medium':   'בינוני',
      'forecast.severity.high':     'גבוה',
      'forecast.severity.critical': 'קריטי',
      'forecast.station':     'תחנה',
      'forecast.window':      'חלון',
      'forecast.eta':         'דק׳',
      'forecast.empty':       'אין תחזית לאזור / לשעה שנבחרו',

      'units.title':          'ניידות',
      'units.empty':          'אין יחידות בתחנה זו',
      'units.available':      'זמינה · בתחנה',
      'units.enroute':        'בדרך',
      'units.onscene':        'בזירה',
      'units.onsceneSecuring':'בשטח · אבטחת מוקד ({sec}ש׳)',
      'units.returning':      'חוזרת לתחנה',

      'osint.toggle':         'OSINT',
      'osint.loaded':         '📡 {n} אותות OSINT נטענו',
      'osint.demoSuffix':     '(דמו)',
      'osint.liveSuffix':     '(חי · Firebase)',
      'osint.popup.nlpHeader':  'עיבוד ישויות NLP גולמיות:',
      'osint.popup.classifier': 'סיווג אירוע חזוי',
      'osint.popup.coords':     'נ״צ גאוגרפי שחולץ',
      'osint.popup.source':     'מקור היתוך מידע',
      'osint.popup.confidence': 'מהימנות',
      'osint.popup.sourceLabel':'פיד מודיעין OSINT (דמו)',

      'intel.title':          'תיק יעד מודיעיני',
      'intel.disclaimer':     'איכון / האזנות סלולאריות מותנים בצו שיפוטי. הנתונים כאן הם דמו לצורך תכן UI.',
      'intel.age':            'גיל',
      'intel.status':         'סטטוס',
      'intel.affiliation':    'שיוך ארגוני',
      'intel.record':         'רקע פלילי',
      'intel.lastCell':       'איכון סלולארי אחרון',
      'intel.osintMentions':  'אזכורים ב-OSINT',
      'intel.locate':         'מקד על המפה',
      'intel.location':       'מיקום',
      'intel.precision':      'דיוק',
      'intel.when':           'מתי',

      'lpr.title':            'התראות LPR',
      'lpr.disclaimer':       'פיד דמו. הצלבה בפועל מצריכה אינטגרציית API משטרת ישראל.',
      'lpr.dispatch':         'הזנק ניידת',
      'lpr.camera':           'מצלמה',
      'lpr.status.stolen':    'גנוב',
      'lpr.status.flagged':   'מסומן',
      'lpr.status.clean':     'נקי',
      'lpr.status.secured':   'טופל',
      'lpr.minsAgo':          'לפני {n} דק׳',
      'lpr.focus':            'מקד',

      'analytics.title':      'אנליטיקה וכיול מודל',
      'analytics.tab.kpi':    'מדדי פעילות',
      'analytics.tab.val':    'אימות מודל (B2B)',
      'analytics.utilization':'ניצולת ניידות',
      'analytics.coverage':   'כיסוי תחזית',
      'analytics.backtest':   'הפעל סימולציית הדגמה (30 יום)',
      'analytics.backtest.running': 'מריץ סימולציית הדגמה...',
      'analytics.backtest.startToast': '📊 מתחיל סימולציית הדגמה (30 ימי פשיעה סינתטיים)...',
      'analytics.backtest.doneToast':  '✅ סימולציית ההדגמה הסתיימה (נתונים סינתטיים)',
      'analytics.kpis':               'מדדי ביצוע (KPIs)',
      'analytics.coverage':           'כיסוי סיור מונחה',
      'analytics.utilization':        'ניצולת כוחות',
      'analytics.trend':              'מגמת פשיעה צפויה (24h)',
      'analytics.crimeMix':           'פילוח סוגי עבירה',
      'analytics.weights':            'מקרן סיכון טקטי (Weights)',
      'analytics.weight.base':        'בסיס עבירה',
      'analytics.weight.fit':         'שעות שיא',
      'analytics.weight.hist':        'משקל היסטורי',
      'analytics.weight.osint':       'אות מודיעין (OSINT)',
      'analytics.evalMetrics':        'מדדי הערכת מודל (סטטיסטיקה מדעית)',
      'analytics.rocAuc':             'כושר הפרדה (ROC-AUC)',
      'analytics.precision':          'מדד דיוק (Precision)',
      'analytics.recall':             'מדד רגישות (Recall)',
      'analytics.f1':                 'ציון מצרפי (F1)',
      'analytics.confusion':          'מטריצת טעויות (השוואת תחזית מול מציאות)',
      'analytics.pred.crime':         'חזוי: פשע',
      'analytics.pred.calm':          'חזוי: שקט',
      'analytics.actual.crime':       'בפועל: פשע',
      'analytics.actual.calm':        'בפועל: שקט',
      'analytics.tp':                 'זיהוי אמת (TP)',
      'analytics.fn':                 'סיווג חסר (FN)',
      'analytics.fp':                 'התרעת שווא (FP)',
      'analytics.tn':                 'שקט תקין (TN)',
      'analytics.rocCurve':           'עקומת ביצועים ROC (כיול מודל)',
      'analytics.noCrimeData':        'אין נתוני פשיעה זמינים',
      'analytics.backtestLog':        '📊 אימות מודל מול 30 ימי עבר בוצע בהצלחה: ROC-AUC = {roc}, Precision = {prec}%, Recall = {rec}%',

      'layers.title':         'שכבות הקשר (RTM)',
      'layers.bars':          'ברים / חיי לילה',
      'layers.atms':          'כספומטים / פיננסי',
      'layers.lighting':      'תאורת רחוב לקויה',
      'layers.modalTitle':    'שכבות מידע סביבתיות (RTM)',
      'layers.barsLayer':     'מוקדי חיכוך וחיי לילה (ברים)',
      'layers.atmsLayer':     'מוקדים פיננסיים (כספומטים)',
      'layers.darkLayer':     'אזורי תאורה לקויה (חשכה)',
      'layers.popup.bars.tag':  'GIS LAYER · מוקדי חיכוך',
      'layers.popup.bars.desc': 'ריכוז חיי לילה וצריכת אלכוהול המגבירים פוטנציאל לתגרה והפרת סדר בשעות הלילה.',
      'layers.popup.atms.tag':  'GIS LAYER · מוקד פיננסי',
      'layers.popup.atms.desc': 'כספומט פעיל בריכוז גבוה של עסקאות מזומן. מהווה נקודת תורפה לעבירות שוד וגניבת רכוש.',
      'layers.popup.dark.tag':  'GIS LAYER · תאורת רחוב לקויה',
      'layers.popup.dark.desc': 'שטח עם כיסוי מצלמות ותאורה ציבורית לקויים. מגביר משמעותית את סיכויי הסוואה לעבירות רכוש ופשע אלים.',

      'menu.analytics':       'אנליטיקה וכיול מודל',
      'menu.intel':           'תיק יעד מודיעיני',
      'menu.lpr':             'התראות LPR',
      'menu.osint':           'שכבת OSINT',
      'menu.layers':          'שכבות הקשר (RTM)',
      'menu.sound':           'קול / השתקה',
      'menu.logout':          'יציאה',

      'stats.crisis':         'תאי סיכון',
      'stats.attacksAverted': 'איומי ליבה',
      'stats.unitsDeployed':  'פריסת כוחות',
      'stats.coverage':       'כיסוי סיור',

      'event.regenToast':     '🔄 מודל הניבוי הורץ מחדש',
      'event.regenLog':       'הרצת מודל ניבוי מחדש — תחזית 24 שעות עודכנה',
      'event.dispatched':     '🚔 {unit} הוזנקה ל-{target}',
      'event.arrived':        '🚔 {unit} הגיעה לזירה',
      'event.returning':      '🚔 {unit} חוזרת לתחנת האם',
      'event.returnArrival':  '🚔 {unit} חזרה לתחנת האם · זמינה לשיגור',
      'event.strategicOn':    '📅 אירוע הופעל: {name}',
      'event.strategicOff':   '📅 אירוע הושבת: {name}',
      'event.strategicOnLog': '📅 אירוע אסטרטגי הופעל: {name}',
      'event.strategicOffLog':'📅 אירוע אסטרטגי הושבת: {name}',

      'toast.noHotspot':      '⚠ לא נבחר מוקד חיזוי',
      'toast.noStation':      '⚠ לא נמצאה תחנה זמינה',
      'toast.noUnits':        '⚠ אין ניידות זמינות בכל המרחב',
      'toast.dispatchMutual': '🚓 סיוע הדדי: {n} צוותים הוקצו (מתוכם {mut} מתחנה שכנה) לתא #{id} ב{zone}',
      'toast.dispatch':       '🚓 פריסת סיור: {n} צוותים הוקצו לתא #{id} ב{zone}',
      'toast.dispatchLog':    'הקצאת {n} צוותי סיור מונחה לתא #{id} ב{zone} ({pct}%)',
      'toast.dispatchLogMutual': 'הקצאת {n} צוותי סיור מונחה לתא #{id} ב{zone} ({pct}%) - כולל {mut} צוותי סיוע הדדי',
      'toast.enroute':        'בדרך ל{zone}',
      'toast.saturationEmpty':'אין מוקדים בסיכון גבוה לרוויה',
      'toast.saturation':     '🛡️ סיור מונע מוגבר על {n} מוקדים',
      'toast.saturationLog':  'הפעלת סיור מונע מוגבר על {n} מוקדי סיכון גבוה',
      'toast.lprNoStation':   '⚠ לא נמצאה תחנה זמינה בסביבת המצלמה',
      'toast.lprNoUnits':     '⚠ אין ניידות פנויות להזנקת LPR ב{st} או בסביבתה',
      'toast.lprMutual':      '🚓 סיוע הדדי LPR: צוות {cs} מתחנת {st} הוזנק למצלמה ב{cam}',
      'toast.lpr':            '🚓 שיגור LPR: צוות {cs} הוזנק מ{st} למצלמה ב{cam}',
      'toast.lprLogMutual':   '🚨 סיוע הדדי LPR: הזנקת צוות {cs} לתפיסת רכב {status} · לוחית {plate} · {cam}',
      'toast.lprLog':         '🚨 שיגור LPR: הזנקת צוות {cs} לתפיסת רכב {status} · לוחית {plate} · {cam}',
      'toast.lprChase':       'מרדף LPR · {cam}',
      'toast.arrived':        '{cs} הגיעה ל{target} · ETA ריאלי {min} דק׳',
      'toast.returning':      '{cs} סיימה טיפול · בדרך חזרה לתחנה',
      'toast.printOrder':     '⎙ הונפקה פקודת סיור מונחת מודפסת לתא סיכון #{id}',
      'toast.hotspotNotFound':'⚠ מוקד חיזוי לא נמצא',
      'toast.logout':         '🚪 יוצא מהמערכת…',
      'toast.lprResolved':    'טופל בהצלחה ע״י צוות {cs}',

      'log.empty':            'אין פעילות מתועדת',
      'access.denied':        'קוד גישה שגוי // ACCESS DENIED',

      'rail.analytics':       'אנליטיקה',
      'rail.intel':           'מודיעין',
      'rail.lpr':             'LPR',

      'factor.darkHours':     'שעות חשכה',

      'time.minsAgo':         'לפני {n} דק׳',
      'time.hoursAgo':        'לפני {n} שע׳',
      'time.now':             'עכשיו',
      'osint.source':         'מקור',
      'osint.openInTelegram': 'פתח את ההודעה בטלגרם',
      'osint.logLine':        '📡 אות OSINT · {src}: {crime} ב{zone} (מהימנות {conf}%)',

      'footer.tag':           'TOMORROW · רשת ניבוי פשיעה',

      'print.title':          'פקודת סיור מונחה — תא סיכון',
      'print.header.country': 'מדינת ישראל — משטרת ישראל',
      'print.header.district':'מחוז תל אביב • אגף המבצעים • ענף סיור ושיטור מונחה',
      'print.confidential':   'תצוגת דמו — לא לשימוש מבצעי',
      'print.watermark':      'תצוגת דמו · לא לשימוש מבצעי · DEMO · NOT FOR OPERATIONAL USE'
    },

    pt: {
      'boot.line1':           'Inicializando rede de previsão e camadas RTM…',
      'boot.line2':           'Executando modelo de previsão 24h + sincronizando OSINT…',
      'boot.line3':           'TOMORROW online.',
      'boot.online':          '✅ Previsão + fusão de inteligência online — modelo RTM carregado',

      'app.title':            'TOMORROW · Grade de Previsão de Crimes',
      'app.sub':              'Rede de Previsão de Crimes',
      'app.classification':   'AMBIENTE DE DEMONSTRAÇÃO // NÃO É UM SISTEMA OPERACIONAL',
      'app.disclaimer':       'Demo · Dados fictícios · Sem segurança real · Senha de acesso é cosmética',
      'app.builtBy':          'Desenvolvido por Elchai Fine',
      'app.contact':          'Contato',
      'app.poweredBy':        'Por',
      'app.brand':            'Dag Hazahav',

      'login.codeLabel':      'Senha de Acesso Operacional',
      'login.codePlaceholder':'• • • •',
      'login.enter':          'Entrar no Sistema ▸',
      'login.wrongCode':      'Senha inválida',
      'login.language':       'Idioma',
      'login.country':        'Região',

      'hud.threat':           'DTI',
      'hud.threatLow':        'Sensibilidade Normal',
      'hud.threatMed':        'Sensibilidade Elevada',
      'hud.threatHigh':       'Alerta Alto',
      'hud.threatCritical':   'Alerta Crítico',
      'hud.allDistrict':      'Todo o Distrito',
      'hud.muteOn':           'Ativar som',
      'hud.muteOff':          'Silenciar som',
      'hud.menu':             'Menu do Sistema',
      'hud.logout':           'Sair',
      'hud.version':          'Versão',

      'crime.burglary':       'Furto a residência',
      'crime.auto_theft':     'Roubo de veículo',
      'crime.robbery':        'Assalto',
      'crime.assault':        'Agressão / Violência',
      'crime.drugs':          'Tráfico de drogas',
      'crime.domestic':       'Violência doméstica',
      'crime.vandalism':      'Vandalismo',
      'crime.theft':          'Furto / Carteirismo',
      'crime.disorder':       'Perturbação da ordem',
      'crime.business':       'Arrombamento comercial',

      'unit.patrol':          'Viatura de patrulha',
      'unit.k9':              'Canil (K9)',
      'unit.swat':            'BOPE / Tático',
      'unit.motor':           'Patrulha motorizada',
      'unit.undercover':      'Investigadores à paisana',
      'unit.command':         'Comando móvel',

      'factor.peakHour':      'Hora de pico para o delito',
      'factor.weekendNight':  'Fim de semana · vida noturna',
      'factor.poorLighting':  'Iluminação pública precária',
      'factor.barsNearby':    'Proximidade de bares / vida noturna',
      'factor.atmsNearby':    'Proximidade de caixa eletrônico / centro financeiro',

      'log.title':            'Registro Operacional',
      'events.title':         'Eventos Estratégicos',
      'events.active':        'Ativo',
      'events.inactive':      'Inativo',

      'forecast.title':       'Previsão de Crimes',
      'forecast.regen':       'Executar Modelo',
      'forecast.saturate':    'Patrulha de Saturação',
      'forecast.dispatch':    'Despachar Unidade',
      'forecast.timeline':    'Linha de Tempo da Previsão',
      'forecast.now':         'agora',
      'forecast.severity.low':      'Baixo',
      'forecast.severity.medium':   'Moderado',
      'forecast.severity.high':     'Alto',
      'forecast.severity.critical': 'Crítico',
      'forecast.station':     'Batalhão',
      'forecast.window':      'Janela',
      'forecast.eta':         'min',
      'forecast.empty':       'Sem previsão para área / hora selecionadas',

      'units.title':          'Unidades',
      'units.empty':          'Sem unidades neste batalhão',
      'units.available':      'disponível · no batalhão',
      'units.enroute':        'a caminho',
      'units.onscene':        'no local',
      'units.onsceneSecuring':'no local · assegurando ({sec}s)',
      'units.returning':      'retornando ao batalhão',

      'osint.toggle':         'OSINT',
      'osint.loaded':         '📡 {n} sinais OSINT carregados',
      'osint.demoSuffix':     '(demo)',
      'osint.liveSuffix':     '(ao vivo · Firebase)',
      'osint.popup.nlpHeader':  'Extração de entidades NLP:',
      'osint.popup.classifier': 'Classificação prevista do evento',
      'osint.popup.coords':     'Coordenadas geográficas extraídas',
      'osint.popup.source':     'Fonte de fusão de informação',
      'osint.popup.confidence': 'Confiança',
      'osint.popup.sourceLabel':'Feed de inteligência OSINT (demo)',

      'intel.title':          'Inteligência de Alvo',
      'intel.disclaimer':     'Rastreamento celular / interceptação requerem autorização judicial. Os dados aqui são demo para fins de design de interface.',
      'intel.age':            'Idade',
      'intel.status':         'Status',
      'intel.affiliation':    'Afiliação',
      'intel.record':         'Antecedentes criminais',
      'intel.lastCell':       'Última localização celular',
      'intel.osintMentions':  'Menções em OSINT',
      'intel.locate':         'Localizar no mapa',
      'intel.location':       'Localização',
      'intel.precision':      'Precisão',
      'intel.when':           'Quando',

      'lpr.title':            'Alertas LPR',
      'lpr.disclaimer':       'Feed de demonstração. Cruzamento com registros reais de veículos roubados exige integração via API com a Polícia.',
      'lpr.dispatch':         'Despachar unidade',
      'lpr.camera':           'Câmera',
      'lpr.status.stolen':    'ROUBADO',
      'lpr.status.flagged':   'MARCADO',
      'lpr.status.clean':     'Limpo',
      'lpr.status.secured':   'Resolvido',
      'lpr.minsAgo':          '{n} min atrás',
      'lpr.focus':            'Focar',

      'analytics.title':      'Análise e Calibração do Modelo',
      'analytics.tab.kpi':    'KPIs Operacionais',
      'analytics.tab.val':    'Validação do Modelo (B2B)',
      'analytics.utilization':'Utilização de Unidades',
      'analytics.coverage':   'Cobertura da Previsão',
      'analytics.backtest':   'Executar simulação demo (30 dias)',
      'analytics.backtest.running': 'Executando simulação demo…',
      'analytics.backtest.startToast': '📊 Iniciando simulação demo (30 dias de crime sintéticos)…',
      'analytics.backtest.doneToast':  '✅ Simulação demo concluída (dados sintéticos)',
      'analytics.kpis':               'KPIs',
      'analytics.coverage':           'Cobertura de patrulha dirigida',
      'analytics.utilization':        'Utilização de unidades',
      'analytics.trend':              'Tendência de crime prevista (24h)',
      'analytics.crimeMix':           'Distribuição por tipo de delito',
      'analytics.weights':            'Pesos de risco tático',
      'analytics.weight.base':        'Taxa base do crime',
      'analytics.weight.fit':         'Horas de pico',
      'analytics.weight.hist':        'Peso histórico',
      'analytics.weight.osint':       'Sinal OSINT',
      'analytics.evalMetrics':        'Métricas de avaliação do modelo (estatísticas)',
      'analytics.rocAuc':             'Capacidade de separação (ROC-AUC)',
      'analytics.precision':          'Precisão (Precision)',
      'analytics.recall':             'Sensibilidade (Recall)',
      'analytics.f1':                 'Pontuação agregada (F1)',
      'analytics.confusion':          'Matriz de confusão (previsão × realidade)',
      'analytics.pred.crime':         'Previsto: crime',
      'analytics.pred.calm':          'Previsto: calmo',
      'analytics.actual.crime':       'Real: crime',
      'analytics.actual.calm':        'Real: calmo',
      'analytics.tp':                 'Verdadeiro positivo (TP)',
      'analytics.fn':                 'Detecção perdida (FN)',
      'analytics.fp':                 'Alarme falso (FP)',
      'analytics.tn':                 'Verdadeiro negativo (TN)',
      'analytics.rocCurve':           'Curva de desempenho ROC (calibração do modelo)',
      'analytics.noCrimeData':        'Sem dados de crime disponíveis',
      'analytics.backtestLog':        '📊 Backtest vs 30 dias concluído: ROC-AUC = {roc}, Precision = {prec}%, Recall = {rec}%',

      'layers.title':         'Camadas de Contexto (RTM)',
      'layers.bars':          'Bares & Vida Noturna',
      'layers.atms':          'Caixas Eletrônicos / Financeiro',
      'layers.lighting':      'Iluminação Pública Precária',
      'layers.modalTitle':    'Camadas de informação ambiental (RTM)',
      'layers.barsLayer':     'Pontos de atrito & vida noturna (bares)',
      'layers.atmsLayer':     'Pontos financeiros (caixas eletrônicos)',
      'layers.darkLayer':     'Zonas mal iluminadas (escuridão)',
      'layers.popup.bars.tag':  'CAMADA GIS · Ponto de atrito',
      'layers.popup.bars.desc': 'Concentração de vida noturna e consumo de álcool eleva o potencial de brigas e perturbação da ordem.',
      'layers.popup.atms.tag':  'CAMADA GIS · Ponto financeiro',
      'layers.popup.atms.desc': 'Caixa eletrônico ativo com alto volume de transações em dinheiro. Vulnerabilidade para assalto e roubo.',
      'layers.popup.dark.tag':  'CAMADA GIS · Iluminação precária',
      'layers.popup.dark.desc': 'Área com cobertura precária de câmeras e iluminação. Aumenta significativamente a chance de ocultação para crimes patrimoniais e violentos.',

      'menu.analytics':       'Análise e Calibração',
      'menu.intel':           'Inteligência de Alvo',
      'menu.lpr':             'Alertas LPR',
      'menu.osint':           'Camada OSINT',
      'menu.layers':          'Camadas de Contexto (RTM)',
      'menu.sound':           'Som / Silêncio',
      'menu.logout':          'Sair',

      'stats.crisis':         'Células de Risco',
      'stats.attacksAverted': 'Ataques Evitados',
      'stats.unitsDeployed':  'Unidades Mobilizadas',
      'stats.coverage':       'Cobertura de Patrulha',

      'event.regenToast':     '🔄 Modelo de previsão re-executado',
      'event.regenLog':       'Modelo re-executado — previsão de 24h atualizada',
      'event.dispatched':     '🚔 {unit} despachada para {target}',
      'event.arrived':        '🚔 {unit} chegou ao local',
      'event.returning':      '🚔 {unit} retornando ao batalhão',
      'event.returnArrival':  '🚔 {unit} de volta ao batalhão · disponível para despacho',
      'event.strategicOn':    '📅 Evento estratégico ativado: {name}',
      'event.strategicOff':   '📅 Evento estratégico desativado: {name}',
      'event.strategicOnLog': '📅 Evento estratégico ativado: {name}',
      'event.strategicOffLog':'📅 Evento estratégico desativado: {name}',

      'toast.noHotspot':      '⚠ Nenhuma célula de risco selecionada',
      'toast.noStation':      '⚠ Nenhum batalhão disponível',
      'toast.noUnits':        '⚠ Nenhuma unidade disponível no distrito',
      'toast.dispatchMutual': '🚓 Apoio mútuo: {n} unidades atribuídas ({mut} de batalhões vizinhos) à célula #{id} em {zone}',
      'toast.dispatch':       '🚓 Patrulha atribuída: {n} unidades à célula #{id} em {zone}',
      'toast.dispatchLog':    'Atribuídas {n} unidades de patrulha dirigida à célula #{id} em {zone} ({pct}%)',
      'toast.dispatchLogMutual': 'Atribuídas {n} unidades de patrulha dirigida à célula #{id} em {zone} ({pct}%) — incl. {mut} apoio mútuo',
      'toast.enroute':        'a caminho de {zone}',
      'toast.saturationEmpty':'Sem células de alto risco para saturar',
      'toast.saturation':     '🛡️ Patrulha preventiva reforçada em {n} pontos',
      'toast.saturationLog':  'Ativada patrulha de saturação em {n} células de alto risco',
      'toast.lprNoStation':   '⚠ Sem batalhão disponível perto da câmera',
      'toast.lprNoUnits':     '⚠ Sem unidades livres para despacho LPR em {st} ou nas proximidades',
      'toast.lprMutual':      '🚓 Apoio mútuo LPR: unidade {cs} do batalhão {st} despachada para {cam}',
      'toast.lpr':            '🚓 Despacho LPR: unidade {cs} despachada de {st} para {cam}',
      'toast.lprLogMutual':   '🚨 Apoio mútuo LPR: despacho da unidade {cs} para capturar veículo {status} · placa {plate} · {cam}',
      'toast.lprLog':         '🚨 Despacho LPR: unidade {cs} despachada para capturar veículo {status} · placa {plate} · {cam}',
      'toast.lprChase':       'Perseguição LPR · {cam}',
      'toast.arrived':        '{cs} chegou em {target} · ETA realista {min} min',
      'toast.returning':      '{cs} concluiu atendimento · retornando ao batalhão',
      'toast.printOrder':     '⎙ Ordem de patrulha dirigida impressa para célula de risco #{id}',
      'toast.hotspotNotFound':'⚠ Célula não encontrada',
      'toast.logout':         '🚪 Saindo do sistema…',
      'toast.lprResolved':    'Resolvido com sucesso pela unidade {cs}',

      'log.empty':            'Sem atividade registrada',
      'access.denied':        'Senha de acesso inválida // ACCESS DENIED',

      'rail.analytics':       'Análise',
      'rail.intel':           'Intel',
      'rail.lpr':             'LPR',

      'factor.darkHours':     'Horário noturno',

      'time.minsAgo':         '{n} min atrás',
      'time.hoursAgo':        '{n} h atrás',
      'time.now':             'agora',
      'osint.source':         'Fonte',
      'osint.openInTelegram': 'Abrir mensagem no Telegram',
      'osint.logLine':        '📡 Sinal OSINT · {src}: {crime} em {zone} (confiança {conf}%)',

      'footer.tag':           'TOMORROW · Rede de Previsão de Crimes',

      'print.title':          'Ordem de Patrulha Dirigida — Célula de Risco',
      'print.header.country': 'Polícia Militar — Estado de São Paulo',
      'print.header.district':'Distrito Metropolitano • Divisão de Operações • Patrulhamento Dirigido',
      'print.confidential':   'DEMO — NÃO USAR OPERACIONALMENTE',
      'print.watermark':      'Demo · Não usar operacionalmente · DEMO · NOT FOR OPERATIONAL USE'
    }
  };

  let current = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_LANG);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (_) { /* ignore */ }
    return 'en';   // default per project spec
  })();

  function getLang() { return current; }
  function getSupported() { return SUPPORTED.slice(); }
  function getMeta(lang) { return META[lang || current] || META.en; }

  // Substitute {name} placeholders.
  function format(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  }

  function t(key, vars) {
    const dict = STRINGS[current] || {};
    const fallback = STRINGS.en;
    const raw = (key in dict) ? dict[key]
              : (key in fallback) ? fallback[key]
              : key;
    return format(raw, vars);
  }

  // Update every static element with [data-i18n="key"] — and apply
  // html.lang + html.dir + body.classList so the page mirrors correctly.
  function applyDom() {
    const meta = getMeta();
    document.documentElement.lang = current;
    document.documentElement.dir = meta.dir;
    document.body?.classList.toggle('lang-rtl', meta.dir === 'rtl');
    document.body?.classList.toggle('lang-ltr', meta.dir === 'ltr');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      // syntax: data-i18n-attr="title:hud.menu;aria-label:hud.menu"
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return false;
    current = lang;
    try { localStorage.setItem(STORAGE_LANG, lang); } catch (_) { /* ignore */ }
    applyDom();
    document.dispatchEvent(new CustomEvent('tomorrow-lang-change', { detail: { lang } }));
    return true;
  }

  return { t, setLang, getLang, getSupported, getMeta, applyDom };
})();

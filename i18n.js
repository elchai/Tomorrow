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

      // Layers
      'layers.title':         'Context Layers (RTM)',
      'layers.bars':          'Bars & Nightlife',
      'layers.atms':          'ATMs / Financial',
      'layers.lighting':      'Poor Street Lighting',

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

      'layers.title':         'שכבות הקשר (RTM)',
      'layers.bars':          'ברים / חיי לילה',
      'layers.atms':          'כספומטים / פיננסי',
      'layers.lighting':      'תאורת רחוב לקויה',

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

      'layers.title':         'Camadas de Contexto (RTM)',
      'layers.bars':          'Bares & Vida Noturna',
      'layers.atms':          'Caixas Eletrônicos / Financeiro',
      'layers.lighting':      'Iluminação Pública Precária',

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

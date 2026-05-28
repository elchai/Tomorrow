/* Push classified signals to Firebase Realtime DB using the Admin SDK —
   mirrors the mabat-443 telegram-client pattern.
   The Tomorrow dashboard reads the same /crime-signals path. */
const admin = require('firebase-admin');

const DATABASE_URL = process.env.FIREBASE_URL || 'https://mabat443-default-rtdb.asia-southeast1.firebasedatabase.app';
const TTL_MS = (parseInt(process.env.SIGNAL_TTL_HOURS || '72', 10)) * 3600 * 1000;
const SIGNALS_PATH = process.env.FIREBASE_SIGNALS_PATH || 'crime-signals';

let dbCached = null;

function db() {
  if (dbCached) return dbCached;
  if (admin.apps.length) return (dbCached = admin.app().database());

  // Same env-shape as 443: FIREBASE_SERVICE_ACCOUNT is the full JSON inline.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not set. Copy the JSON from mabat-443/.env (the\n' +
      '   same service-account that writes /auto-news there) into Tomorrow\'s .env so the\n' +
      '   scanner can write to /crime-signals on the same project.'
    );
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  });
  return (dbCached = admin.database());
}

async function pushSignal(signal) {
  const body = { ...signal, ts: new Date().toISOString(), expires_at: Date.now() + TTL_MS };
  await db().ref(`${SIGNALS_PATH}/${signal.id}`).set(body);
  return body;
}

// best-effort cleanup of expired signals — call periodically (e.g. every 30 min)
async function purgeExpired() {
  const snap = await db().ref(SIGNALS_PATH).once('value');
  const all = snap.val() || {};
  const now = Date.now();
  const stale = Object.entries(all).filter(([, v]) => v && v.expires_at && v.expires_at < now);
  await Promise.all(stale.map(([id]) => db().ref(`${SIGNALS_PATH}/${id}`).remove()));
  return stale.length;
}

module.exports = { pushSignal, purgeExpired, SIGNALS_PATH, DATABASE_URL };

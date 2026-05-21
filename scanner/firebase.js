/* Push classified signals to Firebase Realtime DB via REST.
   The Tomorrow dashboard reads the same /crime-signals path. */
const fetch = require('node-fetch');

const BASE = (process.env.FIREBASE_URL || '').replace(/\/$/, '');
const AUTH = process.env.FIREBASE_DB_SECRET ? `?auth=${process.env.FIREBASE_DB_SECRET}` : '';
const TTL_MS = (parseInt(process.env.SIGNAL_TTL_HOURS || '72', 10)) * 3600 * 1000;

async function pushSignal(signal) {
  if (!BASE) { console.warn('[firebase] FIREBASE_URL not set — signal not persisted:', signal.id); return; }
  const url = `${BASE}/crime-signals/${signal.id}.json${AUTH}`;
  const body = { ...signal, ts: new Date().toISOString(), expires_at: Date.now() + TTL_MS };
  const res = await fetch(url, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`firebase PUT ${res.status}`);
  return body;
}

// best-effort cleanup of expired signals (call periodically)
async function purgeExpired() {
  if (!BASE) return;
  const res = await fetch(`${BASE}/crime-signals.json${AUTH}`);
  if (!res.ok) return;
  const all = (await res.json()) || {};
  const now = Date.now();
  await Promise.all(Object.entries(all)
    .filter(([, v]) => v && v.expires_at && v.expires_at < now)
    .map(([id]) => fetch(`${BASE}/crime-signals/${id}.json${AUTH}`, { method: 'DELETE' })));
}

module.exports = { pushSignal, purgeExpired };

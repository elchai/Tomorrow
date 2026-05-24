/* ============================================================
   TOMORROW scanner — Telegram MTProto client (GramJS)
   Connects with a USER account (not a bot), listens to the
   channels in channels.js, classifies each message and pushes
   crime signals to Firebase. Run `npm run auth` once to log in.
   ============================================================ */
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');

const channels = require('./channels');
const { classify } = require('./classifier');
const { pushSignal } = require('./firebase');

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = new StringSession(process.env.TELEGRAM_SESSION || '');
const MIN_CONF = parseFloat(process.env.MIN_CONFIDENCE || '0.5');

const reliabilityByChat = {};   // chatId/username → reliability

async function createClient() {
  if (!apiId || !apiHash) throw new Error('Set TELEGRAM_API_ID / TELEGRAM_API_HASH in .env');
  const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: () => process.env.TELEGRAM_PHONE || input.text('מספר טלפון: '),
    password: () => input.text('סיסמת 2FA (אם יש): '),
    phoneCode: () => input.text('קוד מ-Telegram: '),
    onError: (e) => console.error(e)
  });
  return client;
}

// `npm run auth` — interactive login, prints the session string to put in .env
async function auth() {
  const client = await createClient();
  console.log('\n✅ מחובר. העתק את מחרוזת ה-SESSION ל-.env (TELEGRAM_SESSION):\n');
  console.log(client.session.save());
  await client.disconnect();
  process.exit(0);
}

async function handleMessage(event, client) {
  const msg = event.message;
  const text = msg && msg.message;
  if (!text) return;

  let key = 'unknown';
  try {
    const chat = await msg.getChat();
    key = chat && (chat.username || String(chat.id));
  } catch { /* ignore */ }
  const reliability = reliabilityByChat[key] || 5;

  const sig = classify(text, reliability);
  if (!sig || sig.confidence < MIN_CONF) return;

  sig.id = `tg-${msg.id}-${Date.now().toString(36)}`;
  sig.source = '@' + key;
  sig.source_type = 'telegram';
  // public channels: t.me/<username>/<msg_id> deep-links the specific message.
  // private/numeric chats won't deep-link cleanly — leave URLs blank in that case.
  const handle = (key && !/^-?\d+$/.test(key)) ? key : null;
  sig.source_url = handle ? `https://t.me/${handle}` : null;
  sig.msg_url    = handle ? `https://t.me/${handle}/${msg.id}` : null;
  sig.text_he = text.slice(0, 280);

  try {
    await pushSignal(sig);
    console.log(`📡 signal: ${sig.crime} · ${sig.zone} · conf ${sig.confidence} · ${sig.source}`);
  } catch (e) {
    console.error('push failed:', e.message);
  }
}

async function run() {
  const client = await createClient();
  console.log('🛰  TOMORROW scanner online. מאזין לערוצים…');

  const peers = [];
  for (const ch of channels) {
    try {
      const ent = await client.getEntity(ch.username);
      reliabilityByChat[ch.username] = ch.reliability;
      if (ent.id) reliabilityByChat[String(ent.id)] = ch.reliability;
      peers.push(ent);
      console.log(`  ✓ ${ch.username} (${ch.region}) · אמינות ${ch.reliability}`);
    } catch (e) {
      console.warn(`  ✗ ${ch.username}: ${e.message}`);
    }
  }

  client.addEventHandler((e) => handleMessage(e, client), new NewMessage({ chats: peers }));
}

if (require.main === module) {
  (process.argv.includes('--auth') ? auth() : run()).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { createClient, handleMessage };

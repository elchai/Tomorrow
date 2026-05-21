/* TOMORROW scanner entry point — always-on process.
   Starts the Telegram listener and periodically purges expired signals. */
require('dotenv').config();
const { createClient, handleMessage } = require('./telegram-client');
const { NewMessage } = require('telegram/events');
const { purgeExpired } = require('./firebase');
const channels = require('./channels');
const { classify } = require('./classifier');

(async () => {
  const client = await createClient();
  console.log('🛰  TOMORROW scanner online.');

  const peers = [];
  const relByKey = {};
  for (const ch of channels) {
    try {
      const ent = await client.getEntity(ch.username);
      relByKey[ch.username] = ch.reliability;
      peers.push(ent);
      console.log(`  ✓ listening: ${ch.username} (${ch.region})`);
    } catch (e) {
      console.warn(`  ✗ ${ch.username}: ${e.message}`);
    }
  }

  client.addEventHandler((e) => handleMessage(e, client), new NewMessage({ chats: peers }));

  // housekeeping: drop expired signals every 30 min
  setInterval(() => purgeExpired().catch(() => {}), 30 * 60 * 1000);

  // keep the process alive
  process.on('SIGINT', async () => { console.log('\nshutting down…'); await client.disconnect(); process.exit(0); });
})().catch(e => { console.error(e); process.exit(1); });

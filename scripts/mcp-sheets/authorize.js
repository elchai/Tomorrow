/**
 * One-time OAuth bootstrap.
 * Run with: `npm run authorize`
 * - Opens a browser, asks you to grant access to Google Sheets
 * - Saves the refresh token to ./token.json (gitignored)
 * - After this, server.js can run forever using the refresh token
 */
import { authenticate } from '@google-cloud/local-auth';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRED  = path.join(__dirname, 'credentials.json');
const TOKEN = path.join(__dirname, 'token.json');

// Minimum scope: read+write any sheet the user has access to.
// (Add 'https://www.googleapis.com/auth/drive.metadata.readonly' later if we
//  want a "list all my spreadsheets" tool.)
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const client = await authenticate({ keyfilePath: CRED, scopes: SCOPES });
const cred   = JSON.parse(await fs.readFile(CRED, 'utf8'));
const key    = cred.installed || cred.web;

await fs.writeFile(TOKEN, JSON.stringify({
  type: 'authorized_user',
  client_id: key.client_id,
  client_secret: key.client_secret,
  refresh_token: client.credentials.refresh_token
}, null, 2));

console.log('✓ Authorized. Token saved to', TOKEN);
console.log('  Scopes:', SCOPES.join(', '));

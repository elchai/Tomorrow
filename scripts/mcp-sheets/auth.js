/** Load the cached refresh-token and return an authenticated Google client. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = path.join(__dirname, 'token.json');

export async function loadAuth() {
  const raw = await fs.readFile(TOKEN, 'utf8').catch(() => null);
  if (!raw) throw new Error(`No token.json — run \`npm run authorize\` first (in ${__dirname})`);
  return google.auth.fromJSON(JSON.parse(raw));
}

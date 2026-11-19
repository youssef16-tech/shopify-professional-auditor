#!/usr/bin/env node
// Lets the store OWNER unlock a password-protected storefront (or log in) in a visible browser
// window, then saves that session for the collectors. The password is typed by the owner in the
// browser: it is never passed on the command line, printed, or written anywhere by this script.
// The saved session contains cookies: it stays in OUT/.auth (mode 600) and must not be shared.
// usage: node auth-session.mjs --url URL --out OUT
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { chromium } from 'playwright';
import { parseArgs, authStatePath } from './lib/common.mjs';

const args = parseArgs();
if (!args.url || !args.out) { console.error('usage: node auth-session.mjs --url URL --out OUT'); process.exit(64); }
const out = path.resolve(String(args.out));
const file = authStatePath(out);
fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });

let browser;
try { browser = await chromium.launch({ headless: false }); } catch {
  try { browser = await chromium.launch({ headless: false, executablePath: process.env.CHROME_PATH || '/usr/bin/chromium' }); } catch (e) {
    console.error(`Could not open a visible browser (a graphical session is required): ${String(e.message).split('\n')[0]}`); process.exit(1);
  }
}
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(String(args.url)).catch(() => {});
console.log('\nA browser window is open. Enter the storefront password (or log in) there.\nWhen the store pages are visible, come back here and press Enter to save the session.');
await new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin }); rl.once('line', () => { rl.close(); resolve(); }); });
await ctx.storageState({ path: file });
fs.chmodSync(file, 0o600);
await browser.close();
console.log(`Session saved to ${file} (cookies: do not share or commit). Re-run run-all.mjs with the same --out.`);

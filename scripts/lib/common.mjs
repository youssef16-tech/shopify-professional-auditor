// Shared helpers for all collectors. Every collector writes OUT/results/<area>.json
// using the record schema documented in SKILL.md.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

export const CATEGORIES = {
  uiux: { name: 'UI/UX & Visual Design', weight: 15 },
  functionality: { name: 'Functionality & Reliability', weight: 20 },
  ecommerce: { name: 'E-commerce & Checkout', weight: 15 },
  mobile: { name: 'Mobile & Responsive', weight: 10 },
  seo: { name: 'SEO', weight: 10 },
  performance: { name: 'Performance', weight: 10 },
  accessibility: { name: 'Accessibility', weight: 10 },
  technical: { name: 'Technical Quality & Maintainability', weight: 5 },
  security: { name: 'Security & Trust', weight: 5 },
};

export const STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED', 'N/A'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv = process.argv.slice(2)) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      const n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) a[k] = true;
      else { a[k] = n; i++; }
    } else a._.push(t);
  }
  return a;
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function normUrl(u, base) {
  try {
    const x = new URL(u, base);
    if (!/^https?:$/.test(x.protocol)) return null;
    x.hash = '';
    let s = x.toString();
    if (x.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

export function slug(u) {
  let p = u;
  try { p = new URL(u, 'http://x').pathname; } catch { /* keep */ }
  p = p.replace(/^\/+|\/+$/g, '');
  if (!p) return 'home';
  return p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'home';
}

// Remove anything secret-like or personal before it reaches a results or evidence file.
export function redact(s) {
  if (s === null || s === undefined) return s;
  return String(s)
    .replace(/\bshp(at|ss|ca|pa)_[A-Za-z0-9]{6,}/g, 'shp$1_[REDACTED]')
    .replace(/\bsk_live_[A-Za-z0-9]{6,}/g, 'sk_live_[REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, 'AIza[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [REDACTED]')
    .replace(/(\/checkouts\/(?:cn|c|co)\/)[A-Za-z0-9_-]+/g, '$1[REDACTED]')
    .replace(/([?&](?:key|token|access_token|api_key|apikey|secret|password|signature|sig)=)[^&#\s"']+/gi, '$1[REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, '[email redacted]');
}

export function setup(area) {
  const args = parseArgs();
  if (!args.out || args.out === true) {
    console.error(`usage: node ${area}.mjs --url URL --out OUT_DIR [--max N] [--retest]`);
    process.exit(64);
  }
  const out = path.resolve(args.out);
  const evRel = `evidence/${area}`;
  const evDir = path.join(out, evRel);
  fs.mkdirSync(path.join(out, 'results'), { recursive: true });
  fs.mkdirSync(evDir, { recursive: true });
  const inv = readJson(path.join(out, 'inventory.json'));
  const raw = typeof args.url === 'string' ? args.url : inv?.origin;
  if (!raw) { console.error('No --url given and no inventory.json in OUT.'); process.exit(64); }
  const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const origin = new URL(url).origin;
  return { args, out, url, origin, retest: !!args.retest, evDir, evRel, inventory: inv };
}

export async function launch(opts = {}) {
  const base = { headless: true, args: ['--no-sandbox', '--disable-gpu'], ...opts };
  if (process.env.CHROME_PATH) return chromium.launch({ ...base, executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch(base); } catch (e) {
    if (fs.existsSync('/usr/bin/chromium')) return chromium.launch({ ...base, executablePath: '/usr/bin/chromium' });
    throw e;
  }
}

export function authStatePath(out) { return path.join(out, '.auth', 'storage-state.json'); }

export async function newContext(browser, out, opts = {}) {
  const o = { ignoreHTTPSErrors: false, ...opts };
  const st = authStatePath(out);
  if (fs.existsSync(st)) o.storageState = st;
  return browser.newContext(o);
}

export function envString(browser, vp, origin) {
  return `chromium ${browser.version()} / ${vp.width}x${vp.height} / ${origin}`;
}

export function recorder(category, environment) {
  const records = [];
  const add = (r) => {
    if (!STATUSES.includes(r.status)) throw new Error(`bad status ${r.status} for ${r.id}`);
    const rec = {
      id: r.id,
      category: r.category || category,
      title: r.title || r.id,
      page: r.page || 'site',
      preconditions: r.preconditions || 'Storefront reachable; anonymous session',
      steps: r.steps || '',
      expected: r.expected || '',
      actual: redact(r.actual ?? ''),
      status: r.status,
      severity: r.status === 'FAIL' ? (r.severity || 'medium') : null,
      evidence: r.evidence || '',
      date: new Date().toISOString(),
      environment: r.environment || environment,
      source: 'automated',
    };
    for (const k of ['impact', 'fix', 'group', 'core']) if (r[k] !== undefined) rec[k] = r[k];
    records.push(rec);
    console.log(`  ${rec.status.padEnd(10)} ${rec.id}`);
    return rec;
  };
  return { records, add };
}

export function writeResults(out, area, records, meta = {}, retest = false) {
  const file = path.join(out, 'results', `${area}${retest ? '.retest' : ''}.json`);
  fs.writeFileSync(file, JSON.stringify({ area, generatedAt: new Date().toISOString(), meta, records }, null, 2));
  console.log(`[${area}] ${records.length} records -> ${file}`);
  return file;
}

export function writeEvidence(evDir, name, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  fs.writeFileSync(path.join(evDir, name), redact(body));
}

// Selected pages from the inventory; falls back to the homepage only.
export function loadPages(out, origin, max = 15) {
  const inv = readJson(path.join(out, 'inventory.json'));
  let pages = (inv?.pages || []).filter((p) => p.selected);
  if (!pages.length) pages = [{ url: origin + '/', type: 'home' }];
  return pages.slice(0, max).map((p) => {
    const u = new URL(p.url, origin);
    // Always test against the origin passed on the command line (preview URLs for retests).
    const url = origin + u.pathname + u.search;
    return { url, path: u.pathname, type: p.type, slug: slug(u.pathname) };
  });
}

export function isLockedUrl(u) {
  try { return /^\/password\/?$/.test(new URL(u).pathname); } catch { return false; }
}

export function isCheckoutUrl(u) {
  try {
    const x = new URL(u);
    return /\/checkouts?(\/|$)/.test(x.pathname) || /(^|\.)shop\.app$/.test(x.hostname) || x.hostname.startsWith('checkout.');
  } catch { return false; }
}

let lastNav = 0;
export async function gotoSafe(page, url, { settle = 8000 } = {}) {
  const wait = 300 - (Date.now() - lastNav);
  if (wait > 0) await sleep(wait); // politeness delay between navigations
  let response = null; let error = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: settle }).catch(() => {});
  } catch (e) { error = String(e.message || e).split('\n')[0]; }
  lastNav = Date.now();
  const finalUrl = page.url();
  return { response, status: response ? response.status() : 0, error, finalUrl, locked: isLockedUrl(finalUrl) };
}

// One rule for "the page really loaded": no navigation error, a real HTTP response (status 0 = none), not 4xx/5xx, not the password page.
export function pageLoaded(nav) {
  return !nav.error && nav.status > 0 && nav.status < 400 && !nav.locked;
}

// Human-readable reason a navigation did not load, for the "actual" field.
export function navProblem(nav) {
  if (nav.error) return nav.error;
  if (nav.locked) return 'Redirected to password page';
  if (!nav.status) return 'No HTTP response (status 0)';
  return `HTTP ${nav.status}`;
}

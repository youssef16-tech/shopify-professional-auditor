#!/usr/bin/env node
// Per-project launcher: one command, same audit on every Shopify store you build.
//
//   shopify-audit init [--local URL] [--preview URL] [--live URL] [--theme DIR] [--store X.myshopify.com]
//   shopify-audit [local|preview|live] [--url URL] [any run-all flag...]   (default target from config)
//   shopify-audit auth [target]        unlock a password-protected store once per project (owner types the password)
//   shopify-audit report [target]      rebuild the report in the latest audit folder for that target
//   shopify-audit latest [target]      print the latest audit folder
//   shopify-audit install              put a `shopify-audit` command in ~/.local/bin
//
// Config: shopify-audit.json, found by walking up from the current directory.
// Each run writes to <project>/<auditsDir>/<target>-<host>-<YYYY-MM-DD>[-N]/.
// Exit codes: those of run-all (0 ok, 1 crashed, 2 locked, 3 unreachable, 64 usage), plus 65 = no config.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = 'shopify-audit.json';
const TARGETS = ['local', 'preview', 'live'];
const LAUNCHER_FLAGS = new Set(['url', 'out', 'config']);

// ---------- helpers ----------
function die(msg, code = 64) { console.error(`shopify-audit: ${msg}`); process.exit(code); }
function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
function today() { return new Date().toISOString().slice(0, 10); }
function hostSlug(u) { return new URL(u).host.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }
function withScheme(u) { return /^[a-z]+:\/\//i.test(u) ? u : `https://${u}`; }

function splitArgs(argv) {
  const own = {}, pass = [], pos = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { pos.push(t); continue; }
    const k = t.slice(2), n = argv[i + 1];
    const hasVal = n !== undefined && !n.startsWith('--');
    if (LAUNCHER_FLAGS.has(k) || (pos[0] === 'init' && ['local', 'preview', 'live', 'theme', 'store'].includes(k))) {
      own[k] = hasVal ? n : true; if (hasVal) i++;
    } else { pass.push(t); if (hasVal) { pass.push(n); i++; } }
  }
  return { own, pass, pos };
}

function findConfig(start = process.cwd()) {
  let d = path.resolve(start);
  for (;;) {
    const f = path.join(d, CONFIG);
    if (fs.existsSync(f)) return f;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function loadConfig(explicit) {
  const f = explicit ? path.resolve(explicit) : findConfig();
  if (!f || !fs.existsSync(f)) die(`no ${CONFIG} found here or in any parent folder. Run \`shopify-audit init\` in the project root.`, 65);
  const cfg = readJson(f);
  cfg._root = path.dirname(f);
  cfg._file = f;
  cfg.targets ||= {};
  cfg.auditsDir ||= 'audits';
  cfg.options ||= {};
  return cfg;
}

function isThemeDir(d) {
  return fs.existsSync(path.join(d, 'layout', 'theme.liquid')) || fs.existsSync(path.join(d, 'config', 'settings_schema.json'));
}

function detectThemeDir(root) {
  if (isThemeDir(root)) return '.';
  for (const c of ['theme', 'shopify', 'src']) if (isThemeDir(path.join(root, c))) return c;
  const skip = new Set(['node_modules', '.git', 'audits', 'dist', 'build']);
  for (const a of fs.readdirSync(root, { withFileTypes: true })) {
    if (!a.isDirectory() || skip.has(a.name) || a.name.startsWith('.')) continue;
    const pa = path.join(root, a.name);
    if (isThemeDir(pa)) return a.name;
    for (const b of fs.readdirSync(pa, { withFileTypes: true })) {
      if (b.isDirectory() && !skip.has(b.name) && isThemeDir(path.join(pa, b.name))) return path.join(a.name, b.name);
    }
  }
  return null;
}

function auditDirs(cfg, target) {
  const base = path.join(cfg._root, cfg.auditsDir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith(`${target}-`))
    .map(e => path.join(base, e.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function newOutDir(cfg, target, url) {
  const base = path.join(cfg._root, cfg.auditsDir, `${target}-${hostSlug(url)}-${today()}`);
  let out = base, n = 2;
  while (fs.existsSync(out)) out = `${base}-${n++}`;
  return out;
}

function sessionFile(cfg, url) { return path.join(cfg._root, cfg.auditsDir, '.auth', `${hostSlug(url)}.json`); }

function copyPrivate(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o600);
}

function run(cmd, argv) {
  return new Promise(res => {
    const c = spawn(cmd, argv, { stdio: 'inherit' });
    c.on('exit', code => res(code ?? 1));
    c.on('error', () => res(1));
  });
}

async function reachable(url) {
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return { ok: true, status: r.status };
  } catch (e) { return { ok: false, error: e.cause?.code || e.message }; }
}

function resolveTarget(cfg, pos, own) {
  let target = pos.find(p => TARGETS.includes(p)) || (own.url ? 'custom' : cfg.defaultTarget || 'local');
  const url = own.url || cfg.targets[target];
  if (!url) die(`no URL for target "${target}". Add "targets.${target}" to ${cfg._file} or pass --url.`);
  return { target, url: withScheme(url) };
}

// ---------- preview theme: keep preview_theme_id across the whole crawl ----------
// Visiting ?preview_theme_id=ID sets Shopify's preview cookie; we capture it into the run's storage
// state so every collector (and every crawled page) renders the preview theme, not the live one.
async function warmPreview(url, out, existingState) {
  const id = new URL(url).searchParams.get('preview_theme_id');
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { console.warn('[preview] playwright not installed; skipping preview warm-up'); return; }
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext(existingState && fs.existsSync(existingState) ? { storageState: existingState } : {});
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    // second hop without the query: confirms the cookie alone keeps the preview theme
    const plain = new URL(url); plain.searchParams.delete('preview_theme_id');
    await page.goto(plain.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    const seen = await page.evaluate(() => window.Shopify?.theme?.id ?? null).catch(() => null);
    const dst = path.join(out, '.auth', 'storage-state.json');
    fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
    await ctx.storageState({ path: dst });
    fs.chmodSync(dst, 0o600);
    const note = { requestedThemeId: id, themeIdSeenWithoutQuery: seen, match: id && seen != null ? String(seen) === String(id) : null, at: new Date().toISOString() };
    fs.writeFileSync(path.join(out, 'preview-check.json'), JSON.stringify(note, null, 2));
    if (note.match === true) console.log(`[preview] theme ${id} sticks across pages (cookie captured)`);
    else console.warn(`[preview] WARNING: requested theme ${id}, but a page without the query reported theme ${seen}. Results may describe the LIVE theme. See preview-check.json.`);
  } finally { await browser.close(); }
}

// ---------- commands ----------
async function cmdInit(own) {
  const root = process.cwd();
  const f = path.join(root, CONFIG);
  if (fs.existsSync(f)) die(`${CONFIG} already exists in ${root}; edit it directly.`);
  const theme = own.theme && own.theme !== true ? own.theme : detectThemeDir(root);
  const store = own.store && own.store !== true ? own.store.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null;
  const targets = { local: own.local && own.local !== true ? own.local : 'http://127.0.0.1:9292' };
  if (own.preview && own.preview !== true) targets.preview = own.preview;
  else if (store) targets.preview = `https://${store}/?preview_theme_id=REPLACE_WITH_THEME_ID`;
  if (own.live && own.live !== true) targets.live = own.live;
  const cfg = {
    store, targets, defaultTarget: 'local', themeDir: theme, auditsDir: 'audits',
    options: { autoAll: 50, skipLighthouse: false },
  };
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
  const gi = path.join(root, '.gitignore');
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\/?audits\/?$/m.test(cur)) fs.writeFileSync(gi, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + '# shopify-audit output (contains session cookies)\naudits/\n');
  console.log(`wrote ${f}`);
  console.log(`  theme dir: ${theme ?? '(none found: Liquid checks will be NOT VERIFIED; set "themeDir")'}`);
  for (const [k, v] of Object.entries(targets)) console.log(`  ${k.padEnd(7)} ${v}`);
  console.log('next: `shopify theme dev` in another terminal, then `shopify-audit` (or `shopify-audit preview|live`).');
}

async function cmdAuth(cfg, pos, own) {
  const { url } = resolveTarget(cfg, pos.slice(1), own);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shopify-audit-auth-'));
  const code = await run(process.execPath, [path.join(HERE, 'auth-session.mjs'), '--url', url, '--out', tmp]);
  const st = path.join(tmp, '.auth', 'storage-state.json');
  if (code === 0 && fs.existsSync(st)) {
    copyPrivate(st, sessionFile(cfg, url));
    console.log(`session saved for ${new URL(url).host}; future runs reuse it.`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(code);
}

async function cmdReport(cfg, pos) {
  const target = pos.find(p => TARGETS.includes(p) || p === 'custom') || cfg.defaultTarget || 'local';
  const dir = auditDirs(cfg, target)[0];
  if (!dir) die(`no audit folder for target "${target}" yet.`);
  process.exit(await run(process.execPath, [path.join(HERE, 'report.mjs'), '--out', dir]));
}

async function cmdRun(cfg, pos, own, pass) {
  const { target, url } = resolveTarget(cfg, pos, own);
  if (/REPLACE_WITH_THEME_ID/.test(url)) die(`set the real preview_theme_id in ${cfg._file} (shopify theme list shows IDs).`);
  const retest = pass.includes('--retest') || pass.includes('--only');
  let out = own.out && own.out !== true ? path.resolve(own.out) : null;
  if (!out && retest) out = auditDirs(cfg, target)[0] || null;
  if (!out) out = newOutDir(cfg, target, url);

  const r = await reachable(url);
  if (!r.ok) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(new URL(url).hostname);
    console.error(`shopify-audit: ${url} is not reachable (${r.error}).`);
    if (local) console.error('  Start the theme dev server first:  shopify theme dev --path ' + (cfg.themeDir || '.'));
    process.exit(3);
  }

  fs.mkdirSync(out, { recursive: true });
  const sess = sessionFile(cfg, url);
  const runState = path.join(out, '.auth', 'storage-state.json');
  if (fs.existsSync(sess)) copyPrivate(sess, runState);
  if (new URL(url).searchParams.has('preview_theme_id')) await warmPreview(url, out, fs.existsSync(runState) ? runState : null);

  const args = [path.join(HERE, 'run-all.mjs'), '--url', url, '--out', out];
  const o = cfg.options;
  const has = f => pass.includes(f);
  if (o.autoAll && !has('--auto-all') && !has('--all')) args.push('--auto-all', String(o.autoAll));
  if (o.max && !has('--max')) args.push('--max', String(o.max));
  if (o.skipLighthouse && !has('--skip-lighthouse')) args.push('--skip-lighthouse');
  if (o.field && target === 'live' && !has('--field')) args.push('--field');
  if (cfg.themeDir && !has('--theme')) {
    const td = path.resolve(cfg._root, cfg.themeDir);
    if (fs.existsSync(td)) args.push('--theme', td);
    else console.warn(`[config] themeDir ${td} not found; Liquid checks will be NOT VERIFIED`);
  }
  args.push(...pass);
  console.log(`[shopify-audit] target=${target} url=${url}\n[shopify-audit] out=${out}`);
  fs.writeFileSync(path.join(cfg._root, cfg.auditsDir, 'LATEST'), path.relative(path.join(cfg._root, cfg.auditsDir), out) + '\n');
  process.exit(await run(process.execPath, args));
}

function cmdInstall() {
  const bin = path.join(os.homedir(), '.local', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const f = path.join(bin, 'shopify-audit');
  fs.writeFileSync(f, `#!/bin/sh\nexec node "${path.join(HERE, 'audit.mjs')}" "$@"\n`, { mode: 0o755 });
  console.log(`installed ${f}`);
  if (!(process.env.PATH || '').split(':').includes(bin)) console.log(`note: add ${bin} to your PATH`);
}

// ---------- main ----------
const { own, pass, pos } = splitArgs(process.argv.slice(2));
const cmd = pos[0];
if (cmd === 'init') await cmdInit(own);
else if (cmd === 'install') cmdInstall();
else if (cmd === 'help' || own.help || pass.includes('--help')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
} else {
  const cfg = loadConfig(own.config);
  if (cmd === 'auth') await cmdAuth(cfg, pos, own);
  else if (cmd === 'report') await cmdReport(cfg, pos);
  else if (cmd === 'latest') { const d = auditDirs(cfg, pos[1] || cfg.defaultTarget || 'local')[0]; if (!d) process.exit(1); console.log(d); }
  else if (!cmd || TARGETS.includes(cmd)) await cmdRun(cfg, pos, own, pass);
  else die(`unknown command "${cmd}". Try: init | local | preview | live | auth | report | latest | install`);
}

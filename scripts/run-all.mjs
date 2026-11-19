#!/usr/bin/env node
// Runs the collectors in order, then the report. Read-only against the storefront
// (the only state it changes is its own anonymous cart session).
// usage: node run-all.mjs --url URL --out OUT [--max N] [--all] [--auto-all N] [--only seo,a11y] [--skip-lighthouse]
//                         [--field] [--theme DIR] [--retest]
// exit: 0 ok, 1 a collector crashed, 2 storefront locked, 3 storefront unreachable, 64 usage
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, recorder, writeResults } from './lib/common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
if (!args.out || (!args.url && !fs.existsSync(path.join(String(args.out), 'inventory.json')))) {
  console.error('usage: node run-all.mjs --url URL --out OUT [--max N] [--all] [--auto-all N] [--only a,b] [--skip-lighthouse] [--field] [--theme DIR] [--retest]');
  process.exit(64);
}
const out = path.resolve(String(args.out));
fs.mkdirSync(path.join(out, 'results'), { recursive: true });
const retest = !!args.retest;
const ALIAS = { lighthouse: 'performance', perf: 'performance', accessibility: 'a11y', mobile: 'responsive', theme: 'technical', 'theme-check': 'technical' };
const only = args.only ? new Set(String(args.only).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => ALIAS[s] || s)) : null;
const want = (a) => !only || only.has(a);
// Preflight: warn only, never block. Only node, the bundled Playwright Chromium and (with --theme) the
// Shopify CLI are needed; jq, ruby and a standalone theme-check are not used by any script.
{
  const warn = (m) => console.warn(`[preflight] WARN ${m}`);
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) warn(`node ${process.versions.node} found; node >= 20 is required (scripts/package.json engines).`);
  try {
    const { chromium } = await import('playwright');
    if (!fs.existsSync(chromium.executablePath())) warn('Playwright Chromium is not installed. Run: cd scripts && npx playwright install chromium');
  } catch { warn('playwright is not installed. Run: cd scripts && npm install && npx playwright install chromium'); }
  if (args.theme && args.theme !== true && want('technical')) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('shopify', ['version'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) warn('shopify CLI not found on PATH; Theme Check will be recorded as BLOCKED. Install @shopify/cli to assess Technical Quality.');
  }
}
const CAT = { functional: 'functionality', responsive: 'mobile', a11y: 'accessibility' };

const run = (cmd, argv) => new Promise((resolve) => {
  const c = spawn(cmd, argv, { stdio: 'inherit' });
  c.on('close', (code) => resolve(code ?? 1));
  c.on('error', () => resolve(127));
});
const common = [...(args.url ? ['--url', String(args.url)] : []), '--out', out];
const flag = (k) => (args[k] === undefined ? [] : args[k] === true ? [`--${k}`] : [`--${k}`, String(args[k])]);
const note = (area, id, status, title, actual) => {
  const R = recorder(CAT[area] || area, 'run-all.mjs');
  R.add({ id, title, actual, status });
  writeResults(out, `${area}-collector`, R.records, {}, false);
};

let exit = 0;
const haveInv = fs.existsSync(path.join(out, 'inventory.json'));
let skipCollectors = false;
if (!retest && !(only && haveInv)) {
  console.log('[run-all] inventory');
  const code = await run(process.execPath, [path.join(HERE, 'inventory.mjs'), ...common, ...flag('max'), ...flag('all'), ...flag('auto-all')]);
  if (code === 2) {
    exit = 2; skipCollectors = true;
    console.error(`\n[run-all] The storefront is password protected. Nothing behind the password page was inspected.\n  Ask the store owner to unlock a session:  node ${path.join(HERE, 'auth-session.mjs')} --url URL --out ${out}\n  then run this command again.`);
  } else if (code === 3) { exit = 3; skipCollectors = true; console.error('\n[run-all] The storefront could not be reached. No collector was run.'); }
  else if (code !== 0) { exit = 1; skipCollectors = true; note('inventory', 'INVENTORY-COLLECTOR', 'BLOCKED', 'Inventory collector', `inventory.mjs exited with code ${code}; no collector was run`); }
}

const manual = path.join(out, 'results', 'manual.json');
const manualTpl = path.join(HERE, '..', 'templates', 'manual-tests.json');
if (!fs.existsSync(manual) && fs.existsSync(manualTpl)) fs.copyFileSync(manualTpl, manual);

const steps = [
  ['functional', 'functional.mjs', [...flag('max'), ...flag('external')]],
  ['responsive', 'responsive.mjs', flag('max')],
  ['seo', 'seo.mjs', flag('max')],
  ['a11y', 'a11y.mjs', flag('max')],
  ['security', 'security.mjs', []],
  ['performance', 'lighthouse.mjs', flag('field')],
];
if (!skipCollectors) {
  for (const [area, script, extra] of steps) {
    if (!want(area)) continue;
    const collectorFile = path.join(out, 'results', `${area}-collector.json`);
    if (area === 'performance' && args['skip-lighthouse']) {
      if (!fs.existsSync(path.join(out, 'results', 'performance.json'))) note(area, 'PERF-LIGHTHOUSE', 'NOT_TESTED', 'Lighthouse lab run', 'Skipped with --skip-lighthouse: performance was not measured');
      continue;
    }
    console.log(`[run-all] ${area}`);
    const code = await run(process.execPath, [path.join(HERE, script), ...common, ...extra, ...(retest ? ['--retest'] : [])]);
    if (code !== 0) { exit = exit || 1; note(area, `${area.toUpperCase()}-COLLECTOR`, 'BLOCKED', `${area} collector`, `${script} exited with code ${code}; its checks are incomplete or missing`); }
    else fs.rmSync(collectorFile, { force: true });
  }
  if (args.theme && args.theme !== true && want('technical')) {
    console.log('[run-all] theme check');
    await run('bash', [path.join(HERE, 'theme-check.sh'), String(args.theme), out, ...(retest ? ['--retest'] : [])]);
  }
}

console.log('[run-all] report');
const rc = await run(process.execPath, [path.join(HERE, 'report.mjs'), '--out', out, ...(args.url ? ['--url', String(args.url)] : [])]);
process.exit(exit || (rc ? 1 : 0));

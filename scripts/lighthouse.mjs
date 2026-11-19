#!/usr/bin/env node
// Performance collector: Lighthouse lab runs (single run each, simulated throttling).
// Lab data is NOT field data. Use --field to ask the PageSpeed Insights API for CrUX field data
// (this sends the page URL to Google). Results vary between runs: re-test before concluding.
// usage: node lighthouse.mjs --url URL --out OUT [--field] [--retest]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { setup, recorder, writeResults, loadPages, readJson, authStatePath } from './lib/common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { args, out, origin, retest, evDir, evRel } = setup('performance');
const CLI = path.join(HERE, 'node_modules', 'lighthouse', 'cli', 'index.js');
const R = recorder('performance', 'Lighthouse (not run)');

const all = loadPages(out, origin, 100);
const pick = (t) => all.find((p) => p.type === t);
const targets = [
  [pick('home') || { url: origin + '/', path: '/', slug: 'home' }, 'mobile'],
  [pick('product'), 'mobile'], [pick('collection'), 'mobile'],
  [pick('home') || { url: origin + '/', path: '/', slug: 'home' }, 'desktop'],
].filter(([p]) => p);

const chromePath = process.env.CHROME_PATH || [(() => { try { return chromium.executablePath(); } catch { return ''; } })(), '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));

// locked storefront: reuse the owner's unlocked session as a Cookie header (file stays in OUT/.auth)
let headerFile = null;
const st = readJson(authStatePath(out));
if (st?.cookies?.length) {
  const host = new URL(origin).hostname;
  const cookie = st.cookies.filter((c) => host.endsWith(c.domain.replace(/^\./, ''))).map((c) => `${c.name}=${c.value}`).join('; ');
  if (cookie) { headerFile = path.join(out, '.auth', 'lh-headers.json'); fs.writeFileSync(headerFile, JSON.stringify({ Cookie: cookie }), { mode: 0o600 }); }
}

const run = (cmd, argv, timeout) => new Promise((resolve) => {
  const c = spawn(cmd, argv, { env: { ...process.env, CHROME_PATH: chromePath || '' }, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; c.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
  const t = setTimeout(() => c.kill('SIGKILL'), timeout);
  c.on('close', (code) => { clearTimeout(t); resolve({ code, err }); });
  c.on('error', (e) => { clearTimeout(t); resolve({ code: -1, err: String(e) }); });
});

const grade = (v, good, mid) => (v <= good ? ['PASS'] : v <= mid ? ['FAIL', 'medium'] : ['FAIL', 'high']);

for (const [p, form] of targets) {
  const sfx = `${p.slug}-${form}`;
  const ids = ['SCORE', 'LCP', 'CLS', 'TBT'].map((k) => `PERF-${k}-${sfx}`);
  const blocked = (why) => ids.forEach((id) => R.add({ id, title: `Lighthouse ${form}`, page: p.path, actual: why, status: 'BLOCKED' }));
  if (!fs.existsSync(CLI)) { blocked('Lighthouse is not installed: run npm install in scripts/'); continue; }
  if (!chromePath) { blocked('No Chrome/Chromium binary found (set CHROME_PATH)'); continue; }
  const prefix = path.join(evDir, `lh-${sfx}`);
  const argv = [CLI, p.url, '--output=json', '--output=html', `--output-path=${prefix}`, '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox --disable-gpu', '--quiet'];
  if (form === 'desktop') argv.push('--preset=desktop');
  if (headerFile) argv.push(`--extra-headers=${headerFile}`);
  console.log(`[performance] lighthouse ${form} ${p.path}`);
  const res = await run(process.execPath, argv, 240000);
  const lhr = readJson(`${prefix}.report.json`);
  if (!lhr) { blocked(`Lighthouse produced no report (exit ${res.code}): ${res.err.trim().split('\n').pop() || 'no error output'}`); continue; }
  if (lhr.runtimeError?.code && lhr.runtimeError.code !== 'NO_ERROR') { blocked(`Lighthouse runtime error ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`); continue; }
  const env = `Lighthouse ${lhr.lighthouseVersion} / ${lhr.configSettings?.formFactor} / ${lhr.configSettings?.throttlingMethod} throttling / single lab run / ${os.cpus()[0]?.model || 'unknown CPU'} (benchmarkIndex ${lhr.environment?.benchmarkIndex ?? '?'}) / ${origin}`;
  const ev = `${evRel}/lh-${sfx}.report.html`;
  const num = (a) => lhr.audits?.[a]?.numericValue;
  const pct = (c) => (lhr.categories?.[c]?.score == null ? null : Math.round(lhr.categories[c].score * 100));
  const base = { page: p.path, environment: env, evidence: ev, steps: `Lighthouse ${form} run, performance category`, fix: 'See the opportunities and diagnostics in the HTML report.' };
  const score = pct('performance');
  if (score === null) { blocked('Lighthouse returned no performance score'); continue; }
  const sg = score >= 90 ? ['PASS'] : score >= 50 ? ['FAIL', 'medium'] : ['FAIL', 'high'];
  R.add({ ...base, id: ids[0], title: `Lighthouse performance score (${form}, lab)`, expected: '>= 90', status: sg[0], severity: sg[1],
    actual: `${score}/100 (lab). Other Lighthouse categories, for reference only: accessibility ${pct('accessibility')}, best practices ${pct('best-practices')}, SEO ${pct('seo')}.`, impact: 'Slow pages lose visitors and conversions.' });
  const m = [
    [ids[1], 'Largest Contentful Paint', num('largest-contentful-paint'), 2500, 4000, (v) => `${(v / 1000).toFixed(2)} s`, '<= 2.5 s'],
    [ids[2], 'Cumulative Layout Shift', num('cumulative-layout-shift'), 0.1, 0.25, (v) => v.toFixed(3), '<= 0.1'],
    [ids[3], 'Total Blocking Time', num('total-blocking-time'), 200, 600, (v) => `${Math.round(v)} ms`, '<= 200 ms'],
  ];
  for (const [id, title, v, good, mid, fmt, expected] of m) {
    if (typeof v !== 'number') { R.add({ ...base, id, title: `${title} (${form}, lab)`, expected, actual: 'Metric missing from the report', status: 'BLOCKED' }); continue; }
    const g = grade(v, good, mid);
    R.add({ ...base, id, title: `${title} (${form}, lab)`, expected, actual: `${fmt(v)} (lab, simulated throttling)`, status: g[0], severity: g[1], impact: 'Core Web Vitals lab proxy outside the "good" range.' });
  }
}
if (headerFile) fs.rmSync(headerFile, { force: true });

// --- field data (CrUX via PageSpeed Insights) only on request
const F = [['PERF-FIELD-LCP', 'LARGEST_CONTENTFUL_PAINT_MS', 'LCP p75', (v) => `${(v / 1000).toFixed(2)} s`], ['PERF-FIELD-CLS', 'CUMULATIVE_LAYOUT_SHIFT_SCORE', 'CLS p75', (v) => (v / 100).toFixed(2)], ['PERF-INP-FIELD', 'INTERACTION_TO_NEXT_PAINT', 'INP p75', (v) => `${v} ms`]];
const fenv = 'Chrome UX Report via PageSpeed Insights API v5 / mobile / 28-day field data';
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(new URL(origin).hostname);
if (!args.field) {
  R.add({ id: 'PERF-INP-FIELD', title: 'Interaction to Next Paint (field)', page: '/', environment: fenv, steps: 'Re-run with --field', expected: 'INP p75 <= 200 ms', actual: 'Field data not requested. INP cannot be measured in a lab run.', status: 'NOT_TESTED' });
} else if (isLocal) {
  for (const [id, , t] of F) R.add({ id, title: `${t} (field)`, page: '/', environment: fenv, actual: 'Local host has no field data', status: 'N/A' });
} else {
  let le = null; let err = '';
  try {
    const q = new URLSearchParams({ url: origin + '/', strategy: 'mobile', category: 'performance' });
    if (process.env.PSI_API_KEY) q.set('key', process.env.PSI_API_KEY);
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) err = `PSI API HTTP ${r.status}`; else le = (await r.json()).loadingExperience || {};
  } catch (e) { err = String(e.message || e); }
  for (const [id, key, t, fmt] of F) {
    const mm = le?.metrics?.[key];
    if (err) R.add({ id, title: `${t} (field)`, page: '/', environment: fenv, actual: err, status: 'BLOCKED' });
    else if (!mm) R.add({ id, title: `${t} (field)`, page: '/', environment: fenv, actual: 'No CrUX field data for this URL (not enough real-user traffic)', status: 'N/A' });
    else R.add({ id, title: `${t} (field)`, page: '/', environment: fenv, steps: 'PageSpeed Insights loadingExperience', expected: 'Category FAST ("good")', actual: `${fmt(mm.percentile)} = ${mm.category}${le.origin_fallback ? ' (origin-level data)' : ''}`,
      status: mm.category === 'FAST' ? 'PASS' : 'FAIL', severity: mm.category === 'SLOW' ? 'high' : 'medium', impact: 'Real users experience this metric outside the "good" range.', fix: 'Use the lab reports to find the cause, then re-check field data after 28 days.' });
  }
}

writeResults(out, 'performance', R.records, { targets: targets.map(([p, f]) => `${p.path} (${f})`), chromePath }, retest);

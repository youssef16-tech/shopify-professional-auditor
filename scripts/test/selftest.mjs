#!/usr/bin/env node
// Selftest: runs the whole toolchain against the local fixture store and checks that the planted
// defects are found, the clean pages pass, secrets are redacted, and fix/retest reporting works.
// usage: node test/selftest.mjs [--out DIR] [--skip-lighthouse]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, FAKE_TOKEN, UNLOCK_DIGEST } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = path.join(HERE, '..');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const out = path.resolve(oi >= 0 ? argv[oi + 1] : process.env.SELFTEST_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'shopify-audit-selftest-')));
const skipLh = argv.includes('--skip-lighthouse');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const run = (script, args) => new Promise((resolve) => {
  const c = spawn(process.execPath, [path.join(S, script), ...args], { stdio: 'inherit' });
  c.on('close', (code) => resolve(code ?? 1)); c.on('error', () => resolve(127));
});
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : ` -> ${detail}`}`); };
const loadRecords = (dir) => {
  const m = new Map();
  for (const f of fs.readdirSync(path.join(dir, 'results')).filter((x) => x.endsWith('.json') && !x.endsWith('.retest.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'results', f), 'utf8'));
    for (const r of j.records || []) m.set(r.id, r);
  }
  return m;
};

const fx = await start();
console.log(`[selftest] fixture ${fx.url}  out ${out}`);
const code = await run('run-all.mjs', ['--url', fx.url, '--out', out, '--max', '10', ...(skipLh ? ['--skip-lighthouse'] : [])]);
check('run-all exits 0 (no collector crashed)', code === 0, `exit ${code}`);

const recs = loadRecords(out);
const expect = (id, ...allowed) => { const r = recs.get(id); check(`${id} is ${allowed.join(' or ')}`, r && allowed.includes(r.status), r ? `${r.status}: ${String(r.actual).slice(0, 160)}` : 'record missing'); };
expect('ACCESS-STOREFRONT', 'PASS');
expect('FN-LOAD-home', 'PASS');
expect('FN-LOAD-pages-broken', 'FAIL');
expect('FN-CONSOLE-products-bad-mug', 'FAIL');
expect('FN-CONSOLE-products-good-tee', 'PASS');
expect('FN-LINKS', 'FAIL');
expect('FN-SEARCH', 'PASS');
expect('FN-NAV-MOBILE', 'PASS');
expect('EC-COLLECTION', 'PASS');
expect('EC-ATC', 'PASS');
expect('EC-CART', 'PASS');
expect('EC-CHECKOUT-REACH', 'PASS');
expect('EC-VARIANT', 'PASS');
expect('EC-PRICE-UPDATE', 'PASS');
expect('EC-QTY', 'PASS');
expect('EC-CART-TOTAL', 'PASS');
expect('EC-CART-UPDATE', 'PASS');
expect('EC-CART-REMOVE', 'PASS');
expect('RSP-OVERFLOW-products-bad-mug-320', 'FAIL');
expect('RSP-OVERFLOW-home-320', 'PASS');
expect('RSP-OVERFLOW-products-bad-mug-1366', 'PASS');
expect('SEO-DESC-products-bad-mug', 'FAIL');
expect('SEO-H1-products-bad-mug', 'FAIL');
expect('SEO-ALT-products-bad-mug', 'FAIL');
expect('SEO-PRODUCT-SCHEMA-products-bad-mug', 'FAIL');
expect('SEO-PRODUCT-SCHEMA-products-good-tee', 'PASS');
expect('SEO-TITLE-home', 'PASS');
expect('A11Y-AXE-color-contrast-products-bad-mug', 'FAIL');
expect('A11Y-AXE-image-alt-products-bad-mug', 'FAIL');
expect('A11Y-AXE-products-good-tee', 'PASS');
expect('A11Y-AXE-home', 'PASS');
expect('A11Y-SKIPLINK-home', 'PASS');
expect('SEC-SECRETS-products-bad-mug', 'FAIL');
expect('SEC-SECRETS-home', 'PASS');
expect('SEC-PRIVACY-LINK', 'PASS');
expect('EC-M09', 'NOT_TESTED');
expect('A11Y-M01', 'NOT_TESTED');
if (skipLh) expect('PERF-LIGHTHOUSE', 'NOT_TESTED'); else expect('PERF-SCORE-home-mobile', 'PASS', 'FAIL');

const score = JSON.parse(fs.readFileSync(path.join(out, 'score.json'), 'utf8'));
check('verdict is NOT READY FOR PRODUCTION (planted critical secret)', score.verdict === 'NOT READY FOR PRODUCTION', score.verdict);
check('total score is a number between 0 and 59', typeof score.total === 'number' && score.total >= 0 && score.total <= 59, String(score.total));
for (const f of ['audit-report.md', 'scorecard.md', 'defect-register.csv', 'test-case-log.csv', 'page-inventory.csv', 'discovery.md']) check(`${f} exists and is not empty`, fs.existsSync(path.join(out, f)) && fs.statSync(path.join(out, f)).size > 50);
const report = fs.readFileSync(path.join(out, 'audit-report.md'), 'utf8');
check('audit-report.md has no unreplaced {{TOKEN}}', !/\{\{[A-Z_]+\}\}/.test(report), (report.match(/\{\{[A-Z_]+\}\}/g) || []).join(' '));
check('audit-report.md has all 21 sections', (report.match(/^## \d+\. /gm) || []).length === 21, String((report.match(/^## \d+\. /gm) || []).length));
const tcl = fs.readFileSync(path.join(out, 'test-case-log.csv'), 'utf8');
check('test-case-log.csv uses human status labels (NOT TESTED / NOT APPLICABLE)', tcl.includes('NOT TESTED') && tcl.includes('NOT APPLICABLE') && !/,NOT_TESTED,|,N\/A,/.test(tcl), 'raw status keys present or labels missing');
check('every area section says what is needed to improve', (report.match(/What is needed to improve/g) || []).length >= 9, String((report.match(/What is needed to improve/g) || []).length));
{
  const inv = fs.readFileSync(path.join(out, 'page-inventory.csv'), 'utf8').trim().split('\n');
  const split = (l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
  const ci = split(inv[0]).findIndex((h) => /coverage/i.test(h));
  const bad = ci < 0 ? ['no Coverage column'] : inv.slice(1).map((l) => split(l)[ci]).filter((v) => !['Discovered', 'Inspected', 'Untested'].includes(v));
  check('page-inventory.csv Coverage is Discovered / Inspected / Untested', !bad.length, bad.slice(0, 5).join(' | '));
}
check('screenshots were captured', fs.existsSync(path.join(out, 'evidence', 'responsive')) && fs.readdirSync(path.join(out, 'evidence', 'responsive')).some((f) => f.endsWith('.png')));

// the fake token must never be written to any text output
const leaks = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(json|md|csv|html|txt)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes(FAKE_TOKEN)) leaks.push(path.relative(out, p)); } };
walk(out);
check('fake access token is redacted in every text output', !leaks.length, leaks.join(', '));

// locked storefront -> inventory exit 2
const lockedFx = await start({ locked: true });
const out2 = `${out}-locked`;
fs.rmSync(out2, { recursive: true, force: true });
const c2 = await run('inventory.mjs', ['--url', lockedFx.url, '--out', out2]);
check('locked storefront: inventory exits 2', c2 === 2, `exit ${c2}`);

// saved owner session (the file auth-session.mjs writes) unlocks the same locked storefront
const out2b = `${out}-unlocked`;
fs.rmSync(out2b, { recursive: true, force: true });
fs.mkdirSync(path.join(out2b, '.auth'), { recursive: true });
fs.writeFileSync(path.join(out2b, '.auth', 'storage-state.json'), JSON.stringify({ cookies: [{ name: 'storefront_digest', value: UNLOCK_DIGEST, domain: new URL(lockedFx.url).hostname, path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] }), { mode: 0o600 });
const c2b = await run('inventory.mjs', ['--url', lockedFx.url, '--out', out2b, '--max', '5']);
await lockedFx.close();
check('locked storefront + saved session: inventory exits 0', c2b === 0, `exit ${c2b}`);
{
  const acc = fs.existsSync(path.join(out2b, 'results')) ? loadRecords(out2b).get('ACCESS-STOREFRONT') : null;
  check('locked storefront + saved session: ACCESS-STOREFRONT is PASS', acc?.status === 'PASS', acc ? `${acc.status}: ${String(acc.actual).slice(0, 160)}` : 'record missing');
}

// Theme Check wrapper: clean, offense, missing theme dir, missing CLI (shim `shopify` binaries)
{
  const tcRoot = `${out}-themecheck`;
  fs.rmSync(tcRoot, { recursive: true, force: true });
  const theme = path.join(tcRoot, 'theme');
  fs.mkdirSync(path.join(theme, 'layout'), { recursive: true });
  fs.writeFileSync(path.join(theme, 'layout', 'theme.liquid'), '<html>{{ content_for_layout }}</html>');
  const bin = (name, json) => {
    const d = path.join(tcRoot, `bin-${name}`);
    fs.mkdirSync(d, { recursive: true });
    if (json !== undefined) fs.writeFileSync(path.join(d, 'shopify'), `#!/bin/sh\ncat <<'EOF'\n${JSON.stringify(json)}\nEOF\n`, { mode: 0o755 });
    for (const t of ['bash', 'sh', 'mkdir', 'dirname', 'cat']) { try { fs.symlinkSync(fs.realpathSync(`/usr/bin/${t}`), path.join(d, t)); } catch { /* tool absent */ } }
    fs.symlinkSync(process.execPath, path.join(d, 'node'));
    return d;
  };
  const runTc = (themeDir, binDir, o) => new Promise((resolve) => {
    const c = spawn('/bin/bash', [path.join(S, 'theme-check.sh'), themeDir, o], { stdio: 'inherit', env: { ...process.env, PATH: binDir } });
    c.on('close', (code) => resolve(code ?? 1)); c.on('error', () => resolve(127));
  });
  const tcRec = (o, id) => { try { return (JSON.parse(fs.readFileSync(path.join(o, 'results', 'technical.json'), 'utf8')).records || []).find((r) => r.id === id); } catch { return null; } };
  const cases = [
    ['clean theme', theme, bin('clean', [{ path: 'layout/theme.liquid', offenses: [] }]), 'TECH-TC-CLEAN', 'PASS'],
    ['theme with an offense', theme, bin('offense', [{ path: 'layout/theme.liquid', offenses: [{ check: 'UnusedAssign', severity: 1, message: 'x is never used', start_row: 1, start_column: 0 }] }]), 'TECH-TC-UnusedAssign', 'FAIL'],
    ['missing theme dir', path.join(tcRoot, 'no-such-theme'), bin('clean2', []), 'TECH-TC', 'BLOCKED'],
    ['Shopify CLI not installed', theme, bin('nocli'), 'TECH-TC', 'BLOCKED'],
  ];
  for (const [label, dir, b, id, status] of cases) {
    const o = path.join(tcRoot, `out-${label.replace(/\W+/g, '-')}`);
    await runTc(dir, b, o);
    const r = tcRec(o, id);
    check(`theme-check (${label}): ${id} is ${status}`, r?.status === status, r ? `${r.status}: ${String(r.actual).slice(0, 160)}` : 'record missing');
  }
}

// fix + retest: the missing meta description is "fixed", the SEO collector is re-run
fx.setFixed(true);
const c3 = await run('seo.mjs', ['--url', fx.url, '--out', out, '--retest']);
check('seo retest exits 0', c3 === 0, `exit ${c3}`);
const c4 = await run('report.mjs', ['--out', out, '--url', fx.url]);
check('report after retest exits 0', c4 === 0, `exit ${c4}`);
const reg = fs.readFileSync(path.join(out, 'defect-register.csv'), 'utf8').split('\n');
const row = reg.find((l) => l.includes('SEO-DESC-products-bad-mug')) || '';
check('retest: SEO-DESC-products-bad-mug is "Fixed – verified by retest"', row.includes('Fixed – verified by retest'), row.slice(0, 200) || 'row missing');
const row2 = reg.find((l) => l.includes('SEO-H1-products-bad-mug')) || '';
check('retest: unfixed SEO-H1-products-bad-mug stays "Open (retest failed)"', row2.includes('Open (retest failed)'), row2.slice(0, 200) || 'row missing');
const report2 = fs.readFileSync(path.join(out, 'audit-report.md'), 'utf8');
const ai = report2.indexOf('Attempted, not verified by retest');
check('report lists the attempted-but-unverified fix (SEO-H1) under its own heading', ai >= 0 && report2.indexOf('SEO-H1-products-bad-mug', ai) > ai, ai < 0 ? 'heading missing' : 'SEO-H1 not listed after heading');

// real-store lessons (starworldd.com, 2026-11-19)
const inv = JSON.parse(fs.readFileSync(path.join(out, 'inventory.json'), 'utf8'));
const md = (inv.pages || []).find((p) => p.path === '/agents.md');
check('inventory: /agents.md is classed as a file and not inspected as a page', md && md.type === 'file' && !md.selected, md ? `${md.type} selected=${md.selected}` : 'not discovered');
const fn = JSON.parse(fs.readFileSync(path.join(out, 'results', 'functional.json'), 'utf8'));
const fc = (Array.isArray(fn) ? fn : fn.records).find((r) => r.id === 'FN-CONSOLE-products-good-tee');
check('functional: Shopify telemetry errors are ignored, not failed', fc?.status === 'PASS' && /telemetry/.test(fc.actual), fc ? `${fc.status}: ${fc.actual}` : 'record missing');
const regHead = fs.readFileSync(path.join(out, 'defect-register.csv'), 'utf8').split('\n')[0];
check('defect register has a Root cause column', regHead.includes('Root cause'), regHead.slice(0, 200));
{
  const dead = out + '-unreachable'; fs.rmSync(dead, { recursive: true, force: true }); fs.mkdirSync(path.join(dead, 'results'), { recursive: true });
  fs.writeFileSync(path.join(dead, 'results', 'access.json'), JSON.stringify([{ id: 'ACCESS-STOREFRONT', category: 'functionality', title: 'Storefront reachable', status: 'BLOCKED', actual: 'connection refused' }]));
  await run('report.mjs', ['--out', dead, '--url', 'https://unreachable.invalid']);
  const sd = JSON.parse(fs.readFileSync(path.join(dead, 'score.json'), 'utf8'));
  check('report gives NO VERDICT when nothing could be tested', String(sd.verdict).startsWith('NO VERDICT'), sd.verdict);
}

// independent review: missing -> flagged NOT DONE; present -> can downgrade, never upgrade
check('report says the independent review is NOT DONE when there is none', report2.includes('Independent review: NOT DONE'), 'notice missing');
fs.writeFileSync(path.join(out, 'independent-review.json'), JSON.stringify({ reviewer: 'selftest reviewer', date: '2026-01-01', verdict: 'PRODUCTION READY', reason: 'tries to upgrade', disputed: [] }));
await run('report.mjs', ['--out', out, '--url', fx.url]);
const s5 = JSON.parse(fs.readFileSync(path.join(out, 'score.json'), 'utf8'));
check('independent review cannot upgrade the verdict', s5.verdict === s5.computedVerdict && s5.verdict !== 'PRODUCTION READY', `${s5.verdict} (computed ${s5.computedVerdict})`);
fs.writeFileSync(path.join(out, 'independent-review.json'), JSON.stringify({ reviewer: 'selftest reviewer', date: '2026-01-01', verdict: 'NOT READY FOR PRODUCTION', reason: 'reviewer found an unreported blocker', disputed: [{ id: 'EC-ATC', why: 'test' }] }));
await run('report.mjs', ['--out', out, '--url', fx.url]);
const s6 = JSON.parse(fs.readFileSync(path.join(out, 'score.json'), 'utf8'));
const report3 = fs.readFileSync(path.join(out, 'audit-report.md'), 'utf8');
check('independent review can downgrade the verdict and the report names the reviewer', s6.verdict === 'NOT READY FOR PRODUCTION' && report3.includes('Independent review by selftest reviewer'), `${s6.verdict}`);
fs.rmSync(path.join(out, 'independent-review.json'));
await run('report.mjs', ['--out', out, '--url', fx.url]); // leave the output as it was before the review test

await fx.close();
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(out, 'selftest-result.json'), JSON.stringify({ date: new Date().toISOString(), passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
console.log(`\n[selftest] ${checks.length - failed.length}/${checks.length} checks passed. Output: ${out}`);
process.exit(failed.length ? 1 : 0);

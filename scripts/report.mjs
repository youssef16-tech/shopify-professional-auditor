#!/usr/bin/env node
// Merges collector results, manual results and retests; applies the scoring and verdict rules
// (references/05-scoring-and-verdict.md); writes the CSV registers, scorecard and final report.
// It never invents results: a check that is not PASS or FAIL earns no points.
// usage: node report.mjs --out OUT [--url URL]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, readJson, redact, CATEGORIES } from './lib/common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
if (!args.out) { console.error('usage: node report.mjs --out OUT'); process.exit(64); }
const out = path.resolve(String(args.out));
const resDir = path.join(out, 'results');
const red = (s) => redact(String(s ?? ''));
const STATUS = ['PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED', 'N/A'];
const SEV = ['critical', 'high', 'medium', 'low'];
const FAILW = { critical: 8, high: 4, medium: 2, low: 1 };
const FIXED = 'Fixed – verified by retest';
// human-readable status labels for reports/CSVs (raw keys stay in JSON)
const LABEL = { NOT_TESTED: 'NOT TESTED', 'N/A': 'NOT APPLICABLE' };
const lbl = (s) => LABEL[s] || s;

// ---------- load and merge
const files = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter((f) => f.endsWith('.json')).sort() : [];
const load = (f) => {
  const j = readJson(path.join(resDir, f));
  const recs = Array.isArray(j) ? j : j?.records;
  return (Array.isArray(recs) ? recs : []).filter((r) => {
    const ok = r && r.id && STATUS.includes(r.status);
    if (r && !ok) console.warn(`[report] ${f}: skipped a record without a valid id/status (${r.id || 'no id'}: ${r.status})`);
    return ok;
  }).map((r) => ({ ...r, date: r.date || j?.generatedAt || '' }));
};
const map = new Map();
for (const f of files) {
  if (f === 'manual.json' || f.endsWith('.retest.json')) continue;
  for (const r of load(f)) map.set(r.id, r);
}
for (const m of files.includes('manual.json') ? load('manual.json') : []) {
  const a = map.get(m.id);
  if (a && m.status === 'NOT_TESTED') continue; // an untouched manual row never hides an automated result
  map.set(m.id, { ...(a || {}), ...m, source: 'manual' });
}
const retestFiles = files.filter((f) => f.endsWith('.retest.json'));
for (const f of retestFiles) {
  const rr = load(f);
  const ids = new Set(rr.map((r) => r.id));
  const groupsRun = new Set(rr.filter((r) => r.status === 'PASS' || r.status === 'FAIL').map((r) => r.group).filter(Boolean));
  const groupsFail = new Set(rr.filter((r) => r.status === 'FAIL').map((r) => r.group).filter(Boolean));
  for (const r of rr) {
    const o = map.get(r.id);
    if (!o) { map.set(r.id, r.status === 'FAIL' ? { ...r, originalStatus: 'not reported', fixStatus: 'REGRESSION (new failure in retest)' } : r); continue; }
    if (r.status === 'BLOCKED' || r.status === 'NOT_TESTED') { if (o.status === 'FAIL') o.fixStatus = `Open (fix unverified: retest was ${r.status})`; continue; }
    if (r.status === 'N/A') continue;
    const base = { ...o, ...r, originalStatus: o.originalStatus || o.status, originalSeverity: o.originalSeverity || o.severity };
    if (o.status === 'FAIL' && r.status === 'PASS') map.set(r.id, { ...base, severity: o.severity, impact: o.impact, fix: o.fix, fixStatus: FIXED });
    else if (o.status === 'FAIL') map.set(r.id, { ...base, fixStatus: 'Open (retest failed)' });
    else if (r.status === 'FAIL') map.set(r.id, { ...base, fixStatus: o.status === 'PASS' ? 'REGRESSION' : 'Open (first tested in retest)' });
    else map.set(r.id, { ...base, fixStatus: o.fixStatus });
  }
  for (const [id, o] of [...map]) {
    if (ids.has(id) || !o.group) continue;
    if (o.status === 'FAIL' && groupsRun.has(o.group)) {
      map.set(id, { ...o, status: 'PASS', originalStatus: 'FAIL', originalSeverity: o.severity, fixStatus: FIXED, actual: `No longer reported when check group ${o.group} was re-run. Before the fix: ${o.actual}` });
    } else if (o.status === 'PASS' && groupsFail.has(o.group) && !o.fixStatus) map.delete(id); // stale "clean" marker
  }
}
const records = [...map.values()].map((r) => ({ ...r, category: r.category || 'functionality', page: r.page || 'site' }));

// ---------- root causes. The same finding on many pages (a header link, a theme-wide gallery) is one thing to fix:
// it is scored once, at its highest severity, and the register shows how many pages it affects.
const pageSlug = (pg) => { const p = String(pg || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, ''); return p ? p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) : 'home'; };
const rootKey = (r) => {
  let base = r.id;
  if (r.page && r.page !== 'site') { const sl = '-' + pageSlug(r.page); const i = base.lastIndexOf(sl); if (i > 0) base = base.slice(0, i) + base.slice(i + sl.length); }
  return `${r.category}|${base}|${String(r.actual || '').split(r.page).join('<page>')}`;
};
const roots = new Map(); // key -> { id, records }
for (const r of records.filter((x) => x.status === 'FAIL')) {
  const k = rootKey(r);
  if (!roots.has(k)) roots.set(k, { id: `RC-${String(roots.size + 1).padStart(3, '0')}`, records: [] });
  roots.get(k).records.push(r); r.rootCause = roots.get(k).id;
}
for (const g of roots.values()) for (const r of g.records) r.rootCauseLabel = g.records.length > 1 ? `${g.id} (same finding on ${g.records.length} pages)` : g.id;

// ---------- scoring
const r1 = (n) => Math.round(n * 10) / 10;
const pct = (n) => `${Math.round(n * 100)}%`;
const open = records.filter((r) => r.status === 'FAIL');
const cats = {};
let sumAll = 0; let sumTested = 0;
for (const [key, c] of Object.entries(CATEGORIES)) {
  const rs = records.filter((r) => r.category === key && r.status !== 'N/A');
  const fails = rs.filter((r) => r.status === 'FAIL');
  const pass = rs.filter((r) => r.status === 'PASS').length;
  const tested = pass + fails.length;
  const coverage = rs.length ? tested / rs.length : 0;
  const groupW = new Map(); // one weight per root cause, the highest severity in the group
  for (const r of fails) groupW.set(r.rootCause || r.id, Math.max(groupW.get(r.rootCause || r.id) || 0, FAILW[r.severity] || 2));
  const quality = tested ? pass / (pass + [...groupW.values()].reduce((a, w) => a + w, 0)) : 0;
  let score = c.weight * coverage * quality;
  const critical = fails.some((r) => r.severity === 'critical');
  const capped = critical && score > c.weight * 0.4;
  if (capped) score = c.weight * 0.4;
  sumAll += rs.length; sumTested += tested;
  cats[key] = { name: c.name, weight: c.weight, score: r1(score), coverage, quality, total: rs.length, pass, fail: fails.length, untested: rs.length - tested, assessed: tested > 0, capped,
    openDefects: fails.map((r) => r.id) };
}
let total = r1(Object.values(cats).reduce((a, c) => a + c.score, 0));
const critIn = (k) => open.some((r) => r.category === k && r.severity === 'critical');
const totalCapped = (critIn('ecommerce') || critIn('security')) && total > 59;
if (totalCapped) total = 59;
const coverage = sumAll ? sumTested / sumAll : 0;
const ra = readJson(path.join(out, 'risk-acceptance.json'));
const raValid = !!(ra && ra.acceptedBy && ra.reason && (Array.isArray(ra.acceptedIds) || Array.isArray(ra.acceptedUnassessed)));
const accepted = new Set(raValid && Array.isArray(ra.acceptedIds) ? ra.acceptedIds : []);
// Owner-accepted unassessed categories (by key or name, e.g. "technical"): they still score 0, but no longer block High confidence.
const acceptedCats = new Set(raValid && Array.isArray(ra.acceptedUnassessed) ? ra.acceptedUnassessed.map((x) => String(x).toLowerCase()) : []);
const unassessedAll = Object.entries(cats).filter(([, c]) => !c.assessed);
const isAcceptedCat = ([k, c]) => acceptedCats.has(k.toLowerCase()) || acceptedCats.has(c.name.toLowerCase());
const unassessed = unassessedAll.filter((e) => !isAcceptedCat(e)).map(([, c]) => c.name);
const unassessedAccepted = unassessedAll.filter(isAcceptedCat).map(([, c]) => c.name);
const confidence = coverage >= 0.85 && !unassessed.length ? 'High' : coverage >= 0.6 ? 'Medium' : 'Low';
const openCrit = open.filter((r) => r.severity === 'critical');
const openHigh = open.filter((r) => r.severity === 'high');
const highJourney = openHigh.filter((r) => ['functionality', 'ecommerce', 'security'].includes(r.category));
const coreOpen = records.filter((r) => r.core && r.status !== 'PASS' && r.status !== 'N/A' && !accepted.has(r.id));
const idList = (rs, n = 8) => rs.slice(0, n).map((r) => r.id).join(', ') + (rs.length > n ? `, +${rs.length - n} more` : '');
const rules = [];
if (openCrit.length) rules.push(`NOT READY: ${openCrit.length} open critical defect(s): ${idList(openCrit)}`);
if (total < 70) rules.push(`NOT READY: total score ${total} is below 70`);
if (highJourney.length) rules.push(`NOT READY: ${highJourney.length} open high-severity defect(s) in functionality, e-commerce or security: ${idList(highJourney)}`);
let verdict = 'NOT READY FOR PRODUCTION';
if (!rules.length) {
  if (openHigh.length) rules.push(`Not PRODUCTION READY: ${openHigh.length} open high-severity defect(s): ${idList(openHigh)}`);
  if (total < 85) rules.push(`Not PRODUCTION READY: total score ${total} is below 85`);
  if (confidence !== 'High') rules.push(`Not PRODUCTION READY: confidence is ${confidence} (coverage ${pct(coverage)}${unassessed.length ? `; not assessed: ${unassessed.join(', ')}` : ''})`);
  if (coreOpen.length) rules.push(`Not PRODUCTION READY: ${coreOpen.length} core check(s) not verified and not risk-accepted: ${idList(coreOpen)}`);
  verdict = rules.length ? 'READY WITH NON-CRITICAL ISSUES' : 'PRODUCTION READY';
  if (!rules.length) rules.push('All PRODUCTION READY conditions met: no open critical/high defects, total >= 85, confidence High, every core check PASS or risk-accepted.');
}
if (totalCapped) rules.push('Total capped at 59: open critical defect in e-commerce or security.');
if (unassessedAccepted.length) rules.push(`Not assessed, risk accepted by ${ra.acceptedBy}: ${unassessedAccepted.join(', ')} (scores 0; does not block High confidence). Reason: ${ra.reason}`);
if (ra && !raValid) rules.push('risk-acceptance.json ignored: it needs acceptedBy, reason, and acceptedIds and/or acceptedUnassessed.');

if (sumTested === 0) {
  verdict = 'NO VERDICT (NOTHING COULD BE TESTED)';
  rules.unshift('No check produced a PASS or FAIL (store unreachable, locked or every collector blocked). The score says nothing about the store; fix access and run the audit again.');
}

// ---------- independent review (references/05 §Independent final audit). It can only lower the verdict, never raise it.
const VERDICTS = ['NOT READY FOR PRODUCTION', 'READY WITH NON-CRITICAL ISSUES', 'PRODUCTION READY'];
const computedVerdict = verdict;
const ir = readJson(path.join(out, 'independent-review.json'));
const irValid = !!(ir && ir.reviewer && ir.reason && VERDICTS.includes(ir.verdict));
if (irValid && VERDICTS.indexOf(ir.verdict) < VERDICTS.indexOf(verdict)) {
  verdict = ir.verdict;
  rules.push(`Downgraded by independent review (${ir.reviewer}): ${ir.reason}`);
}
if (ir && !irValid) rules.push('independent-review.json ignored: it needs reviewer, reason and verdict (one of the three verdicts).');

// ---------- defects
const sevRank = (r) => { const i = SEV.indexOf(r.severity || r.originalSeverity); return i < 0 ? 2 : i; };
const catOrder = Object.keys(CATEGORIES);
const defects = records.filter((r) => r.status === 'FAIL' || r.fixStatus)
  .sort((a, b) => sevRank(a) - sevRank(b) || catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || a.id.localeCompare(b.id));
defects.forEach((r, i) => { r.defectId = `D-${String(i + 1).padStart(3, '0')}`; r.fixStatus = r.fixStatus || 'Open'; });
const sevOf = (r) => r.severity || r.originalSeverity || 'medium';

// ---------- writers
const csvCell = (v) => { const s = red(v).replace(/\r?\n/g, ' '); return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (name, head, rows) => fs.writeFileSync(path.join(out, name), [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
const cell = (v) => red(v).replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ');
const table = (head, rows) => (rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n') : '_None._');
const catName = (k) => CATEGORIES[k]?.name || (k === 'cro' ? 'CRO (unscored)' : k);

writeCsv('test-case-log.csv',
  ['Test ID', 'Category', 'Page/Component', 'Title', 'Preconditions', 'Steps', 'Expected', 'Actual', 'Status', 'Severity', 'Evidence', 'Date', 'Environment', 'Source', 'Original status', 'Fix status'],
  records.slice().sort((a, b) => a.id.localeCompare(b.id)).map((r) => [r.id, catName(r.category), r.page, r.title, r.preconditions, r.steps, r.expected, r.actual, lbl(r.status), r.status === 'FAIL' ? sevOf(r) : '', r.evidence, r.date, r.environment, r.source || 'automated', lbl(r.originalStatus), r.fixStatus]));
writeCsv('defect-register.csv',
  ['Defect ID', 'Test ID', 'Severity', 'Category', 'Location', 'Description', 'Expected', 'Actual', 'Evidence', 'Business/user impact', 'Recommended fix', 'Fix status', 'Current status', 'Root cause'],
  defects.map((r) => [r.defectId, r.id, sevOf(r), catName(r.category), r.page, r.title, r.expected, r.actual, r.evidence, r.impact, r.fix, r.fixStatus, lbl(r.status), r.rootCauseLabel || '']));

const inv = readJson(path.join(out, 'inventory.json'));
const pages = Array.isArray(inv?.pages) ? inv.pages : [];
const testedOn = (p) => records.filter((r) => r.page === p && (r.status === 'PASS' || r.status === 'FAIL'));
const pageState = (p) => (testedOn(p.path).length ? 'Inspected' : p.selected ? 'Untested' : 'Discovered');
writeCsv('page-inventory.csv', ['URL', 'Path', 'Type', 'Source', 'Selected for sample', 'Coverage', 'Checks with a result', 'Failed checks'],
  pages.map((p) => [p.url, p.path, p.type, p.source, p.selected ? 'yes' : 'no', pageState(p), testedOn(p.path).length, testedOn(p.path).filter((r) => r.status === 'FAIL').length]));

const score = {
  generatedAt: new Date().toISOString(), verdict, computedVerdict, independentReview: irValid ? { reviewer: ir.reviewer, date: ir.date || null, verdict: ir.verdict, reason: ir.reason, disputed: ir.disputed || [] } : null, total, max: 100, confidence, coverage: r1(coverage * 100), triggeredRules: rules,
  categories: Object.fromEntries(Object.entries(cats).map(([k, c]) => [k, { ...c, coverage: r1(c.coverage * 100), quality: r1(c.quality * 100) }])),
  counts: Object.fromEntries(STATUS.map((s) => [s, records.filter((r) => r.status === s).length])),
  openDefects: Object.fromEntries(SEV.map((s) => [s, open.filter((r) => sevOf(r) === s).length])),
  riskAcceptance: raValid ? { acceptedBy: ra.acceptedBy, reason: ra.reason, acceptedIds: ra.acceptedIds } : null,
};
fs.writeFileSync(path.join(out, 'score.json'), red(JSON.stringify(score, null, 2)) + '\n');

const scoreTable = table(['Category', 'Score', 'Weight', 'Coverage', 'Pass', 'Fail', 'Untested', 'Note'],
  Object.values(cats).map((c) => [c.name, c.assessed ? c.score : '0 (not assessed)', c.weight, pct(c.coverage), c.pass, c.fail, c.untested, c.capped ? 'Capped at 40% of weight: open critical defect' : '']));
const verdictBlock = [`**Verdict: ${verdict}**`, '', `- Total score: **${total} / 100**`, `- Confidence: **${confidence}** (overall coverage ${pct(coverage)}; ${sumTested} of ${sumAll} applicable checks have a PASS or FAIL result)`,
  `- Open defects: ${SEV.map((s) => `${score.openDefects[s]} ${s}`).join(', ')} (${roots.size} distinct root cause(s))`, '', 'Rules that produced this verdict:', ...rules.map((x) => `- ${x}`),
  '', irValid
    ? `Independent review by ${ir.reviewer}${ir.date ? ` (${ir.date})` : ''}: ${ir.verdict}. Computed verdict was ${computedVerdict}. Disputed records: ${(ir.disputed || []).map((d) => d.id || d).join(', ') || 'none'}.`
    : '**Independent review: NOT DONE.** This is the computed verdict only (a ceiling), not an independent verdict. See references/05 §Independent final audit.',
  ...(raValid ? ['', `Risk acceptance on file: ${ra.acceptedIds.length} check(s) accepted by ${ra.acceptedBy}. Reason: ${ra.reason}`] : [])].join('\n');
const scorecard = [scoreTable, '', 'Formula: category score = weight x coverage x quality. Coverage = (PASS+FAIL) / applicable checks. Quality = PASS / (PASS + weighted FAILs; critical 8, high 4, medium 2, low 1). Untested checks earn no points and lower confidence.'].join('\n');
fs.writeFileSync(path.join(out, 'scorecard.md'), red(`# Scorecard\n\n${verdictBlock}\n\n${scorecard}\n`));

// ---------- report sections
const defectBlock = (r) => [`#### ${r.defectId} · ${r.id} · ${r.title || ''}`, `- **Severity:** ${sevOf(r)}`, `- **Location:** ${r.page}`, `- **Expected:** ${r.expected || 'n/a'}`, `- **Actual:** ${r.actual || 'n/a'}`,
  `- **Evidence:** ${r.evidence || 'see test-case-log.csv'}`, `- **Impact:** ${r.impact || 'n/a'}`, `- **Recommended fix:** ${r.fix || 'n/a'}`, `- **Fix status:** ${r.fixStatus}`].join('\n');
const section = (key) => {
  const rs = records.filter((r) => r.category === key);
  const c = cats[key];
  const fails = defects.filter((r) => r.category === key && r.status === 'FAIL');
  const untested = rs.filter((r) => r.status === 'NOT_TESTED' || r.status === 'BLOCKED');
  const lines = [];
  if (c) lines.push(`**Score: ${c.assessed ? c.score : '0 (not assessed)'} / ${c.weight}** · coverage ${pct(c.coverage)} · ${c.pass} passed, ${c.fail} failed, ${c.untested} untested${c.capped ? ' · capped (open critical defect)' : ''}`);
  else lines.push(`Unscored. ${rs.filter((r) => r.status === 'PASS').length} passed, ${fails.length} failed, ${untested.length} untested.`);
  const todo = [];
  if (fails.length) todo.push(`fix ${fails.length} open defect(s) (${idList(fails, 6)}) and retest them`);
  if (untested.length) todo.push(`run or verify ${untested.length} unverified check(s) (${idList(untested, 6)})`);
  lines.push('', `**What is needed to improve:** ${!rs.length ? 'run the checks for this area; nothing was recorded, so it earns no points' : todo.length ? todo.join('; ') : 'nothing outstanding among the recorded checks'}.`);
  if (!rs.length) { lines.push('', 'No checks recorded for this area: it was not assessed.'); return lines.join('\n'); }
  lines.push('', fails.length ? `### Open defects (${fails.length})` : 'No open defects among the checks that were run.');
  for (const r of fails) lines.push('', defectBlock(r));
  if (untested.length) {
    lines.push('', `### Not verified (${untested.length})`, '', table(['Test ID', 'Check', 'Status', 'Reason'], untested.map((r) => [r.id, r.title, lbl(r.status), r.actual || 'Not performed'])));
  }
  return lines.join('\n');
};

const st = (id) => records.filter((r) => (id.endsWith('*') ? r.id.startsWith(id.slice(0, -1)) : r.id === id));
// The 11 customer-journey steps of the master prompt (Phase 6), in its order and wording.
const STAGES = [
  ['1. Landing on the homepage', ['FN-LOAD-home']],
  ['2. Discovering products', ['EC-COLLECTION', 'EC-M01', 'FN-SEARCH', 'EC-M02']],
  ['3. Opening a product', ['EC-PDP-*', 'EC-M13']],
  ['4. Selecting variants', ['EC-VARIANT', 'EC-PRICE-UPDATE', 'EC-M03']],
  ['5. Adding products to the cart', ['EC-ATC', 'EC-QTY', 'EC-M14']],
  ['6. Updating the cart', ['EC-CART', 'EC-CART-TOTAL', 'EC-CART-UPDATE', 'EC-CART-REMOVE', 'EC-M04', 'EC-M05', 'EC-M06', 'EC-M11', 'EC-M12']],
  ['7. Proceeding to checkout', ['EC-CHECKOUT-REACH']],
  ['8. Entering customer information', ['EC-M07']],
  ['9. Reviewing shipping options', ['EC-M08']],
  ['10. Reviewing payment options (test gateway only)', ['EC-M09']],
  ['11. Completing a test transaction (dev store, test gateway only)', ['EC-M10']],
];
const journey = table(['Stage', 'Result', 'Checks'], STAGES.map(([name, ids]) => {
  const rs = ids.flatMap(st);
  const res = rs.some((r) => r.status === 'FAIL') ? 'FAIL' : rs.length && rs.every((r) => r.status === 'PASS') ? 'VERIFIED' : rs.some((r) => r.status === 'PASS') ? 'PARTLY VERIFIED' : 'NOT TESTED';
  return [name, res, rs.map((r) => `${r.id}: ${lbl(r.status)}`).join('; ') || 'no check recorded'];
}));

const pageNames = [...new Set(records.map((r) => r.page))].sort();
const pageByPage = table(['Page / component', 'Pass', 'Fail', 'Untested', 'Failed checks'], pageNames.map((p) => {
  const rs = records.filter((r) => r.page === p);
  const f = rs.filter((r) => r.status === 'FAIL');
  return [p, rs.filter((r) => r.status === 'PASS').length, f.length, rs.filter((r) => r.status === 'NOT_TESTED' || r.status === 'BLOCKED').length, idList(f, 6)];
}));

const evRoot = path.join(out, 'evidence');
const evDirs = fs.existsSync(evRoot) ? fs.readdirSync(evRoot).filter((d) => fs.statSync(path.join(evRoot, d)).isDirectory()) : [];
const evidence = evDirs.length ? table(['Folder', 'Files', 'Examples'], evDirs.map((d) => { const fl = fs.readdirSync(path.join(evRoot, d)); return [`evidence/${d}/`, fl.length, fl.slice(0, 4).join(', ')]; })) : '_No evidence files were collected._';

const fixed = defects.filter((r) => r.fixStatus === FIXED);
const regress = defects.filter((r) => /^REGRESSION/.test(r.fixStatus));
const stillOpen = defects.filter((r) => /^Open \(/.test(r.fixStatus));
const inspected = pages.filter((p) => pageState(p) === 'Inspected').length;
const selected = pages.filter((p) => p.selected).length;
const fullCov = !!inv?.coverage?.full;
const untested = pages.length - inspected;
const covLine = `Pages: ${pages.length} discovered, ${selected} selected, ${inspected} inspected with at least one verified result, ${untested} untested. Strategy: ${inv?.coverage?.strategy || 'unknown'}.`;
const blockedRecs = records.filter((r) => r.status === 'BLOCKED');
const notTested = records.filter((r) => r.status === 'NOT_TESTED');
const has = (prefix) => records.some((r) => r.id.startsWith(prefix) && (r.status === 'PASS' || r.status === 'FAIL'));
const limits = [
  `${notTested.length} check(s) are NOT TESTED and ${blockedRecs.length} are BLOCKED. They earn no points; see test-case-log.csv.${blockedRecs.length ? ` Blocked: ${idList(blockedRecs, 10)}.` : ''}`,
  pages.length ? `${covLine} ${fullCov ? 'Every discovered page was selected; pages not found by discovery (deep links, app or JS routes) remain unknown.' : `This is a template sample, not the whole site: ${untested} discovered page(s) were not inspected. Re-run with --all for full coverage.`}` : 'No page inventory was produced, so page coverage is unknown.',
  'Responsive results come from emulated viewports in headless Chromium, not physical devices or other browser engines (Safari, Firefox).',
  has('PERF-') ? 'Performance figures are single Lighthouse lab runs with simulated throttling. They are not field data and vary between runs.' : 'No Lighthouse run produced a result.',
  'Automated accessibility rules (axe-core) detect only part of WCAG 2.2 AA. Conformance is not claimed without the manual checks A11Y-M01 to A11Y-M08.',
  'Security review is passive (headers, cookies, exposed patterns, mixed content). No penetration testing was performed and the store is not certified secure.',
  'Automation stops at the checkout entry. Contact, shipping, payment and confirmation are verified only if the manual checks EC-M07 to EC-M10 were performed on a test gateway. No purchase was made by the scripts.',
  records.some((r) => r.category === 'technical' && r.id.startsWith('TECH-TC')) ? 'Theme code was analysed statically from a local copy; this is not proof of what is published.' : 'Theme source code was not provided or not analysed: the technical audit is limited to what is visible from the storefront.',
  'Search-engine indexing status, rankings and Search Console data were not verified unless a manual SEO check says so.',
];
if (inv?.locked) limits.unshift('The storefront was password protected during discovery. Public pages could not be inspected without an owner-provided session.');

const disc = (() => { try { return fs.readFileSync(path.join(out, 'discovery.md'), 'utf8').replace(/^(#+)\s/gm, '##$1 '); } catch { return '_No discovery document was produced._'; } })();
const store = String(args.url || inv?.origin || inv?.url || records.find((r) => /https?:\/\//.test(r.environment || ''))?.environment?.match(/https?:\/\/[^\s/)]+/)?.[0] || 'unknown store');
const top = defects.filter((r) => r.status === 'FAIL').slice(0, 8);
const exec = [
  `Store audited: ${store}. Verdict: **${verdict}**, score **${total}/100**, confidence **${confidence}** (coverage ${pct(coverage)}).`, '',
  `${records.length} checks recorded: ${score.counts.PASS} passed, ${score.counts.FAIL} failed, ${score.counts.NOT_TESTED} NOT TESTED, ${score.counts.BLOCKED} blocked, ${score.counts['N/A']} NOT APPLICABLE.`,
  `Open defects: ${SEV.map((s) => `${score.openDefects[s]} ${s}`).join(', ')}.`, '',
  top.length ? '### Highest-priority open defects' : 'No open defects among the checks that were run.', top.length ? table(['Defect', 'Severity', 'Location', 'Issue'], top.map((r) => [`${r.defectId} (${r.id})`, sevOf(r), r.page, r.title])) : '',
  '', 'Results marked PASS were verified by the stated test only. Everything not listed as PASS or FAIL is unverified.',
].join('\n');

const cro = records.filter((r) => r.category === 'cro');
const T = {
  STORE: store, DATE: new Date().toISOString().slice(0, 10), VERDICT: verdict, TOTAL: String(total), CONFIDENCE: confidence, COVERAGE: pct(coverage),
  EXEC_SUMMARY: exec, DISCOVERY: disc,
  PAGE_INVENTORY: pages.length ? `${covLine}${fullCov ? '' : ' **Sampled audit: untested pages are listed in page-inventory.csv.**'} Full list: page-inventory.csv.\n\n${table(['Path', 'Type', 'Coverage'], pages.filter((p) => p.selected).map((p) => [p.path, p.type, pageState(p)]))}` : '_No inventory was produced._',
  PAGE_BY_PAGE: pageByPage, UIUX: section('uiux'), RESPONSIVE: section('mobile'), FUNCTIONAL: section('functionality'),
  ECOMMERCE: `### Purchase journey\n\n${journey}\n\n${section('ecommerce')}`,
  SEO: section('seo'), PERFORMANCE: section('performance'), ACCESSIBILITY: section('accessibility'), TECHNICAL: section('technical'), SECURITY: section('security'),
  CRO: `CRO items are hypotheses to test, not defects, and are not scored. No uplift is claimed.\n\n${cro.length ? table(['ID', 'Hypothesis / check', 'Status', 'Notes'], cro.map((r) => [r.id, r.title, lbl(r.status), r.actual || ''])) : '_No CRO items recorded._'}`,
  EVIDENCE: evidence,
  DEFECTS: defects.length ? `${table(['Defect', 'Test ID', 'Severity', 'Category', 'Location', 'Issue', 'Fix status'], defects.map((r) => [r.defectId, r.id, sevOf(r), catName(r.category), r.page, r.title, r.fixStatus]))}\n\nFull detail: defect-register.csv.` : '_No defects recorded._',
  SCORECARD: scorecard,
  FIXES: `${fixed.length ? table(['Defect', 'Test ID', 'Issue', 'Status'], fixed.map((r) => [r.defectId, r.id, r.title, r.fixStatus])) : '_No fix has been verified by a retest._'}\n\n### Attempted, not verified by retest\n\n${stillOpen.length ? `A retest was run for these defects but did not confirm the fix. They stay open and are not counted as fixed.\n\n${table(['Defect', 'Test ID', 'Issue', 'Status'], stillOpen.map((r) => [r.defectId, r.id, r.title, r.fixStatus]))}` : '_No attempted fix is awaiting verification._'}`,
  REGRESSION: retestFiles.length ? `Retest files: ${retestFiles.join(', ')}. ${fixed.length} fixed and verified, ${stillOpen.length} still open or unverified, ${regress.length} regression(s).\n\n${table(['Defect', 'Test ID', 'Issue', 'Result'], [...regress, ...stillOpen].map((r) => [r.defectId, r.id, r.title, r.fixStatus]))}` : '_No retest has been run._',
  LIMITATIONS: limits.map((x) => `- ${x}`).join('\n'), VERDICT_BLOCK: verdictBlock,
};
const SECTIONS = [['Executive Summary', 'EXEC_SUMMARY'], ['Store Discovery Document', 'DISCOVERY'], ['Page Inventory', 'PAGE_INVENTORY'], ['Page-by-Page Results', 'PAGE_BY_PAGE'], ['UI/UX Audit', 'UIUX'],
  ['Responsive Results', 'RESPONSIVE'], ['Functional Results', 'FUNCTIONAL'], ['E-commerce Journey Results', 'ECOMMERCE'], ['SEO Audit', 'SEO'], ['Performance Audit', 'PERFORMANCE'], ['Accessibility Audit', 'ACCESSIBILITY'],
  ['Technical Audit', 'TECHNICAL'], ['Security & Trust Findings', 'SECURITY'], ['CRO Recommendations', 'CRO'], ['Screenshots & Evidence', 'EVIDENCE'], ['Bug / Defect Register', 'DEFECTS'], ['Professional Scorecard', 'SCORECARD'],
  ['Fixes Implemented', 'FIXES'], ['Regression Results', 'REGRESSION'], ['Remaining Risks & Limitations', 'LIMITATIONS'], ['Final Independent Verdict', 'VERDICT_BLOCK']];
let tpl;
try { tpl = fs.readFileSync(path.join(HERE, '..', 'templates', 'final-report.md'), 'utf8'); } catch {
  tpl = `# Shopify Store Audit: {{STORE}}\n\nDate: {{DATE}}\n\n${SECTIONS.map(([n, k], i) => `## ${i + 1}. ${n}\n\n{{${k}}}`).join('\n\n')}\n`;
}
fs.writeFileSync(path.join(out, 'audit-report.md'), red(tpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in T ? T[k] : m))));

console.log(`[report] ${verdict} | ${total}/100 | confidence ${confidence} | coverage ${pct(coverage)} | ${open.length} open defect(s) from ${roots.size} root cause(s)`);
console.log(`[report] wrote audit-report.md, scorecard.md, score.json, defect-register.csv, test-case-log.csv, page-inventory.csv in ${out}`);

#!/usr/bin/env node
// Converts OUT/evidence/technical/theme-check.json (Shopify CLI Theme Check, JSON output)
// into audit records. Called by theme-check.sh.
// usage: node theme-check-results.mjs --out OUT --theme DIR [--exit N] [--error MSG] [--retest]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, recorder, writeResults } from './common.mjs';

const args = parseArgs();
if (!args.out) { console.error('usage: node theme-check-results.mjs --out OUT --theme DIR'); process.exit(64); }
const out = path.resolve(String(args.out));
const theme = path.basename(path.resolve(String(args.theme || 'theme')));
const evRel = 'evidence/technical/theme-check.json';
const file = path.join(out, evRel);
const R = recorder('technical', `Shopify CLI Theme Check / local theme directory "${theme}" (static analysis, not the live theme)`);
const blocked = (why) => R.add({ id: 'TECH-TC', group: 'TECH-TC', title: 'Theme Check run', page: `theme:${theme}`, preconditions: 'Local theme files available', actual: why, status: 'BLOCKED' });

let data = null;
if (args.error) blocked(String(args.error));
else {
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch { /* handled below */ }
  try { data = JSON.parse(raw); } catch {
    const i = raw.indexOf('['); const j = raw.lastIndexOf(']');
    if (i >= 0 && j > i) { try { data = JSON.parse(raw.slice(i, j + 1)); } catch { /* stays null */ } }
  }
  if (!Array.isArray(data)) { data = null; blocked(`Theme Check produced no parseable JSON (exit ${args.exit ?? '?'}). See evidence/technical/theme-check.stderr.txt`); }
}

if (data) {
  const by = new Map();
  for (const f of data) for (const o of f.offenses || []) {
    const name = o.check || 'Unknown';
    if (!by.has(name)) by.set(name, { sev: 9, list: [] });
    const e = by.get(name);
    const sev = typeof o.severity === 'number' ? o.severity : ({ error: 0, warning: 1, suggestion: 1, info: 2, style: 2 }[String(o.severity).toLowerCase()] ?? 1);
    e.sev = Math.min(e.sev, sev);
    e.list.push({ where: `${path.relative(path.resolve(String(args.theme || '.')), f.path || '') || f.path}:${o.start_row ?? o.start_line ?? '?'}`, message: o.message || '' });
  }
  const steps = 'shopify theme check --path THEME_DIR --output json';
  const pre = 'Local theme files available';
  if (!by.size) {
    R.add({ id: 'TECH-TC-CLEAN', group: 'TECH-TC', title: 'Theme Check reports no offenses', page: `theme:${theme}`, preconditions: pre, steps, expected: '0 offenses', actual: `0 offenses in ${data.length} file(s) with results`, status: 'PASS', evidence: evRel });
  }
  for (const [name, e] of by) {
    R.add({
      id: `TECH-TC-${name}`, group: 'TECH-TC', title: `Theme Check: ${name}`, page: `theme:${theme}`, preconditions: pre, steps, expected: `No "${name}" offense`,
      actual: `${e.list.length} offense(s). First: ${e.list[0].message} Locations: ${e.list.slice(0, 5).map((x) => x.where).join(', ')}${e.list.length > 5 ? ', ...' : ''}`,
      status: 'FAIL', severity: e.sev === 0 ? 'medium' : 'low', evidence: evRel,
      impact: e.sev === 0 ? 'Theme Check error: can break rendering, performance or theme-store requirements.' : 'Theme Check warning: maintainability or best-practice issue.',
      fix: `See https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks for "${name}".`,
    });
  }
}
writeResults(out, 'technical', R.records, { theme, exitCode: args.exit ?? null }, !!args.retest);

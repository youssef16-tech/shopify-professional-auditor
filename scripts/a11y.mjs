#!/usr/bin/env node
// Accessibility collector: axe-core (WCAG 2.0/2.1/2.2 A+AA rules) per sampled page and a
// keyboard Tab probe on the homepage. Automation finds only part of WCAG: the manual
// checks A11Y-M01..M08 stay NOT_TESTED until a person does them.
// usage: node a11y.mjs --url URL --out OUT [--max 15] [--retest]
import pkg from '@axe-core/playwright';
import { setup, launch, newContext, recorder, writeResults, writeEvidence, loadPages, gotoSafe, pageLoaded, navProblem, envString } from './lib/common.mjs';

const AxeBuilder = pkg.AxeBuilder ?? pkg.default ?? pkg;
const { args, out, origin, retest, evDir, evRel } = setup('a11y');
const VP = { width: 1366, height: 768 };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SEV = { critical: 'high', serious: 'high', moderate: 'medium', minor: 'low' };
const pages = loadPages(out, origin, Number(args.max) || Infinity);

const browser = await launch();
const ctx = await newContext(browser, out, { viewport: VP });
const R = recorder('accessibility', envString(browser, VP, origin) + ' / axe-core via @axe-core/playwright');
const page = await ctx.newPage();

for (const p of pages) {
  const group = `A11Y-AXE-${p.slug}`;
  const nav = await gotoSafe(page, p.url);
  if (!pageLoaded(nav)) {
    R.add({ id: group, group, title: 'axe-core scan', page: p.path, actual: `${navProblem(nav)}; page did not load`, status: 'NOT_TESTED' });
    continue;
  }
  let res;
  try { res = await new AxeBuilder({ page }).withTags(TAGS).analyze(); } catch (e) {
    R.add({ id: group, group, title: 'axe-core scan', page: p.path, actual: `axe failed: ${String(e.message).split('\n')[0]}`, status: 'BLOCKED' });
    continue;
  }
  const ev = `${evRel}/axe-${p.slug}.json`;
  writeEvidence(evDir, `axe-${p.slug}.json`, {
    url: p.url, axeVersion: res.testEngine?.version, tags: TAGS, passes: res.passes.length, incomplete: res.incomplete.map((i) => ({ id: i.id, help: i.help, nodes: i.nodes.length })),
    violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags, nodes: v.nodes.slice(0, 20).map((n) => ({ target: n.target, html: (n.html || '').slice(0, 200), failureSummary: n.failureSummary })) })),
  });
  const steps = `Run axe-core ${res.testEngine?.version || ''} with tags ${TAGS.join(', ')}`;
  if (!res.violations.length) {
    R.add({ id: group, group, title: 'No axe-core WCAG A/AA violations', page: p.path, steps, expected: '0 violations',
      actual: `0 violations, ${res.passes.length} rules passed, ${res.incomplete.length} need manual review. Automated rules cover only part of WCAG 2.2 AA.`, status: 'PASS', evidence: ev });
    continue;
  }
  for (const v of res.violations) {
    R.add({ id: `A11Y-AXE-${v.id}-${p.slug}`, group, title: v.help, page: p.path, steps, expected: `No "${v.id}" violation`,
      actual: `${v.nodes.length} element(s), axe impact ${v.impact}: ${v.nodes.slice(0, 4).map((n) => [].concat(n.target).join(' ')).join(' | ')}`,
      status: 'FAIL', severity: SEV[v.impact] || 'medium', evidence: ev,
      impact: `WCAG failure (${v.tags.filter((t) => /^wcag\d{3,}/.test(t)).join(', ') || 'A/AA'}): ${v.description}`, fix: `See ${v.helpUrl}` });
  }
}

// --- keyboard probe (homepage): heuristic, complements but does not replace manual keyboard testing
{
  const nav = await gotoSafe(page, origin + '/');
  const ids = ['A11Y-KBD-TAB-home', 'A11Y-KBD-FOCUS-home', 'A11Y-SKIPLINK-home'];
  if (!pageLoaded(nav)) {
    for (const id of ids) R.add({ id, title: 'Keyboard probe', page: '/', actual: navProblem(nav), status: 'NOT_TESTED' });
  } else {
    const stops = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      stops.push(await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body || e === document.documentElement) return null;
        if (!e.dataset.auditTab) e.dataset.auditTab = String(Math.random());
        const s = getComputedStyle(e);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow && s.boxShadow !== 'none';
        return { key: e.dataset.auditTab, desc: `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || e.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`,
          hashLink: e.tagName === 'A' && (e.getAttribute('href') || '').startsWith('#'), visible: !!(outline || shadow) };
      }));
    }
    const real = stops.filter(Boolean);
    const distinct = [...new Map(real.map((s) => [s.key, s])).values()];
    const steps = 'Load the homepage, press Tab 15 times, record document.activeElement after each press';
    R.add({ id: ids[0], title: 'Tab key moves focus through the page', page: '/', steps, expected: 'At least 3 distinct elements receive focus',
      actual: `${distinct.length} distinct element(s): ${distinct.slice(0, 8).map((s) => s.desc).join(', ')}`, status: distinct.length >= 3 ? 'PASS' : 'FAIL', severity: 'high',
      impact: 'Keyboard users cannot reach the controls.', fix: 'Use native links/buttons; remove tabindex="-1" and focus traps.' });
    const vis = distinct.filter((s) => s.visible).length;
    R.add({ id: ids[1], title: 'Focused elements show a visible focus indicator', page: '/', steps: steps + '; read computed outline and box-shadow', expected: 'At least 80% of focused elements have an outline or box-shadow',
      actual: distinct.length ? `${vis} of ${distinct.length} show an outline or box-shadow. Without one: ${distinct.filter((s) => !s.visible).slice(0, 5).map((s) => s.desc).join(', ') || 'none'}. Heuristic: other indicators (background, border) are not detected; confirm by eye.` : 'Nothing received focus',
      status: !distinct.length ? 'NOT_TESTED' : vis / distinct.length >= 0.8 ? 'PASS' : 'FAIL', severity: 'high',
      impact: 'Keyboard users cannot see where they are (WCAG 2.4.7).', fix: 'Remove outline:none or add a :focus-visible style.' });
    R.add({ id: ids[2], title: 'Skip link is the first Tab stop', page: '/', steps, expected: 'First focused element is an in-page link (href="#...")',
      actual: real[0] ? `First stop: ${real[0].desc}` : 'Nothing received focus', status: real[0]?.hashLink ? 'PASS' : 'FAIL', severity: 'medium',
      impact: 'Keyboard users must tab through the whole header on every page (WCAG 2.4.1).', fix: 'Add a "Skip to content" link as the first element in <body>.' });
  }
}

writeResults(out, 'a11y', R.records, { pages: pages.map((p) => p.path), tags: TAGS }, retest);
await browser.close();

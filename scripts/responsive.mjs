#!/usr/bin/env node
// Responsive collector: real Chromium rendering at six widths, full-page screenshots.
// usage: node responsive.mjs --url URL --out OUT [--max 6] [--retest]
import path from 'node:path';
import { setup, launch, newContext, recorder, writeResults, loadPages, gotoSafe, pageLoaded, navProblem, envString, VIEWPORTS } from './lib/common.mjs';

const { args, out, origin, retest, evRel } = setup('responsive');
const PRIORITY = ['home', 'product', 'collection', 'cart', 'page', 'search', 'article', 'blog', 'policy', 'other'];
const all = loadPages(out, origin, 100);
// one page per type first, then the rest, capped
const picked = [];
for (const t of PRIORITY) { const p = all.find((x) => x.type === t); if (p) picked.push(p); }
for (const p of all) if (!picked.includes(p)) picked.push(p);
const pages = picked.slice(0, Number(args.max) || 6);

const browser = await launch();
const records = [];
for (const vp of VIEWPORTS) {
  const ctx = await newContext(browser, out, { viewport: vp, hasTouch: vp.width < 1000 });
  const R = recorder('mobile', envString(browser, vp, origin) + ' (emulated viewport, not a physical device)');
  const page = await ctx.newPage();
  for (const p of pages) {
    const nav = await gotoSafe(page, p.url);
    const id = `RSP-OVERFLOW-${p.slug}-${vp.width}`;
    if (!pageLoaded(nav)) {
      R.add({ id, title: `No horizontal overflow at ${vp.width}px`, page: p.path, actual: `${navProblem(nav)}; page did not load`, status: 'NOT_TESTED' });
      continue;
    }
    const shot = `${evRel}/${p.slug}-${vp.width}.png`;
    await page.screenshot({ path: path.join(out, shot), fullPage: true }).catch(() => {});
    const m = await page.evaluate(() => {
      const de = document.documentElement; const vw = de.clientWidth; const sw = de.scrollWidth;
      const desc = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
      const off = [];
      if (sw > vw + 1) {
        const over = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.right > vw + 1; });
        const set = new Set(over);
        for (const e of over) {
          if ([...e.children].some((c) => set.has(c))) continue; // keep the deepest offender
          const b = e.getBoundingClientRect();
          off.push(`${desc(e)} (right edge ${Math.round(b.right)}px, width ${Math.round(b.width)}px)`);
          if (off.length >= 5) break;
        }
      }
      return { vw, sw, off };
    });
    R.add({
      id, title: `No horizontal overflow at ${vp.width}px`, page: p.path, steps: `Render at ${vp.width}x${vp.height}; compare documentElement.scrollWidth with clientWidth`,
      expected: 'scrollWidth <= viewport width', actual: `scrollWidth ${m.sw}px, viewport ${m.vw}px${m.off.length ? '; offenders: ' + m.off.join('; ') : ''}`,
      status: m.sw > m.vw + 1 ? 'FAIL' : 'PASS', severity: vp.width <= 430 ? 'high' : 'medium', evidence: shot,
      impact: 'Content is cut off or the page scrolls sideways.', fix: 'Constrain the offending element (max-width: 100%, overflow-wrap, responsive grid).',
    });
    if (vp.width !== 375) continue;
    const t = await page.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && b.right > 0 && b.left < innerWidth; };
      const desc = (e) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
      const small = [];
      for (const e of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], summary')) {
        if (!vis(e)) continue;
        // WCAG 2.5.8 exception: links inline in a sentence
        if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && (e.parentElement?.textContent || '').trim().length > (e.textContent || '').trim().length + 20) continue;
        const b = e.getBoundingClientRect();
        if (b.width < 24 || b.height < 24) small.push(`${desc(e)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      const tiny = []; const seen = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode; const e = n.parentElement;
        if (!e || seen.has(e) || !n.textContent.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName) || !vis(e)) continue;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        const bb = e.getBoundingClientRect();
        if (fs === 0 || bb.width <= 1 || bb.height <= 1) continue; // visually hidden text for screen readers, not tiny text
        if (fs < 12) { seen.add(e); tiny.push(`${desc(e)} ${fs}px`); }
      }
      return { small, tiny };
    });
    R.add({
      id: `RSP-TAP-${p.slug}-375`, title: 'Tap targets at least 24x24 CSS px', page: p.path, steps: 'At 375px measure visible links, buttons and fields (inline text links excluded)',
      expected: 'No target under 24x24 (WCAG 2.5.8)', actual: t.small.length ? `${t.small.length} small target(s): ${t.small.slice(0, 8).join('; ')}. Heuristic: confirm manually (spacing exception not evaluated).` : 'No small targets found',
      status: t.small.length ? 'FAIL' : 'PASS', severity: 'low', evidence: shot,
      impact: 'Small targets are hard to hit on touch screens.', fix: 'Increase padding or min-size of the listed controls.',
    });
    R.add({
      id: `RSP-TEXT-${p.slug}-375`, title: 'No text under 12px on phones', page: p.path, steps: 'At 375px read computed font-size of visible text',
      expected: 'All visible text >= 12px', actual: t.tiny.length ? `${t.tiny.length} element(s) under 12px: ${t.tiny.slice(0, 8).join('; ')}` : 'No text under 12px',
      status: t.tiny.length ? 'FAIL' : 'PASS', severity: 'low', evidence: shot,
      impact: 'Tiny text is hard to read on phones.', fix: 'Raise the font size of the listed elements.',
    });
  }
  records.push(...R.records);
  await ctx.close();
}
writeResults(out, 'responsive', records, { pages: pages.map((p) => p.path), viewports: VIEWPORTS.map((v) => `${v.width}x${v.height}`) }, retest);
await browser.close();

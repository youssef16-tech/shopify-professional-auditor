#!/usr/bin/env node
// SEO collector: on-page signals per sampled page plus robots.txt / sitemap. Read-only.
// It reports what the pages declare. It never claims a page IS indexed (that needs Search Console).
// usage: node seo.mjs --url URL --out OUT [--max 15] [--retest]
import { setup, launch, newContext, recorder, writeResults, writeEvidence, loadPages, gotoSafe, envString } from './lib/common.mjs';

const { args, out, origin, retest, evDir, evRel } = setup('seo');
const VP = { width: 1366, height: 768 };
const pages = loadPages(out, origin, Number(args.max) || Infinity);
const TITLE_ONLY = new Set(['cart', 'search', 'account']);

const browser = await launch();
const ctx = await newContext(browser, out, { viewport: VP });
const R = recorder('seo', envString(browser, VP, origin));
const page = await ctx.newPage();
const titles = new Map();
const raw = {};
let homeLang;

const flatten = (node, acc = []) => {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, acc));
  else if (node && typeof node === 'object') { acc.push(node); if (node['@graph']) flatten(node['@graph'], acc); }
  return acc;
};
const typesOf = (n) => [].concat(n['@type'] || []).map(String);

for (const p of pages) {
  const nav = await gotoSafe(page, p.url);
  if (nav.error || nav.status !== 200 || nav.locked) {
    R.add({ id: `SEO-PAGE-${p.slug}`, title: 'Page available for SEO checks', page: p.path, steps: `GET ${p.path}`, expected: 'HTTP 200', actual: nav.error || (nav.locked ? 'Password page' : `HTTP ${nav.status}`), status: 'NOT_TESTED' });
    continue;
  }
  const xRobots = nav.response?.headers()['x-robots-tag'] || '';
  const d = await page.evaluate(() => {
    const meta = (sel) => { const e = document.querySelector(sel); return e ? (e.getAttribute('content') || '').trim() : null; };
    const imgs = [...document.querySelectorAll('img')];
    return {
      title: document.title.trim(),
      desc: meta('meta[name="description"]'),
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)),
      levels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      robots: meta('meta[name="robots"]'),
      og: { title: meta('meta[property="og:title"]'), url: meta('meta[property="og:url"]'), image: meta('meta[property="og:image"]') || meta('meta[property="og:image:secure_url"]') },
      imgTotal: imgs.length,
      noAlt: imgs.filter((i) => !i.hasAttribute('alt')).map((i) => (i.currentSrc || i.src || '(no src)').split('?')[0].slice(-80)),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      lang: document.documentElement.getAttribute('lang'),
    };
  });
  raw[p.slug] = { ...d, jsonld: `${d.jsonld.length} block(s)`, xRobots };
  if (p.type === 'home') homeLang = d.lang;
  const s = p.slug; const base = { page: p.path };

  // title
  const tl = d.title.length;
  if (d.title) titles.set(d.title, [...(titles.get(d.title) || []), p.path]);
  R.add({ ...base, id: `SEO-TITLE-${s}`, title: 'Title tag present, 10-65 characters', steps: 'Read document.title', expected: '10-65 characters',
    actual: d.title ? `"${d.title}" (${tl} chars)` : 'No title', status: d.title && tl >= 10 && tl <= 65 ? 'PASS' : 'FAIL', severity: d.title ? 'low' : 'medium',
    impact: 'Titles are the main search-result headline; missing or truncated titles lose clicks.', fix: 'Set a unique 10-65 character SEO title for this resource.' });
  if (TITLE_ONLY.has(p.type)) continue;

  // description
  const dl = (d.desc || '').length;
  R.add({ ...base, id: `SEO-DESC-${s}`, title: 'Meta description present, 50-165 characters', steps: 'Read meta[name=description]', expected: '50-165 characters',
    actual: d.desc ? `${dl} chars: "${d.desc.slice(0, 100)}"` : 'No meta description', status: d.desc && dl >= 50 && dl <= 165 ? 'PASS' : 'FAIL', severity: d.desc ? 'low' : 'medium',
    impact: 'Search engines write their own snippet when the description is missing.', fix: 'Add a meta description in the resource SEO settings.' });

  R.add({ ...base, id: `SEO-H1-${s}`, title: 'Exactly one H1', steps: 'Count h1 elements', expected: '1', actual: `${d.h1.length}${d.h1.length ? ': ' + d.h1.slice(0, 3).map((t) => `"${t}"`).join(', ') : ''}`,
    status: d.h1.length === 1 ? 'PASS' : 'FAIL', severity: 'medium', impact: 'Unclear main topic for search engines and screen-reader users.', fix: 'Keep one h1 (the page or product title); demote the others.' });

  const skips = [];
  for (let i = 1; i < d.levels.length; i++) if (d.levels[i] > d.levels[i - 1] + 1) skips.push(`h${d.levels[i - 1]}->h${d.levels[i]}`);
  R.add({ ...base, id: `SEO-HEADINGS-${s}`, title: 'Heading levels are not skipped', steps: 'Read h1-h6 in DOM order', expected: 'No jump of more than one level',
    actual: d.levels.length ? (skips.length ? `Skips: ${[...new Set(skips)].join(', ')}` : `${d.levels.length} headings, no skips`) : 'No headings', status: skips.length ? 'FAIL' : 'PASS', severity: 'low',
    impact: 'Broken document outline.', fix: 'Use heading levels in order; style with classes rather than level.' });

  R.add({ ...base, id: `SEO-CANONICAL-${s}`, title: 'Canonical link present', steps: 'Read link[rel=canonical]', expected: 'One absolute canonical URL', actual: d.canonical || 'No canonical link',
    status: d.canonical ? 'PASS' : 'FAIL', severity: 'medium', impact: 'Duplicate URLs (variants, collection paths, parameters) compete with each other.', fix: 'Output {{ canonical_url }} in theme.liquid head.' });

  if (p.type !== 'policy') {
    const noindex = /noindex/i.test(`${d.robots || ''} ${xRobots}`);
    R.add({ ...base, id: `SEO-INDEX-${s}`, title: 'Page does not declare noindex', steps: 'Read meta robots and X-Robots-Tag', expected: 'No noindex directive',
      actual: `meta robots: ${d.robots || 'none'}; X-Robots-Tag: ${xRobots || 'none'}. Declares indexability only; actual index status not verified.`,
      status: noindex ? 'FAIL' : 'PASS', severity: ['home', 'product', 'collection'].includes(p.type) ? 'high' : 'medium',
      impact: 'A noindex page is removed from search results.', fix: 'Remove the noindex directive if the page should rank (check theme code and SEO apps).' });
  }

  const ogMissing = Object.entries(d.og).filter(([, v]) => !v).map(([k]) => `og:${k}`);
  R.add({ ...base, id: `SEO-OG-${s}`, title: 'Open Graph title, url and image', steps: 'Read og: meta tags', expected: 'og:title, og:url, og:image present', actual: ogMissing.length ? `Missing ${ogMissing.join(', ')}` : 'All present',
    status: ogMissing.length ? 'FAIL' : 'PASS', severity: 'low', impact: 'Poor link previews when shared.', fix: 'Add the missing tags to the social meta snippet.' });

  R.add({ ...base, id: `SEO-ALT-${s}`, title: 'Images have an alt attribute', steps: 'Find img elements without alt (alt="" is allowed for decoration)', expected: 'Every img has alt',
    actual: d.noAlt.length ? `${d.noAlt.length} of ${d.imgTotal} without alt: ${d.noAlt.slice(0, 5).join(', ')}` : `${d.imgTotal} image(s), all with alt. Alt text quality needs manual review.`,
    status: d.noAlt.length ? 'FAIL' : 'PASS', severity: 'medium', impact: 'Images are invisible to image search and screen readers.', fix: 'Add alt text in the media library or the section markup.' });

  // structured data
  const nodes = []; let bad = 0;
  for (const t of d.jsonld) { try { flatten(JSON.parse(t), nodes); } catch { bad++; } }
  const types = [...new Set(nodes.flatMap(typesOf))];
  R.add({ ...base, id: `SEO-JSONLD-${s}`, title: 'JSON-LD parses', steps: 'JSON.parse every application/ld+json block', expected: 'All blocks are valid JSON',
    actual: d.jsonld.length ? `${d.jsonld.length} block(s), ${bad} invalid; types: ${types.join(', ') || 'none'}` : 'No JSON-LD on this page',
    status: !d.jsonld.length ? 'N/A' : bad ? 'FAIL' : 'PASS', severity: 'medium', impact: 'Invalid structured data is ignored.', fix: 'Fix the JSON syntax (use the | json filter for Liquid values).' });
  if (p.type === 'product') {
    const prod = nodes.find((n) => typesOf(n).some((t) => t === 'Product' || t === 'ProductGroup'));
    const offers = prod ? flatten([].concat(prod.offers || [], (prod.hasVariant || []).map?.((v) => v.offers) || [])) : [];
    const priced = offers.some((o) => o.price !== undefined || o.lowPrice !== undefined || o.priceSpecification);
    R.add({ ...base, id: `SEO-PRODUCT-SCHEMA-${s}`, title: 'Product structured data with name and priced offer', steps: 'Find a Product node in JSON-LD', expected: 'Product with name and offers.price',
      actual: prod ? `name: ${prod.name ? 'yes' : 'no'}; offer with price: ${priced ? 'yes' : 'no'}` : 'No Product node', status: prod && prod.name && priced ? 'PASS' : 'FAIL', severity: 'medium',
      impact: 'No price/availability rich results.', fix: 'Output Product JSON-LD (e.g. {{ product | structured_data }}).' });
    const crumb = nodes.some((n) => typesOf(n).includes('BreadcrumbList'));
    R.add({ ...base, id: `SEO-BREADCRUMB-${s}`, title: 'BreadcrumbList structured data', steps: 'Find a BreadcrumbList node in JSON-LD', expected: 'Present', actual: crumb ? 'Present' : 'Absent',
      status: crumb ? 'PASS' : 'FAIL', severity: 'low', impact: 'No breadcrumb trail in search results.', fix: 'Add BreadcrumbList JSON-LD to the product template.' });
  }
}

// --- site-level
R.add({ id: 'SEO-LANG', title: 'html lang attribute', page: '/', steps: 'Read <html lang> on the homepage', expected: 'A language code', actual: homeLang === undefined ? 'Homepage not loaded' : (homeLang || 'Missing'),
  status: homeLang === undefined ? 'NOT_TESTED' : homeLang ? 'PASS' : 'FAIL', severity: 'medium', impact: 'Wrong language targeting and screen-reader pronunciation.', fix: 'Set <html lang="{{ request.locale.iso_code }}">.' });

const get = async (u) => { try { const r = await ctx.request.get(u, { timeout: 20000 }); return { status: r.status(), text: await r.text().catch(() => '') }; } catch (e) { return { status: 0, text: '', error: String(e.message).split('\n')[0] }; } };
const robots = await get(origin + '/robots.txt');
let blanket = false; let agents = []; let lastWasAgent = false;
for (const line of robots.text.split('\n')) {
  const m = line.replace(/#.*/, '').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
  if (!m) continue;
  const k = m[1].toLowerCase(); const v = m[2].trim();
  if (k === 'user-agent') { agents = lastWasAgent ? [...agents, v] : [v]; lastWasAgent = true; continue; }
  lastWasAgent = false;
  if (k === 'disallow' && v === '/' && agents.includes('*')) blanket = true;
}
R.add({ id: 'SEO-ROBOTS-TXT', title: 'robots.txt served and does not block the whole site', page: '/robots.txt', steps: 'GET /robots.txt', expected: 'HTTP 200, no "Disallow: /" for User-agent: *',
  actual: robots.error || `HTTP ${robots.status}${blanket ? '; blanket Disallow: / for *' : ''}`, status: robots.status === 0 ? 'BLOCKED' : robots.status === 200 && !blanket ? 'PASS' : 'FAIL', severity: blanket ? 'high' : 'medium',
  impact: 'Crawlers are blocked or have no crawl rules.', fix: 'Restore the default robots.txt (remove the override in robots.txt.liquid).' });
const smLine = robots.text.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
let smUrl = origin + '/sitemap.xml';
if (smLine) { try { const x = new URL(smLine); smUrl = origin + x.pathname + x.search; } catch { /* default */ } }
const sm = await get(smUrl);
const locCount = (sm.text.match(/<loc>/g) || []).length;
R.add({ id: 'SEO-SITEMAP', title: 'XML sitemap served', page: new URL(smUrl).pathname, steps: `GET ${new URL(smUrl).pathname}`, expected: 'HTTP 200 with <loc> entries',
  actual: sm.error || `HTTP ${sm.status}, ${locCount} <loc> entries. Submission to Search Console not verified.`, status: sm.status === 0 ? 'BLOCKED' : sm.status === 200 && locCount ? 'PASS' : 'FAIL', severity: 'medium',
  impact: 'Slower discovery of new pages.', fix: 'Shopify generates /sitemap.xml automatically; check for a proxy or app intercepting it.' });
const dups = [...titles].filter(([, ps]) => ps.length > 1);
R.add({ id: 'SEO-DUP-TITLES', title: 'Titles are unique across sampled pages', page: 'site', steps: 'Compare titles of sampled pages', expected: 'No two sampled pages share a title',
  actual: titles.size ? (dups.length ? dups.map(([t, ps]) => `"${t}" on ${ps.join(', ')}`).join('; ') : `${titles.size} unique titles in the sample`) : 'No titles collected',
  status: !titles.size ? 'NOT_TESTED' : dups.length ? 'FAIL' : 'PASS', severity: 'medium', impact: 'Pages compete for the same query.', fix: 'Give each page a distinct SEO title.' });

writeEvidence(evDir, 'onpage.json', raw);
for (const r of R.records) if (!r.evidence) r.evidence = `${evRel}/onpage.json`;
writeResults(out, 'seo', R.records, { pages: pages.map((p) => p.path) }, retest);
await browser.close();

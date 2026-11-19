#!/usr/bin/env node
// Page inventory + storefront discovery. Read-only.
// usage: node inventory.mjs --url URL --out OUT [--max 15] [--all] [--auto-all 50]
// Stores with at most --auto-all non-account pages are inspected in full; larger ones use template sampling.
// exit 0 ok, 2 storefront password-locked, 3 storefront unreachable
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, launch, newContext, recorder, writeResults, gotoSafe, navProblem, envString, normUrl } from './lib/common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { args, out, url, origin } = setup('inventory');
const MAX = Number(args.max) || 15;
const AUTO_ALL = args['auto-all'] !== undefined ? Number(args['auto-all']) : 50;
const CAPS = { home: 1, product: 3, collection: 2, cart: 1, search: 1, page: 3, policy: 2, blog: 1, article: 1, other: 2, account: 0 };
const ORDER = ['home', 'product', 'collection', 'cart', 'search', 'page', 'policy', 'blog', 'article', 'other'];
const VP = { width: 1366, height: 768 };

function classify(pathname) {
  const p = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/|$)/i, '') || '/';
  if (p === '/') return 'home';
  if (/\.(md|txt|xml|json|pdf|csv|jpe?g|png|gif|webp|avif|svg|ico|css|m?js|woff2?)$/i.test(p)) return 'file'; // e.g. /agents.md in Shopify sitemaps
  if (/\/products\/[^/]+/.test(p)) return 'product';
  if (/^\/collections(\/|$)/.test(p)) return 'collection';
  if (/^\/pages\//.test(p)) return 'page';
  if (/^\/blogs\/[^/]+\/[^/]+/.test(p)) return 'article';
  if (/^\/blogs\//.test(p)) return 'blog';
  if (/^\/cart\/?$/.test(p)) return 'cart';
  if (/^\/search\/?$/.test(p)) return 'search';
  if (/^\/policies\//.test(p)) return 'policy';
  if (/^\/(account|customer_authentication)(\/|$)/.test(p)) return 'account';
  return 'other';
}

const browser = await launch();
const ctx = await newContext(browser, out, { viewport: VP });
const R = recorder('functionality', envString(browser, VP, origin));
const page = await ctx.newPage();
const nav = await gotoSafe(page, url);

const finish = async (code, inv) => {
  fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(inv, null, 2));
  writeResults(out, 'access', R.records, { url });
  await browser.close();
  process.exit(code);
};

const baseInv = { generatedAt: new Date().toISOString(), url, origin, shopify: null, pages: [] };

if (nav.error || !nav.status || nav.status >= 400) {
  R.add({ id: 'ACCESS-STOREFRONT', title: 'Storefront is reachable', page: '/', steps: `GET ${url}`, expected: 'HTTP < 400', actual: navProblem(nav), status: 'BLOCKED' });
  await finish(3, baseInv);
}
if (nav.locked) {
  R.add({ id: 'ACCESS-STOREFRONT', title: 'Storefront is reachable', page: '/', steps: `GET ${url}`, expected: 'Storefront pages are served', actual: `Redirected to the password page (${nav.finalUrl}). Run auth-session.mjs so the owner can unlock it in a browser.`, status: 'BLOCKED' });
  await finish(2, { ...baseInv, locked: true });
}
R.add({ id: 'ACCESS-STOREFRONT', title: 'Storefront is reachable', page: '/', steps: `GET ${url}`, expected: 'HTTP < 400, not the password page', actual: `HTTP ${nav.status} at ${nav.finalUrl}`, status: 'PASS' });

// --- discovery facts observable on the storefront
const facts = await page.evaluate(() => {
  const S = window.Shopify || null;
  const opts = (sel) => [...document.querySelectorAll(sel)].map((e) => e.value || e.getAttribute('data-value') || e.textContent.trim()).filter(Boolean);
  return {
    shopify: S ? {
      shop: S.shop || null,
      theme: S.theme ? { name: S.theme.name, id: S.theme.id, schema_name: S.theme.schema_name, schema_version: S.theme.schema_version, role: S.theme.role } : null,
      currency: S.currency?.active || null,
      locale: S.locale || null,
      country: S.country || null,
    } : null,
    htmlLang: document.documentElement.getAttribute('lang'),
    hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute('hreflang')),
    localeOptions: [...new Set(opts('form[action*="/localization"] [name="locale_code"] option, form[action*="/localization"] [data-value]'))].slice(0, 50),
    links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
    title: document.title,
  };
});

// --- sources: robots.txt -> sitemaps -> homepage links -> conventions
const found = new Map(); // url -> source
const put = (u, source) => {
  const n = normUrl(u, origin);
  if (!n) return;
  const x = new URL(n);
  if (x.origin !== origin) return;
  x.search = '';
  const key = x.toString().replace(/\/$/, '') || origin;
  const k = x.pathname === '/' ? origin + '/' : key;
  if (!found.has(k)) found.set(k, source);
};
put(origin + '/', 'homepage');

const fetchText = async (u) => {
  try { const r = await ctx.request.get(u, { timeout: 20000 }); return { status: r.status(), text: r.ok() ? await r.text() : '' }; }
  catch (e) { return { status: 0, text: '', error: String(e.message).split('\n')[0] }; }
};

const robots = await fetchText(origin + '/robots.txt');
let sitemaps = [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
if (!sitemaps.length) sitemaps = [origin + '/sitemap.xml'];
const sitemapLog = [];
let sitemapUrls = 0; let children = 0;
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const samePath = (u) => { try { const x = new URL(u); return origin + x.pathname + x.search; } catch { return u; } };
for (const sm of sitemaps.slice(0, 3)) {
  const r = await fetchText(samePath(sm));
  sitemapLog.push({ url: sm, status: r.status });
  if (!r.text) continue;
  if (/<sitemapindex/i.test(r.text)) {
    for (const child of locs(r.text)) {
      if (children++ >= 20 || sitemapUrls >= 5000) break;
      const c = await fetchText(samePath(child));
      sitemapLog.push({ url: child, status: c.status });
      for (const l of locs(c.text)) { if (sitemapUrls++ < 5000) put(samePath(l), 'sitemap'); }
    }
  } else for (const l of locs(r.text)) { if (sitemapUrls++ < 5000) put(samePath(l), 'sitemap'); }
}
for (const l of facts.links) put(l, 'homepage-link');
put(origin + '/cart', 'convention');
put(origin + '/search', 'convention');

const pages = [...found].map(([u, source]) => ({ url: u, path: new URL(u).pathname, type: classify(new URL(u).pathname), source, selected: false }));

// keep manually added pages from an earlier inventory
const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(out, 'inventory.json'), 'utf8')); } catch { return null; } })();
for (const m of (prev?.pages || []).filter((p) => p.source === 'manual')) {
  if (!pages.find((p) => p.url === m.url)) pages.push(m);
}

// --- selection (template sampling)
let total = pages.filter((p) => p.selected).length;
const NOT_PAGES = ['account', 'file'];
const testable = pages.filter((p) => !NOT_PAGES.includes(p.type)).length;
const full = !!args.all || (!args.max && testable <= AUTO_ALL);
if (full) { for (const p of pages) if (!NOT_PAGES.includes(p.type)) p.selected = true; } else {
  for (const type of ORDER) {
    let n = pages.filter((p) => p.type === type && p.selected).length;
    for (const p of pages.filter((x) => x.type === type && !x.selected)) {
      if (n >= CAPS[type] || total >= MAX) break;
      p.selected = true; n++; total++;
    }
  }
}
const counts = {};
for (const p of pages) counts[p.type] = (counts[p.type] || 0) + 1;

const inv = {
  ...baseInv,
  shopify: facts.shopify,
  isShopify: !!facts.shopify,
  homeTitle: facts.title,
  htmlLang: facts.htmlLang,
  hreflang: [...new Set(facts.hreflang)],
  localeOptions: facts.localeOptions,
  robotsTxt: { status: robots.status },
  sitemaps: sitemapLog,
  counts,
  coverage: {
    strategy: full ? (args.all ? 'all discovered pages (--all)' : `all discovered pages (${testable} <= auto-all threshold ${AUTO_ALL})`) : 'template sampling',
    full,
    max: full ? null : MAX,
    caps: full ? null : CAPS,
    discovered: pages.length,
    selected: pages.filter((p) => p.selected).length,
    note: 'Sources: robots.txt, sitemaps, homepage links, Shopify conventions. Pages reachable only by deep navigation, apps or JS routing may be missing; add them with "source":"manual","selected":true.',
  },
  pages,
};

// discovery document skeleton, verified fields prefilled (never overwrites an existing one)
const discPath = path.join(out, 'discovery.md');
const tplPath = path.join(HERE, '..', 'templates', 'discovery.md');
if (!fs.existsSync(discPath) && fs.existsSync(tplPath)) {
  const s = facts.shopify;
  const v = (x, how) => (x ? `${x} — **Verified** (${how})` : '**Unknown**');
  const T = {
    DATE: new Date().toISOString().slice(0, 10),
    URL: `${origin} — **Verified** (loaded in this session)`,
    MYSHOPIFY: v(s?.shop, 'window.Shopify.shop'),
    THEME: s?.theme ? `${s.theme.name} (id ${s.theme.id}; based on ${s.theme.schema_name || 'unknown'} ${s.theme.schema_version || ''}) — **Verified** (window.Shopify.theme)` : '**Unknown**',
    THEME_VERSION: s?.theme?.schema_name ? `${s.theme.schema_name} ${s.theme.schema_version || '(version not exposed)'} — **Verified** (window.Shopify.theme.schema_name / schema_version); compare with the latest release yourself` : '**Unknown** (theme does not expose schema_name; ask the owner or read config/settings_schema.json)',
    CURRENCY: v(s?.currency, 'window.Shopify.currency.active'),
    LOCALE: v([s?.locale, s?.country].filter(Boolean).join(' / '), 'window.Shopify.locale / country'),
    LANGUAGES: inv.hreflang.length || inv.localeOptions.length ? `${[...new Set([...inv.hreflang, ...inv.localeOptions])].join(', ')} — **Verified** (hreflang / localisation form)` : `${facts.htmlLang || 'not declared'} only observed — **Verified** (html lang; no hreflang or localisation form found)`,
    COUNTS: `${Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join(', ')} — **Verified** (sitemap + homepage links; published URLs only)`,
  };
  fs.writeFileSync(discPath, fs.readFileSync(tplPath, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in T ? T[k] : m)));
}

console.log(`[inventory] discovered ${pages.length}, selected ${inv.coverage.selected}${facts.shopify ? '' : ' (window.Shopify not found: may not be a Shopify storefront)'}`);
await finish(0, inv);

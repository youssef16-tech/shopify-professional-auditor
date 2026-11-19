#!/usr/bin/env node
// Functional + e-commerce journey collector.
// usage: node functional.mjs --url URL --out OUT [--max N] [--external] [--retest]
// Side effects on the store: anonymous cart activity in a throwaway session only (one add-to-cart, one add with
// quantity 2, one cart quantity change, one line removal). No account, no order. Nothing is typed into checkout.
import path from 'node:path';
import { setup, launch, newContext, recorder, writeResults, writeEvidence, loadPages, gotoSafe, pageLoaded, navProblem, envString, redact, sleep, isCheckoutUrl, normUrl } from './lib/common.mjs';

const { args, out, origin, retest, evDir, evRel } = setup('functional');
const pages = loadPages(out, origin, Number(args.max) || Infinity);
const VP = { width: 1366, height: 768 };
const browser = await launch();
const ctx = await newContext(browser, out, { viewport: VP });
const R = recorder('functionality', envString(browser, VP, origin));
const EC = (r) => R.add({ category: 'ecommerce', ...r });

const SKIP_LINK = /\/cart\/(add|change|clear|update)|\/checkouts?(\/|$|\?)|\/account\/logout|\/discount\//i;
const links = new Map(); // url -> first page it was found on
const inventory = {};
const loaded = {}; // slug -> bool
// Shopify's own telemetry (monorail, bugsnag, error analytics). Ad blockers and DNS blockers refuse these hosts on many
// auditor machines; a failure here is the auditor's network, not a store defect. Counted and reported, never scored.
const TELEMETRY = /shopifysvc\.com|monorail|bugsnag|error-analytics|\/\.well-known\/shopify\/monorail/i;

for (const p of pages) {
  const page = await ctx.newPage();
  const cons = []; const net = []; let teleCons = 0; let teleNet = 0;
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) { if (TELEMETRY.test(m.text() + ' ' + (m.location()?.url || ''))) teleCons++; else cons.push(m.text().slice(0, 300)); } });
  page.on('pageerror', (e) => cons.push('Uncaught: ' + String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (/ERR_ABORTED|ERR_BLOCKED_BY_ORB|ERR_BLOCKED_BY_CLIENT/.test(f)) return; if (TELEMETRY.test(r.url())) { teleNet++; return; } net.push({ url: r.url(), error: f }); });
  page.on('response', (r) => {
    try {
      if (r.status() < 400) return;
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) return;
      net.push({ url: r.url(), status: r.status() });
    } catch { /* detached frame */ }
  });

  const nav = await gotoSafe(page, p.url);
  const ok = pageLoaded(nav);
  loaded[p.slug] = ok;
  const shot = `${evRel}/${p.slug}.png`;
  await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
  R.add({
    id: `FN-LOAD-${p.slug}`, title: 'Page loads', page: p.path, steps: `GET ${p.url}`, expected: 'HTTP < 400',
    actual: navProblem(nav), status: ok ? 'PASS' : 'FAIL',
    severity: p.type === 'home' ? 'critical' : 'high', evidence: shot,
    impact: 'Visitors reach an error instead of the page.', fix: 'Restore the page or remove/redirect links pointing to it.',
  });
  if (!ok) {
    for (const k of ['CONSOLE', 'NET']) R.add({ id: `FN-${k}-${p.slug}`, title: k === 'CONSOLE' ? 'No console errors on load' : 'No failed sub-requests', page: p.path, actual: 'Page did not load; check not performed', status: 'NOT_TESTED' });
    await page.close();
    continue;
  }
  await sleep(500);
  R.add({
    id: `FN-CONSOLE-${p.slug}`, title: 'No console errors on load', page: p.path, steps: 'Load page, listen for console errors and uncaught exceptions',
    expected: '0 errors', actual: (cons.length ? `${cons.length} error(s): ${[...new Set(cons)].slice(0, 5).join(' | ')}` : '0 errors') + (teleCons ? ` (${teleCons} Shopify telemetry error(s) ignored: usually an ad/DNS blocker on the auditor's machine)` : ''),
    status: cons.length ? 'FAIL' : 'PASS', severity: 'medium',
    impact: 'Script errors can silently break features that depend on the failing script.', fix: 'Trace each error to its script (theme or app) and fix or remove it.',
  });
  const firstParty = net.filter((n) => { try { return new URL(n.url).origin === origin; } catch { return false; } });
  R.add({
    id: `FN-NET-${p.slug}`, title: 'No failed sub-requests', page: p.path, steps: 'Load page, record failed and 4xx/5xx sub-requests',
    expected: '0 failed requests', actual: (net.length ? `${net.length} failed (${firstParty.length} first-party): ${net.slice(0, 5).map((n) => `${n.status || n.error} ${n.url.slice(0, 120)}`).join(' | ')}` : '0 failed requests') + (teleNet ? ` (${teleNet} Shopify telemetry request(s) ignored)` : ''),
    status: net.length ? 'FAIL' : 'PASS', severity: firstParty.length ? 'medium' : 'low',
    impact: 'Missing assets or failing API calls degrade the page.', fix: 'Fix or remove the reference to each failing resource.',
  });

  const inv = await page.evaluate(() => {
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const t = (e) => (e.getAttribute('aria-label') || e.textContent || e.value || e.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const pick = (sel, f) => [...document.querySelectorAll(sel)].filter(vis).slice(0, 150).map(f);
    return {
      links: pick('a[href]', (e) => ({ text: t(e), href: e.getAttribute('href') })),
      buttons: pick('button, [role="button"], input[type="submit"], input[type="button"], summary', (e) => ({ text: t(e), disabled: !!e.disabled })),
      inputs: pick('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea', (e) => ({ name: e.name, type: e.type })),
      selects: pick('select', (e) => ({ name: e.name, options: e.options.length })),
      forms: [...document.querySelectorAll('form')].slice(0, 50).map((e) => ({ action: e.getAttribute('action'), method: e.method })),
      hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.href),
    };
  });
  for (const h of inv.hrefs) {
    const n = normUrl(h, origin);
    if (!n || SKIP_LINK.test(n)) continue;
    if (new URL(n).origin !== origin && !args.external) continue;
    if (!links.has(n)) links.set(n, p.path);
  }
  delete inv.hrefs;
  inventory[p.path] = inv;
  await page.close();
}
writeEvidence(evDir, 'interactive-inventory.json', {
  note: 'Visible interactive elements per inspected page. Automatically exercised: link targets (HTTP status), search query, mobile menu toggle, add-to-cart button, cart checkout control. Everything else must be accounted for by manual FN-M*/EC-M* records.',
  pages: inventory,
});

// ---- FN-LINKS
{
  const all = [...links].slice(0, 150);
  const results = [];
  for (const [u, from] of all) {
    let status = 0; let error;
    try { const r = await ctx.request.get(u, { timeout: 20000, maxRedirects: 5 }); status = r.status(); } catch (e) { error = String(e.message).split('\n')[0]; }
    results.push({ url: u, foundOn: from, status, error });
    await sleep(100);
  }
  const BOTWALL = [401, 403, 405, 406, 429]; // auth or bot protection: the link may work in a real browser
  const broken = results.filter((r) => r.status === 0 || (r.status >= 400 && !BOTWALL.includes(r.status)));
  const unsure = results.filter((r) => BOTWALL.includes(r.status));
  writeEvidence(evDir, 'links.json', { checked: results.length, discovered: links.size, capped: links.size > 150, broken, inconclusive: unsure, results });
  R.add({
    id: 'FN-LINKS', title: `${args.external ? 'Links' : 'Internal links'} respond without error`, steps: `GET each ${args.external ? '' : 'internal '}link found on inspected pages (cap 150; cart-mutating, checkout and logout URLs skipped)`,
    expected: 'All respond < 400',
    actual: `${results.length} checked of ${links.size} found; ${broken.length} broken${broken.length ? ': ' + broken.slice(0, 8).map((b) => `${b.status || b.error} ${b.url} (on ${b.foundOn})`).join(' | ') : ''}${unsure.length ? `; ${unsure.length} inconclusive (401/403/405/406/429: auth or bot protection, check by hand)` : ''}`,
    status: !results.length ? 'NOT_TESTED' : broken.length ? 'FAIL' : 'PASS', severity: 'medium', evidence: `${evRel}/links.json`,
    impact: 'Dead links break navigation and waste crawl budget.', fix: 'Update or remove each broken link; add URL redirects for moved pages.',
  });
}

// ---- FN-SEARCH
const products = pages.filter((p) => p.type === 'product' && loaded[p.slug]);
{
  const handle = products[0]?.path.split('/products/')[1]?.split('/')[0];
  const term = handle?.split('-').find((w) => w.length >= 3) || handle;
  if (!term) R.add({ id: 'FN-SEARCH', title: 'Search returns products', actual: 'No product page in the sample to build a query from', status: 'NOT_TESTED' });
  else {
    const page = await ctx.newPage();
    const home = await gotoSafe(page, origin + '/');
    const hasForm = home.error ? false : await page.evaluate(() => !!document.querySelector('form[action*="/search"], input[name="q"], [href$="/search"], predictive-search, search-modal'));
    const nav = await gotoSafe(page, `${origin}/search?q=${encodeURIComponent(term)}`);
    const n = nav.error ? 0 : await page.evaluate(() => new Set([...document.querySelectorAll('main a[href*="/products/"], #MainContent a[href*="/products/"], a[href*="/products/"]')].map((a) => a.pathname)).size);
    const shot = `${evRel}/search.png`;
    await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
    const worked = pageLoaded(nav) && n > 0;
    R.add({
      id: 'FN-SEARCH', title: 'Search returns products', page: '/search', steps: `Look for a search entry point on the homepage; open /search?q=${term} (first word of a real product handle)`,
      expected: 'Search entry point exists; results contain product links',
      actual: `Entry point ${hasForm ? 'found' : 'NOT detected'}; results page ${navProblem(nav)}; ${n} distinct product link(s)${worked && !hasForm ? '. Results work but no search entry point was detected automatically - verify by hand.' : ''}`,
      status: worked ? (hasForm ? 'PASS' : 'NOT_TESTED') : 'FAIL', severity: 'high', evidence: shot,
      impact: 'Shoppers who search cannot find products.', fix: 'Check the search template and that products are published to the Online Store channel.',
    });
    await page.close();
  }
}

// ---- FN-NAV-MOBILE
{
  const MVP = { width: 375, height: 812 };
  const mctx = await newContext(browser, out, { viewport: MVP, hasTouch: true });
  const page = await mctx.newPage();
  const nav = await gotoSafe(page, origin + '/');
  const env = envString(browser, MVP, origin);
  const countLinks = () => page.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => {
    const b = a.getBoundingClientRect(); const s = getComputedStyle(a);
    return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.right > 0 && b.left < window.innerWidth;
  }).length);
  const sels = ['header summary[aria-label*="menu" i]', 'header button[aria-label*="menu" i]', 'header-drawer summary', 'button[aria-controls*="menu" i]', 'button[aria-controls*="nav" i]', '[class*="menu-toggle" i]', '[class*="hamburger" i]', 'summary[class*="menu" i]', 'button[class*="menu" i]', 'header [aria-label*="navigation" i]:is(button,summary)', 'button[aria-label*="menu" i]'];
  let toggle = null; let used = '';
  if (!nav.error) for (const s of sels) {
    const loc = page.locator(s);
    const c = Math.min(await loc.count(), 5);
    for (let i = 0; i < c && !toggle; i++) if (await loc.nth(i).isVisible().catch(() => false)) { toggle = loc.nth(i); used = s; }
    if (toggle) break;
  }
  if (nav.error || !toggle) {
    R.add({ id: 'FN-NAV-MOBILE', title: 'Mobile menu opens', page: '/', environment: env, actual: nav.error || 'No menu toggle matched the known selectors; test by hand', status: 'NOT_TESTED' });
  } else {
    const before = await countLinks();
    const err = await toggle.click({ timeout: 5000 }).then(() => null, (e) => String(e.message).split('\n')[0]);
    await sleep(800);
    const after = await countLinks();
    const shot = `${evRel}/mobile-menu-open.png`;
    await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
    R.add({
      id: 'FN-NAV-MOBILE', title: 'Mobile menu opens', page: '/', environment: env, steps: `At 375px, click the menu toggle (${used}) and count visible links before/after`,
      expected: 'More navigation links visible after activating the toggle',
      actual: err ? `Click failed: ${err}` : `Visible links before: ${before}, after: ${after}`,
      status: !err && after > before ? 'PASS' : 'FAIL', severity: 'high', evidence: shot,
      impact: 'Phone visitors cannot navigate the store.', fix: 'Confirm by hand first (heuristic). Then debug the drawer script/markup.',
    });
  }
  await mctx.close();
}

// ---- EC-COLLECTION
{
  const col = pages.find((p) => p.type === 'collection' && loaded[p.slug]);
  if (!col) EC({ id: 'EC-COLLECTION', title: 'Collection page lists products', actual: 'No collection page in the sample', status: 'NOT_TESTED' });
  else {
    const page = await ctx.newPage();
    await gotoSafe(page, col.url);
    const n = await page.evaluate(() => new Set([...document.querySelectorAll('a[href*="/products/"]')].map((a) => a.pathname)).size).catch(() => 0);
    EC({
      id: 'EC-COLLECTION', title: 'Collection page lists products', page: col.path, steps: `Open ${col.path}, count distinct product links`, expected: '>= 1 product link',
      actual: `${n} distinct product link(s)`, status: n > 0 ? 'PASS' : 'FAIL', severity: 'high', evidence: `${evRel}/${col.slug}.png`,
      impact: 'Shoppers cannot browse from this collection to a product.', fix: 'Check the collection has published products and the product grid renders.',
    });
    await page.close();
  }
}

// ---- EC-PDP + EC-ATC + EC-CART + EC-CHECKOUT-REACH
const cartCount = async () => {
  try { const r = await ctx.request.get(origin + '/cart.js', { timeout: 15000 }); return r.ok() ? (await r.json()).item_count : null; } catch { return null; }
};
const ADD_BTN = 'form[action*="/cart/add"] [type="submit"], form[action*="/cart/add"] button[name="add"]';
let added = null; const atcLog = [];
{
  const page = await ctx.newPage();
  for (const p of products.slice(0, 3)) {
    await gotoSafe(page, p.url);
    const f = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const priceEl = [...main.querySelectorAll('[class*="price" i], [itemprop="price"], [data-price]')].find((e) => /\d/.test(e.textContent || e.getAttribute('content') || ''));
      const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
      const btn = document.querySelector('form[action*="/cart/add"] [type="submit"], form[action*="/cart/add"] button[name="add"]');
      return {
        title: (document.querySelector('main h1, h1')?.textContent || '').trim().slice(0, 80),
        price: priceEl ? (priceEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) : (metaPrice?.content || ''),
        media: [...main.querySelectorAll('img, video, model-viewer')].length,
        control: !!btn, disabled: btn ? !!btn.disabled : null,
      };
    }).catch(() => ({ title: '', price: '', media: 0, control: false }));
    const missing = [!f.title && 'title', !f.price && 'price', !f.media && 'media', !f.control && 'purchase control'].filter(Boolean);
    EC({
      id: `EC-PDP-${p.slug}`, title: 'Product page shows title, price, media and purchase control', page: p.path, steps: `Open ${p.path}; read h1, price element, media count, add-to-cart form`,
      expected: 'All four present', actual: `title "${f.title}", price "${f.price}", media ${f.media}, purchase control ${f.control ? (f.disabled ? 'present (disabled: sold out or unavailable)' : 'present') : 'missing'}${missing.length ? ` - missing: ${missing.join(', ')}` : ''}`,
      status: missing.length ? 'FAIL' : 'PASS', severity: 'high', evidence: `${evRel}/${p.slug}.png`,
      impact: 'Shoppers lack information or the control needed to buy.', fix: 'Restore the missing block in the product template.',
    });
    if (added || retest && args['no-cart']) continue;
    const before = await cartCount();
    if (before === null) { atcLog.push(`${p.path}: /cart.js not available`); continue; }
    const loc = page.locator(ADD_BTN);
    let btn = null;
    for (let i = 0; i < Math.min(await loc.count(), 5); i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => false)) { btn = el; break; }
    }
    if (!btn) { atcLog.push(`${p.path}: no enabled add-to-cart button (sold out or custom form)`); continue; }
    const err = await btn.click({ timeout: 8000 }).then(() => null, (e) => String(e.message).split('\n')[0]);
    let after = before;
    for (let i = 0; i < 16 && after <= before; i++) { await sleep(500); const c = await cartCount(); if (c !== null) after = c; }
    atcLog.push(`${p.path}: item_count ${before} -> ${after}${err ? ` (click error: ${err})` : ''}`);
    if (after > before) added = { ...p, title: f.title };
    else atcLog.clicked = true;
  }
  if (!products.length) {
    for (const [id, t] of [['EC-ATC', 'Add to cart works'], ['EC-CART', 'Cart shows the added item'], ['EC-CHECKOUT-REACH', 'Checkout is reachable from the cart']]) EC({ id, title: t, core: true, actual: 'No product page in the sample', status: 'NOT_TESTED' });
  } else {
    EC({
      id: 'EC-ATC', title: 'Add to cart works', core: true, page: added?.path || products[0].path, steps: 'Read /cart.js item_count; click the add-to-cart button; poll /cart.js for up to 8 s (up to 3 products tried)',
      expected: 'item_count increases', actual: atcLog.join(' ; '),
      status: added ? 'PASS' : atcLog.clicked ? 'FAIL' : 'BLOCKED', severity: 'critical',
      impact: 'Nobody can buy: the purchase journey stops at the product page.', fix: 'Reproduce by hand; check the product form script, variant availability and console errors on the product page.',
    });
    if (!added) {
      for (const [id, t] of [['EC-CART', 'Cart shows the added item'], ['EC-CHECKOUT-REACH', 'Checkout is reachable from the cart']]) EC({ id, title: t, core: true, actual: 'Precondition failed: nothing could be added to the cart', status: 'BLOCKED' });
    } else {
      const nav = await gotoSafe(page, origin + '/cart');
      const handle = added.path.split('/products/')[1].split('/')[0];
      const c = await page.evaluate(({ handle, title }) => {
        const main = document.querySelector('main') || document.body;
        return { link: !!main.querySelector(`a[href*="/products/${handle}"]`), text: !!title && main.innerText.toLowerCase().includes(title.toLowerCase()) };
      }, { handle, title: added.title }).catch(() => ({ link: false, text: false }));
      const shot = `${evRel}/cart-with-item.png`;
      await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
      const okCart = pageLoaded(nav) && (c.link || c.text);
      EC({
        id: 'EC-CART', title: 'Cart shows the added item', core: true, page: '/cart', preconditions: 'One item added by EC-ATC', steps: 'Open /cart; look for the added product (link or title)',
        expected: 'Line item visible', actual: `${navProblem(nav)}; product link ${c.link ? 'found' : 'not found'}; title text ${c.text ? 'found' : 'not found'}`,
        status: okCart ? 'PASS' : 'FAIL', severity: 'critical', evidence: shot,
        impact: 'Shoppers cannot review their order before checkout.', fix: 'Check the cart template renders line items.',
      });
      // Checkout entry. Nothing is typed or submitted on the checkout itself.
      const ck = page.locator('button[name="checkout"], input[name="checkout"], a[href*="/checkout"]');
      let ctl = null;
      for (let i = 0; i < Math.min(await ck.count(), 6); i++) {
        const el = ck.nth(i);
        if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => false)) { ctl = el; break; }
      }
      let via = 'cart control'; let clickErr = null;
      if (ctl) {
        clickErr = await ctl.click({ timeout: 8000 }).then(() => null, (e) => String(e.message).split('\n')[0]);
        await page.waitForURL((u) => isCheckoutUrl(u.toString()), { timeout: 25000 }).catch(() => {});
      }
      let reachedByControl = isCheckoutUrl(page.url());
      if (!reachedByControl) {
        via = 'direct /checkout URL';
        await page.goto(origin + '/checkout', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForURL((u) => isCheckoutUrl(u.toString()) && !/\/checkout\/?$/.test(u.pathname), { timeout: 10000 }).catch(() => {});
      }
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      const final = page.url();
      const reached = isCheckoutUrl(final);
      EC({
        id: 'EC-CHECKOUT-REACH', title: 'Checkout is reachable from the cart', core: true, page: '/cart', preconditions: 'One item in cart', steps: 'Click the checkout control on /cart (fallback: open /checkout). Stop at the first checkout page; enter nothing.',
        expected: 'Browser lands on a checkout URL',
        actual: `${ctl ? `Control clicked${clickErr ? ` (error: ${clickErr})` : ''}` : 'No enabled checkout control found on /cart (terms checkbox or drawer-only cart?)'}; final URL via ${via}: ${redact(final)}`,
        status: reachedByControl ? 'PASS' : reached ? 'NOT_TESTED' : 'FAIL', severity: 'critical',
        impact: 'Shoppers cannot start checkout.', fix: 'Reproduce by hand; check the cart form, checkout button and any script intercepting the submit.',
      });
    }
  }
  await page.close();
}

// ---- EC-VARIANT + EC-PRICE-UPDATE + EC-QTY (product form behaviour)
const noCart = retest && args['no-cart'];
const cartJs = async () => {
  try { const r = await ctx.request.get(origin + '/cart.js', { timeout: 15000 }); return r.ok() ? await r.json() : null; } catch { return null; }
};
const pollCart = async (pred) => {
  let c = await cartJs();
  for (let i = 0; i < 16 && c && !pred(c); i++) { await sleep(500); c = await cartJs(); }
  return c;
};
// "$1,234.56" / "1.234,56 €" / "$30" -> cents; null if no number
const toCents = (s) => {
  const m = String(s).match(/\d[\d.,\s]*\d|\d/);
  if (!m) return null;
  const t = m[0].replace(/\s/g, '');
  return /[.,]\d\d$/.test(t) ? Number(t.replace(/\D/g, '')) : Number(t.replace(/\D/g, '')) * 100;
};
{
  let vp = null;
  for (const p of products.slice(0, 5)) {
    const handle = p.path.split('/products/')[1]?.split('/')[0];
    if (!handle) continue;
    try {
      const r = await ctx.request.get(`${origin}/products/${handle}.js`, { timeout: 15000 });
      const j = r.ok() ? await r.json() : null;
      const vs = (j?.variants || []).filter((v) => v.available !== false);
      if (vs.length > 1) { vp = { ...p, handle, variants: vs }; break; }
    } catch { /* not JSON */ }
  }
  const page = await ctx.newPage();
  if (!products.length) {
    for (const [id, t] of [['EC-VARIANT', 'Variant selection changes the selected variant'], ['EC-PRICE-UPDATE', 'Price updates when the variant changes']]) EC({ id, title: t, actual: 'No product page in the sample', status: 'NOT_TESTED' });
  } else if (!vp) {
    for (const [id, t] of [['EC-VARIANT', 'Variant selection changes the selected variant'], ['EC-PRICE-UPDATE', 'Price updates when the variant changes']]) EC({ id, title: t, actual: `None of the sampled products has more than one available variant (/products/{handle}.js)`, status: 'N/A' });
  } else {
    await gotoSafe(page, vp.url);
    const readState = () => page.evaluate(() => {
      const form = document.querySelector('form[action*="/cart/add"]');
      const main = document.querySelector('main') || document.body;
      const priceEl = [...main.querySelectorAll('[class*="price" i], [itemprop="price"], [data-price]')].find((e) => e.offsetParent !== null && /\d/.test(e.textContent || ''));
      return { id: form?.querySelector('[name="id"]')?.value || '', price: (priceEl?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
    }).catch(() => ({ id: '', price: '' }));
    const before = await readState();
    // Change the variant the way a shopper would: a select (the id select itself or an option select), else an unchecked radio.
    const changeVariant = async () => {
      const sel = page.locator('form[action*="/cart/add"] select:visible, variant-selects select:visible, variant-radios select:visible').first();
      if (await sel.count()) {
        const opts = await sel.evaluate((s) => [...s.options].filter((o) => !o.disabled).map((o) => o.value)).catch(() => []);
        const cur = await sel.inputValue().catch(() => '');
        const next = opts.find((v) => v !== cur);
        if (next != null) { await sel.selectOption(next).catch(() => {}); return `select -> "${next}"`; }
      }
      const radio = page.locator('form[action*="/cart/add"] input[type="radio"]:not(:checked), variant-radios input[type="radio"]:not(:checked), fieldset input[type="radio"]:not(:checked)').first();
      if (await radio.count()) {
        const r = await radio.check({ timeout: 5000, force: true }).then(() => null, (e) => String(e.message).split('\n')[0]);
        return r ? null : 'radio';
      }
      return null;
    };
    // Wait up to 3 s for the theme to update the form, instead of a fixed pause.
    const settle = async (b) => { let a = await readState(); for (let t = 0; t < 10 && a.id === b.id; t++) { await sleep(300); a = await readState(); } return a; };
    let how = await changeVariant();
    let after = await settle(before);
    let attempts = 1;
    if (how && after.id === before.id) {
      // One retry from a freshly loaded page before reporting a FAIL: a real defect fails twice, a flaky one does not.
      attempts = 2;
      await gotoSafe(page, vp.url);
      const b2 = await readState();
      how = (await changeVariant()) || how;
      after = await settle(b2);
      if (after.id !== b2.id) Object.assign(before, b2);
    }
    const retryNote = attempts === 2 ? (after.id !== before.id ? ' (passed on retry; the first attempt did not change the variant: possibly flaky)' : ' (reproduced on a retry from a fresh page)') : '';
    const shot = `${evRel}/variant-${vp.slug}.png`;
    await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
    if (!how) {
      EC({ id: 'EC-VARIANT', title: 'Variant selection changes the selected variant', page: vp.path, actual: `${vp.variants.length} variants in /products/${vp.handle}.js but no visible select or radio picker in the product form`, status: 'BLOCKED', severity: 'high', evidence: shot });
      EC({ id: 'EC-PRICE-UPDATE', title: 'Price updates when the variant changes', page: vp.path, actual: 'Precondition failed: the variant could not be changed', status: 'BLOCKED' });
    } else {
      const changed = !!after.id && after.id !== before.id;
      EC({
        id: 'EC-VARIANT', title: 'Variant selection changes the selected variant', page: vp.path, steps: `Open ${vp.path}; change the variant picker (${how}); read the form's [name=id]`,
        expected: 'The submitted variant id changes', actual: `variant id "${before.id}" -> "${after.id}"${retryNote}`, attempts,
        status: changed ? 'PASS' : 'FAIL', severity: 'high', evidence: shot,
        impact: 'Shoppers may buy a different size or colour than the one they picked.', fix: 'Check the variant picker script updates the hidden id input (console errors, custom picker app).',
      });
      const pBefore = vp.variants.find((v) => String(v.id) === String(before.id))?.price;
      const pAfter = vp.variants.find((v) => String(v.id) === String(after.id))?.price;
      if (!changed) EC({ id: 'EC-PRICE-UPDATE', title: 'Price updates when the variant changes', page: vp.path, actual: 'Precondition failed: the variant did not change', status: 'BLOCKED' });
      else if (pBefore == null || pAfter == null || pBefore === pAfter) EC({ id: 'EC-PRICE-UPDATE', title: 'Price updates when the variant changes', page: vp.path, actual: `The two variants compared have the same (or unknown) price: ${pBefore} / ${pAfter} cents`, status: 'NOT_TESTED' });
      else {
        const shown = toCents(after.price);
        EC({
          id: 'EC-PRICE-UPDATE', title: 'Price updates when the variant changes', page: vp.path, steps: `Change the variant (${how}); read the visible price`,
          expected: `Visible price shows ${(pAfter / 100).toFixed(2)}`, actual: `price "${before.price}" -> "${after.price}" (variant price ${pBefore} -> ${pAfter} cents)`,
          status: shown === pAfter ? 'PASS' : 'FAIL', severity: 'high', evidence: shot,
          impact: 'Shoppers see one price and are charged another.', fix: 'Check the variant change handler re-renders the price block.',
        });
      }
    }
  }
  // EC-QTY: set quantity 2 on a product form and add once.
  const qp = vp || added;
  if (!products.length) EC({ id: 'EC-QTY', title: 'Quantity selector adds the chosen quantity', actual: 'No product page in the sample', status: 'NOT_TESTED' });
  else if (noCart) EC({ id: 'EC-QTY', title: 'Quantity selector adds the chosen quantity', actual: 'Skipped: --no-cart on retest', status: 'NOT_TESTED' });
  else if (!qp) EC({ id: 'EC-QTY', title: 'Quantity selector adds the chosen quantity', actual: 'Precondition failed: no product could be added to the cart (EC-ATC)', status: 'BLOCKED' });
  else {
    await gotoSafe(page, qp.url);
    const qty = page.locator('form[action*="/cart/add"] input[name="quantity"]:visible, quantity-input input:visible').first();
    if (!await qty.count()) EC({ id: 'EC-QTY', title: 'Quantity selector adds the chosen quantity', page: qp.path, actual: 'No visible quantity input on the product page', status: 'N/A' });
    else {
      const c0 = await cartJs();
      await qty.fill('2').catch(() => {});
      const btn = page.locator(ADD_BTN).first();
      const err = await btn.click({ timeout: 8000 }).then(() => null, (e) => String(e.message).split('\n')[0]);
      const c1 = c0 ? await pollCart((c) => c.item_count >= c0.item_count + 2) : null;
      const delta = c0 && c1 ? c1.item_count - c0.item_count : null;
      EC({
        id: 'EC-QTY', title: 'Quantity selector adds the chosen quantity', page: qp.path, steps: `Open ${qp.path}; set quantity to 2; click add to cart; poll /cart.js`,
        expected: 'item_count rises by 2', actual: delta == null ? '/cart.js not available' : `item_count ${c0.item_count} -> ${c1.item_count} (+${delta})${err ? ` (click error: ${err})` : ''}`,
        status: delta == null ? 'BLOCKED' : delta === 2 ? 'PASS' : 'FAIL', severity: 'medium',
        impact: 'Shoppers buying several units get the wrong quantity.', fix: 'Check the quantity input is inside the product form and named "quantity".',
      });
    }
  }
  await page.close();
}

// ---- EC-CART-TOTAL + EC-CART-UPDATE + EC-CART-REMOVE (on the throwaway cart)
{
  const ids = [['EC-CART-TOTAL', 'Cart total matches its lines'], ['EC-CART-UPDATE', 'Changing a cart quantity updates the cart'], ['EC-CART-REMOVE', 'Removing a cart line empties it']];
  const start = noCart ? null : await cartJs();
  if (noCart) for (const [id, t] of ids) EC({ id, title: t, actual: 'Skipped: --no-cart on retest', status: 'NOT_TESTED' });
  else if (!start || !start.items?.length) for (const [id, t] of ids) EC({ id, title: t, actual: start ? 'Precondition failed: the cart is empty (EC-ATC did not add anything)' : '/cart.js not available', status: 'BLOCKED' });
  else {
    const page = await ctx.newPage();
    // Totals: the JSON lines add up, and the cart page shows the same total.
    const lineSum = start.items.reduce((s, i) => s + (i.final_line_price ?? i.line_price ?? i.price * i.quantity), 0);
    await gotoSafe(page, origin + '/cart');
    const amounts = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return (main.innerText.match(/\d[\d.,\s]*\d|\d/g) || []).slice(0, 400);
    }).catch(() => []);
    const shownTotal = amounts.map(toCents).includes(start.total_price);
    const shot = `${evRel}/cart-totals.png`;
    await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
    EC({
      id: 'EC-CART-TOTAL', title: 'Cart total matches its lines', page: '/cart', preconditions: 'Items added by EC-ATC / EC-QTY', steps: 'Read /cart.js; sum line prices; compare with total_price and with the amounts shown on /cart',
      expected: 'Sum of lines = total_price, and the total is shown on /cart', actual: `lines ${lineSum} cents, total_price ${start.total_price} cents${start.total_discount ? ` (discount ${start.total_discount})` : ''}; total ${shownTotal ? '' : 'NOT '}found on /cart`,
      status: lineSum === start.total_price && shownTotal ? 'PASS' : 'FAIL', severity: 'high', evidence: shot,
      impact: 'Shoppers see a total that does not match what they will pay.', fix: 'Check the cart template prints cart.total_price and that discount apps adjust lines consistently.',
    });
    // Update: change line 1 through the cart page's own quantity input; fall back to /cart/change.js.
    const l1 = start.items[0]; const target = l1.quantity + 1;
    let via = 'cart page quantity input';
    const plus = page.locator('main button[name="plus"]:visible, main quantity-selector-component button:visible[aria-label*="ncrease" i], main quantity-input button:visible[name="plus"]').first();
    const qIn = page.locator('main input[name="updates[]"]:visible, main input[name^="updates"]:visible, main quantity-input input:visible').first();
    if (await plus.count()) {
      via = 'cart page + button';
      await plus.click({ timeout: 8000 }).catch(() => {});
    } else if (await qIn.count()) {
      await qIn.fill(String(target)).catch(() => {});
      const upd = page.locator('main [type="submit"][name="update"], main button[name="update"]').first();
      if (await upd.count() && await upd.isVisible().catch(() => false)) await upd.click({ timeout: 8000 }).catch(() => {});
      else await qIn.dispatchEvent('change').catch(() => {});
    } else via = null;
    let c = await pollCart((x) => x.items?.[0]?.quantity === target);
    if (!c || c.items?.[0]?.quantity !== target) {
      via = via ? `${via} (no effect) -> /cart/change.js` : '/cart/change.js (no quantity input on /cart)';
      await ctx.request.post(origin + '/cart/change.js', { data: { line: 1, quantity: target }, timeout: 15000 }).catch(() => {});
      c = await cartJs();
    }
    const updOk = c?.items?.[0]?.quantity === target;
    const uiOk = updOk && !/change\.js/.test(via);
    EC({
      id: 'EC-CART-UPDATE', title: 'Changing a cart quantity updates the cart', page: '/cart', preconditions: 'Item in cart', steps: `Set line 1 quantity ${l1.quantity} -> ${target} via ${via}; read /cart.js`,
      expected: `Line 1 quantity ${target}, total recalculated`,
      actual: `line 1 quantity ${c?.items?.[0]?.quantity ?? '?'}, total_price ${start.total_price} -> ${c?.total_price ?? '?'} via ${via}` + (updOk && !uiOk ? '. The cart API works, but the cart page control had no effect under automation: check the +/- control by hand before reporting a defect.' : ''),
      status: uiOk ? 'PASS' : updOk ? 'BLOCKED' : 'FAIL', severity: uiOk || updOk ? null : 'high',
      impact: 'Shoppers cannot adjust quantities before checkout.', fix: updOk ? 'The cart API works but the theme cart quantity control did not: check the cart quantity script.' : 'Check the cart quantity control and /cart/change.',
    });
    // Remove: the cart page's own remove control; fall back to /cart/change.js quantity 0.
    await gotoSafe(page, origin + '/cart');
    const before = await cartJs();
    const key = before?.items?.[0]?.key;
    const rm = page.locator('main a[href*="/cart/change"][href*="quantity=0"], main cart-remove-button a, main cart-remove-button button, main button[aria-label*="remove" i], main a[aria-label*="remove" i]').first();
    let rvia = 'cart page remove control';
    if (await rm.count()) await rm.click({ timeout: 8000 }).catch(() => {}); else rvia = null;
    let c2 = await pollCart((x) => !x.items?.some((i) => i.key === key));
    let gone = c2 && !c2.items.some((i) => i.key === key);
    if (!gone) {
      rvia = rvia ? `${rvia} (no effect) -> /cart/change.js` : '/cart/change.js (no remove control on /cart)';
      await ctx.request.post(origin + '/cart/change.js', { data: { line: 1, quantity: 0 }, timeout: 15000 }).catch(() => {});
      c2 = await cartJs(); gone = c2 && !c2.items.some((i) => i.key === key);
    }
    EC({
      id: 'EC-CART-REMOVE', title: 'Removing a cart line empties it', page: '/cart', preconditions: 'Item in cart', steps: `Remove line 1 via ${rvia}; read /cart.js`,
      expected: 'Line removed, item_count drops', actual: `item_count ${before?.item_count ?? '?'} -> ${c2?.item_count ?? '?'}; line ${gone ? 'removed' : 'still present'}`,
      status: gone && !/change\.js/.test(rvia) ? 'PASS' : 'FAIL', severity: 'high',
      impact: 'Shoppers cannot take an unwanted item out of the cart.', fix: gone ? 'The cart API works but the theme remove control did not: check the cart remove script.' : 'Check the cart remove control and /cart/change.',
    });
    await page.close();
  }
}

writeResults(out, 'functional', R.records, { pages: pages.map((p) => p.path), linksChecked: Math.min(links.size, 150) }, retest);
await browser.close();

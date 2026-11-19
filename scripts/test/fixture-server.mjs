#!/usr/bin/env node
// Local fake Shopify storefront for the selftest. It has known-good and known-bad pages so the
// collectors can be checked against planted defects. Nothing here talks to a real store.
// usage (standalone): node fixture-server.mjs [--port 4599] [--locked]
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// Fake credential, assembled at runtime so no token-shaped string sits in this file.
const TELEMETRY_NOISE = '<script>console.error("[bugsnag] Session failed to send");fetch("https://monorail-edge.shopifysvc.com/v1/produce",{method:"POST",mode:"no-cors"}).catch(()=>{});</script>'; // Shopify telemetry that ad blockers refuse: must not count as a store defect
export const FAKE_TOKEN = 'shp' + 'at_' + 'a1b2c3d4'.repeat(4);
export const UNLOCK_DIGEST = 'selftest-unlocked';
const PRODUCTS = {
  'good-tee': { title: 'Good Tee', price: '25.00', desc: 'A plain cotton tee used as the clean reference product in the audit fixture store.' },
  'bad-mug': { title: 'Bad Mug', price: '12.00', desc: 'A mug page with planted defects for the audit fixture store selftest run.' },
};
// Cart lines are keyed by variant id. good-tee has two variants with different prices so the
// variant-selection, price-update and cart-total checks have something to exercise.
const VARIANTS = {
  'good-tee': { product: 'good-tee', title: 'Good Tee - Small', price: '25.00' },
  'good-tee-l': { product: 'good-tee', title: 'Good Tee - Large', price: '30.00' },
  'bad-mug': { product: 'bad-mug', title: 'Bad Mug', price: '12.00' },
};
const cents = (v) => Math.round(Number(VARIANTS[v].price) * 100);
const CSS = `body{font:16px/1.5 system-ui,sans-serif;color:#111;background:#fff;margin:0}
a{color:#0645ad}a,button,input{display:inline-block;min-height:32px;min-width:32px;font-size:16px;box-sizing:border-box;max-width:100%}
:focus-visible{outline:3px solid #0645ad;outline-offset:2px}
.skip{position:absolute;left:-9999px}.skip:focus{left:8px;top:8px;background:#fff;padding:4px 8px}
header,main,footer{padding:12px 16px}header{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
nav{display:flex;flex-wrap:wrap;gap:12px}.menu-toggle{display:none}ul{padding-left:20px}li{margin:6px 0}
#q{width:150px}img{max-width:100%;height:auto}
@media(max-width:749px){.menu-toggle{display:inline-block}nav{display:none;width:100%}nav.open{display:flex}}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const layout = (base, pathname, { title, desc, head = '', body, robots = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${desc ? `\n<meta name="description" content="${esc(desc)}">` : ''}${robots ? `\n<meta name="robots" content="${robots}">` : ''}
<link rel="canonical" href="${base}${pathname}"><link rel="icon" href="data:,">
<meta property="og:title" content="${esc(title)}"><meta property="og:url" content="${base}${pathname}"><meta property="og:type" content="website"><meta property="og:image" content="${base}/img.svg">
<style>${CSS}</style>
<script>window.Shopify={shop:'fixture-store.myshopify.com',theme:{name:'Fixture Theme',id:1},currency:{active:'USD'},locale:'en'};</script>${head}
</head><body><a class="skip" href="#main">Skip to content</a>
<header><a href="/">Fixture Store</a>
<button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" onclick="var n=document.getElementById('nav');var o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">Menu</button>
<nav id="nav" aria-label="Main"><a href="/collections/all">Shop all</a><a href="/pages/contact">Contact</a><a href="/cart">Cart</a></nav>
<form action="/search" method="get" role="search"><label for="q">Search</label> <input id="q" name="q" type="search"> <button type="submit">Search</button></form></header>
<main id="main">${body}</main>
<footer><a href="/policies/privacy-policy">Privacy policy</a> <a href="/pages/contact">Contact us</a></footer></body></html>`;

const productCard = (h) => `<li><a href="/products/${h}">${PRODUCTS[h].title}</a> <span class="price">$${PRODUCTS[h].price}</span></li>`;
const cartForm = (h) => `<form action="/cart/add" method="post"><input type="hidden" name="id" value="${h}"><button type="submit" name="add">Add to cart</button></form>`;
const variantForm = (h) => {
  const vs = Object.entries(VARIANTS).filter(([, v]) => v.product === h);
  return `<form action="/cart/add" method="post"><p><label for="variant">Size</label> <select id="variant" name="id" onchange="document.querySelector('main .price').textContent='$'+this.selectedOptions[0].dataset.price">${vs.map(([id, v]) => `<option value="${id}" data-price="${v.price}">${v.title.split(' - ')[1]}</option>`).join('')}</select></p>
<p><label for="qty">Quantity</label> <input type="number" id="qty" name="quantity" value="1" min="1"></p><button type="submit" name="add">Add to cart</button></form>`;
};

function productPage(base, h, fixed) {
  const p = PRODUCTS[h];
  if (h === 'good-tee') {
    const ld = [{ '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: `${base}/img.svg`, description: p.desc, offers: { '@type': 'Offer', price: p.price, priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${base}/products/${h}` } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` }, { '@type': 'ListItem', position: 2, name: p.title, item: `${base}/products/${h}` }] }];
    return layout(base, `/products/${h}`, { title: 'Good Tee | Fixture Store', desc: p.desc, head: ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('') + TELEMETRY_NOISE,
      body: `<h1>${p.title}</h1><img src="/img.svg" alt="Good Tee in white" width="200" height="200"><p class="price">$${p.price}</p><p>Soft cotton tee. Ships in two days.</p>${variantForm(h)}` });
  }
  return layout(base, `/products/${h}`, { title: 'Bad Mug | Fixture Store', desc: fixed ? p.desc : '',
    head: `<script>var cfg={token:"${FAKE_TOKEN}"};console.error("fixture: simulated console error");</script><script>throw new Error("fixture: simulated uncaught error")</script>`,
    body: `<h1>${p.title}</h1><h1>Second main heading</h1><img src="/img.svg" width="200" height="200"><p class="price">$${p.price}</p>
<p style="color:#bbb">This low-contrast sentence is a planted accessibility defect.</p>
<div style="width:600px;background:#eee;padding:8px">Fixed 600px block that overflows on phones.</div>
<p><input type="text" name="engraving"></p>${cartForm(h)}` });
}

const parseCart = (req) => {
  const m = /(?:^|;\s*)cart=([^;]*)/.exec(req.headers.cookie || '');
  const cart = {};
  if (m) for (const part of decodeURIComponent(m[1]).split('|')) { const [h, q] = part.split(':'); if (VARIANTS[h] && Number(q) > 0) cart[h] = Number(q); }
  return cart;
};
const cartCookie = (cart) => `cart=${encodeURIComponent(Object.entries(cart).map(([h, q]) => `${h}:${q}`).join('|'))}; Path=/; HttpOnly; SameSite=Lax`;
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 1e5) req.destroy(); }); req.on('end', () => resolve(b)); req.on('error', () => resolve('')); });
const field = (body, type, name) => {
  if (/json/.test(type)) { try { const j = JSON.parse(body); return j[name] ?? j.items?.[0]?.[name]; } catch { return undefined; } }
  if (/multipart/.test(type)) return new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(body)?.[1];
  return new URLSearchParams(body).get(name) ?? undefined;
};

export async function start({ locked = false, port = 0 } = {}) {
  const state = { fixed: false };
  const server = http.createServer(async (req, res) => {
    const base = `http://${req.headers.host}`;
    const u = new URL(req.url, base);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const send = (code, type, body, headers = {}) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', ...headers }); res.end(body); };
    const html = (body, code = 200, headers = {}) => send(code, 'text/html; charset=utf-8', body, headers);
    const go = (to, headers = {}) => { res.writeHead(302, { location: to, ...headers }); res.end(); };

    if (p === '/favicon.ico') return send(204, 'image/x-icon', '');
    if (p === '/img.svg') return send(200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ccd"/></svg>');
    // Locked mode mirrors Shopify: a storefront_digest cookie (set after the owner enters the
    // password) unlocks the store. The selftest plants that cookie in a saved session file,
    // the same file auth-session.mjs writes, to prove the collectors use it.
    const unlocked = new RegExp(`(?:^|;\\s*)storefront_digest=${UNLOCK_DIGEST}(?:;|$)`).test(req.headers.cookie || '');
    if (locked && !unlocked) {
      if (p === '/password' && req.method === 'POST') return go('/', { 'set-cookie': `storefront_digest=${UNLOCK_DIGEST}; Path=/; HttpOnly` });
      if (p !== '/password') return go('/password');
      return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opening soon</title></head><body><h1>Opening soon</h1><form method="post" action="/password"><label for="password">Password</label> <input id="password" type="password" name="password"> <button type="submit">Enter</button></form></body></html>`);
    }
    if (p === '/robots.txt') return send(200, 'text/plain', `User-agent: *\nDisallow: /cart\nDisallow: /checkout\nDisallow: /checkouts/\nSitemap: ${base}/sitemap.xml\n`);
    if (p === '/agents.md') return send(200, 'text/markdown', '# Fixture Store\nInstructions for AI agents (not a web page).\n');
    if (p === '/sitemap.xml') {
      const paths = ['/', '/products/good-tee', '/products/bad-mug', '/collections/all', '/pages/contact', '/policies/privacy-policy', '/agents.md'];
      return send(200, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((x) => `<url><loc>${base}${x}</loc></url>`).join('')}</urlset>`);
    }
    if (p === '/') return html(layout(base, '/', { title: 'Fixture Store | Tees and Mugs', desc: 'Fixture storefront used to self-test the Shopify audit collectors against planted defects.',
      body: `<h1>Welcome to Fixture Store</h1><p>Two products, one clean and one full of planted defects.</p><ul>${Object.keys(PRODUCTS).map(productCard).join('')}<li><a href="/collections/all">Browse the full collection</a></li><li><a href="/pages/broken">Old lookbook</a></li></ul>` }));
    if (p === '/collections/all') return html(layout(base, p, { title: 'All Products | Fixture Store', desc: 'Every product in the fixture storefront, listed for the collection page checks.', body: `<h1>All products</h1><ul>${Object.keys(PRODUCTS).map(productCard).join('')}</ul>` }));
    if (p.startsWith('/products/') && p.endsWith('.js') && PRODUCTS[p.slice(10, -3)]) {
      const h = p.slice(10, -3);
      return send(200, 'application/json', JSON.stringify({ handle: h, title: PRODUCTS[h].title, variants: Object.entries(VARIANTS).filter(([, v]) => v.product === h).map(([id, v]) => ({ id, title: v.title, price: cents(id) })) }));
    }
    if (p.startsWith('/products/') && PRODUCTS[p.slice(10)]) return html(productPage(base, p.slice(10), state.fixed));
    if (p === '/pages/contact') return html(layout(base, p, { title: 'Contact Us | Fixture Store', desc: 'How to contact the fixture store team. This page exists for navigation and policy link checks.', body: '<h1>Contact us</h1><p>Email support at the address printed on your order confirmation.</p>' }));
    if (p === '/policies/privacy-policy') return html(layout(base, p, { title: 'Privacy Policy | Fixture Store', desc: 'The privacy policy of the fixture store, present so that the policy link checks have a target.', body: '<h1>Privacy policy</h1><p>This fixture collects no personal data.</p>' }));
    if (p === '/search') {
      const q = (u.searchParams.get('q') || '').toLowerCase().trim();
      const hits = q ? Object.keys(PRODUCTS).filter((h) => h.includes(q) || PRODUCTS[h].title.toLowerCase().includes(q)) : [];
      return html(layout(base, '/search', { title: 'Search Results | Fixture Store', desc: 'Search results page of the fixture storefront used by the functional search check.', robots: 'noindex', body: `<h1>Search</h1><p>${hits.length} result(s)</p><ul>${hits.map(productCard).join('')}</ul>` }));
    }
    const cartJson = (cart) => {
      const items = Object.entries(cart).map(([v, q]) => ({ id: v, variant_id: v, key: v, handle: VARIANTS[v].product, title: VARIANTS[v].title, quantity: q, price: cents(v), line_price: cents(v) * q, url: `/products/${VARIANTS[v].product}` }));
      return { token: 'fixture', currency: 'USD', item_count: items.reduce((a, i) => a + i.quantity, 0), total_price: items.reduce((a, i) => a + i.line_price, 0), items };
    };
    if (p === '/cart.js') return send(200, 'application/json', JSON.stringify(cartJson(parseCart(req))));
    if ((p === '/cart/add' || p === '/cart/add.js') && req.method === 'POST') {
      const body = await readBody(req); const type = req.headers['content-type'] || '';
      const h = String(field(body, type, 'id') ?? ''); const q = Number(field(body, type, 'quantity') ?? 1) || 1;
      if (!VARIANTS[h]) return send(422, 'application/json', JSON.stringify({ status: 422, message: 'Cart Error', description: 'Unknown variant' }));
      const cart = parseCart(req); cart[h] = (cart[h] || 0) + q;
      if (p.endsWith('.js')) return send(200, 'application/json', JSON.stringify({ id: h, handle: VARIANTS[h].product, quantity: cart[h], title: VARIANTS[h].title }), { 'set-cookie': cartCookie(cart) });
      return go('/cart', { 'set-cookie': cartCookie(cart) });
    }
    // /cart/change(.js): {id | line (1-based), quantity}; quantity 0 removes the line. /cart/update: updates[] in line order.
    if (p === '/cart/change' || p === '/cart/change.js') {
      const body = req.method === 'POST' ? await readBody(req) : ''; const type = req.headers['content-type'] || '';
      const get = (n) => (body ? field(body, type, n) : undefined) ?? u.searchParams.get(n) ?? undefined;
      const cart = parseCart(req); const keys = Object.keys(cart);
      const line = Number(get('line')); const id = get('id') != null ? String(get('id')) : (line >= 1 ? keys[line - 1] : undefined);
      const q = Number(get('quantity'));
      if (!id || !(id in cart) || !Number.isFinite(q) || q < 0) return send(400, 'application/json', JSON.stringify({ status: 400, message: 'Bad cart change' }));
      if (q === 0) delete cart[id]; else cart[id] = q;
      if (p.endsWith('.js')) return send(200, 'application/json', JSON.stringify(cartJson(cart)), { 'set-cookie': cartCookie(cart) });
      return go('/cart', { 'set-cookie': cartCookie(cart) });
    }
    if (p === '/cart/update' && req.method === 'POST') {
      const body = await readBody(req); const cart = parseCart(req); const keys = Object.keys(cart); const sp = new URLSearchParams(body);
      sp.getAll('updates[]').forEach((v, i) => { const k = keys[i]; const q = Number(v); if (k && Number.isFinite(q) && q >= 0) { if (q === 0) delete cart[k]; else cart[k] = q; } });
      return go(sp.has('checkout') ? '/checkout' : '/cart', { 'set-cookie': cartCookie(cart) });
    }
    if (p === '/cart/clear' || p === '/cart/clear.js') {
      if (p.endsWith('.js')) return send(200, 'application/json', JSON.stringify({ item_count: 0, items: [] }), { 'set-cookie': cartCookie({}) });
      return go('/cart', { 'set-cookie': cartCookie({}) });
    }
    if (p === '/cart' && req.method === 'POST') return go('/checkout');
    if (p === '/cart') {
      const cj = cartJson(parseCart(req)); const money = (c) => `$${(c / 100).toFixed(2)}`;
      return html(layout(base, '/cart', { title: 'Your Cart | Fixture Store', desc: 'Cart page of the fixture storefront, used by the add-to-cart and checkout-entry checks.', robots: 'noindex',
        body: `<h1>Your cart</h1>${cj.items.length ? `<form action="/cart/update" method="post"><ul>${cj.items.map((i, n) => `<li><a href="${i.url}">${i.title}</a> <label>Quantity <input type="number" name="updates[]" value="${i.quantity}" min="0"></label> <span class="price">${money(i.line_price)}</span> <a href="/cart/change?line=${n + 1}&amp;quantity=0">Remove</a></li>`).join('')}</ul><p class="cart-subtotal">Subtotal: ${money(cj.total_price)}</p><button type="submit" name="update">Update cart</button></form><form action="/cart" method="post"><button type="submit" name="checkout">Check out</button></form>` : '<p>Your cart is empty.</p>'}` }));
    }
    if (p === '/checkout') return go('/checkouts/cn/fixture123/information');
    if (p.startsWith('/checkouts/')) return html('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Checkout - Fixture Store</title></head><body><main><h1>Checkout</h1><p>Fixture checkout: contact information step. No payment is possible here.</p></main></body></html>');
    return html(layout(base, p, { title: '404 Not Found | Fixture Store', desc: '', robots: 'noindex', body: '<h1>Page not found</h1><p>The page you requested does not exist.</p>' }), 404);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const actual = server.address().port;
  return { server, port: actual, url: `http://127.0.0.1:${actual}`, setFixed: (v) => { state.fixed = !!v; }, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--port');
  const f = await start({ locked: argv.includes('--locked'), port: i >= 0 ? Number(argv[i + 1]) : 4599 });
  console.log(`fixture store on ${f.url}${argv.includes('--locked') ? ' (locked)' : ''}`);
}

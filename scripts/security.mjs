#!/usr/bin/env node
// Security & trust collector. PASSIVE ONLY: it loads public pages like a visitor and reads
// headers, cookies flags, markup and first-party scripts. No fuzzing, no injection, no auth
// attempts, no requests to third-party services. A clean run does NOT prove the store is secure.
// usage: node security.mjs --url URL --out OUT [--max 6] [--retest]
import { setup, launch, newContext, recorder, writeResults, writeEvidence, loadPages, gotoSafe, pageLoaded, navProblem, envString, redact } from './lib/common.mjs';

const { args, out, origin, retest, evDir, evRel } = setup('security');
const VP = { width: 1366, height: 768 };
const pages = loadPages(out, origin, Number(args.max) || 6);
const o = new URL(origin);
const https = o.protocol === 'https:';
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(o.hostname) || /\.(localhost|test)$/.test(o.hostname);
const NA = 'Origin is not HTTPS (local or development host); check not applicable here';

const SECRET = [
  ['Shopify Admin/app access token', /shp(?:at|ss|ca|pa)_[a-fA-F0-9]{32}/g, 'critical'],
  ['Stripe live secret key', /sk_live_[A-Za-z0-9]{16,}/g, 'critical'],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/g, 'critical'],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'critical'],
  ['Google API key (often public by design; confirm restrictions)', /\bAIza[0-9A-Za-z_-]{35}\b/g, 'medium'],
];

const browser = await launch();
const ctx = await newContext(browser, out, { viewport: VP });
const R = recorder('security', envString(browser, VP, origin) + ' / passive inspection');
const page = await ctx.newPage();

let reqs = []; let scripts = [];
page.on('request', (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
page.on('response', (r) => { if (r.request().resourceType() === 'script') scripts.push(r); });
const thirdParty = new Map();
let homeHeaders = null; let homeFacts = null;

for (const p of pages) {
  reqs = []; scripts = [];
  const nav = await gotoSafe(page, p.url);
  const s = p.slug; const base = { page: p.path };
  if (!pageLoaded(nav)) {
    R.add({ ...base, id: `SEC-PAGE-${s}`, title: 'Page available for security checks', actual: navProblem(nav), status: 'NOT_TESTED' });
    continue;
  }
  if (!homeHeaders || p.type === 'home') homeHeaders = nav.response.headers();

  // mixed content
  const mixed = reqs.filter((r) => r.url.startsWith('http://'));
  R.add({ ...base, id: `SEC-MIXED-${s}`, title: 'No mixed (http) content', steps: 'Record every request made while the page loads', expected: 'All requests use https',
    actual: !https ? NA : mixed.length ? `${mixed.length} http request(s): ${mixed.slice(0, 5).map((m) => m.url.slice(0, 100)).join(', ')}` : `${reqs.length} requests, all https`,
    status: !https ? 'N/A' : mixed.length ? 'FAIL' : 'PASS', severity: 'medium', impact: 'Browsers block or warn on insecure resources.', fix: 'Load the listed resources over https.' });

  // secrets in markup and first-party scripts
  const bodies = [{ where: 'page HTML', text: await page.content() }];
  for (const r of scripts.slice(0, 40)) {
    let h; try { h = new URL(r.url()).hostname; } catch { continue; }
    if (h !== o.hostname && !/(^|\.)shopify(cdn)?\.com$/.test(h) && !h.endsWith('.myshopify.com')) continue;
    try { const b = await r.body(); if (b.length < 3_000_000) bodies.push({ where: r.url().split('?')[0].slice(-80), text: b.toString('utf8') }); } catch { /* body unavailable */ }
  }
  const hits = [];
  for (const b of bodies) for (const [name, re, sev] of SECRET) {
    const n = (b.text.match(re) || []).length;
    if (n) hits.push({ name, sev, where: b.where, count: n, sample: redact(b.text.match(re)[0]) });
  }
  const worst = hits.some((h) => h.sev === 'critical') ? 'critical' : 'medium';
  R.add({ ...base, id: `SEC-SECRETS-${s}`, title: 'No secret-looking tokens in page source or first-party scripts', steps: `Pattern-scan the rendered HTML and ${bodies.length - 1} first-party script(s)`, expected: 'No Admin API tokens, live payment keys or private keys',
    actual: hits.length ? hits.map((h) => `${h.name} x${h.count} in ${h.where} (${h.sample})`).join('; ') + '. Values redacted; rotate before anything else.' : `No known secret patterns in ${bodies.length} source(s). Pattern scan only; unknown formats are not detected.`,
    status: hits.length ? 'FAIL' : 'PASS', severity: worst, impact: 'Anyone can read the token and call the API with its permissions.', fix: 'Revoke/rotate the credential now, then remove it from theme code; keep secrets server-side.' });

  // forms and links
  const f = await page.evaluate(() => {
    const insecure = [];
    for (const form of document.querySelectorAll('form')) {
      const sensitive = form.querySelector('input[type="password"], input[type="email"], input[autocomplete*="cc-"], input[name*="card" i]');
      if (!sensitive) continue;
      const action = form.action || location.href;
      const method = (form.getAttribute('method') || 'get').toLowerCase();
      if (action.startsWith('http://')) insecure.push(`form posts to ${action.slice(0, 80)}`);
      else if (method === 'get' && form.querySelector('input[type="password"]')) insecure.push('password form uses GET');
    }
    const blank = [...document.querySelectorAll('a[target="_blank"][href]')].filter((a) => { try { return new URL(a.href).origin !== location.origin && !/noopener|noreferrer/i.test(a.rel); } catch { return false; } }).map((a) => a.href.slice(0, 80));
    const privacy = [...document.querySelectorAll('a[href]')].some((a) => /privacy/i.test(a.getAttribute('href')) || /privacy/i.test(a.textContent));
    const consent = document.querySelector('#shopify-pc__banner, .shopify-pc__banner__dialog, #onetrust-banner-sdk, #CybotCookiebotDialog, [id*="cookie-banner" i], [class*="cookie-banner" i], [id*="cookie-consent" i], [class*="cookie-consent" i], [class*="consent-banner" i], [aria-label*="cookie" i][role="dialog"]');
    return { insecure, blank, privacy, consent: consent ? (consent.id || consent.className || consent.tagName).toString().slice(0, 60) : null };
  });
  R.add({ ...base, id: `SEC-FORMS-${s}`, title: 'Forms with personal data submit securely', steps: 'Inspect forms containing email, password or card fields', expected: 'https action; no password over GET',
    actual: !https ? NA : f.insecure.length ? f.insecure.join('; ') : 'No insecure form found', status: !https ? 'N/A' : f.insecure.length ? 'FAIL' : 'PASS', severity: 'medium',
    impact: 'Personal data can be exposed in transit or in logs.', fix: 'Use https form actions and POST for credentials.' });
  R.add({ ...base, id: `SEC-BLANK-${s}`, title: 'External target="_blank" links carry rel="noopener"', steps: 'Inspect external links that open a new tab', expected: 'rel includes noopener or noreferrer',
    actual: f.blank.length ? `${f.blank.length} link(s) without rel: ${f.blank.slice(0, 5).join(', ')}. Current browsers imply noopener; older ones do not.` : 'None missing',
    status: f.blank.length ? 'FAIL' : 'PASS', severity: 'low', impact: 'Reverse tabnabbing in older browsers.', fix: 'Add rel="noopener" to the listed links.' });
  if (p.type === 'home') homeFacts = f;

  for (const r of reqs.filter((x) => x.type === 'script')) {
    try { const h = new URL(r.url).hostname; if (h !== o.hostname) thirdParty.set(h, (thirdParty.get(h) || 0) + 1); } catch { /* skip */ }
  }
}

// --- transport and headers (from the first loaded page, normally the homepage)
R.add({ id: 'SEC-HTTPS', title: 'Storefront is served over HTTPS', page: '/', steps: 'Check the origin scheme', expected: 'https', actual: https ? origin : (local ? NA : `Served over ${o.protocol}`),
  status: https ? 'PASS' : local ? 'N/A' : 'FAIL', severity: 'critical', impact: 'Traffic, including customer data, can be read or altered.', fix: 'Enable the TLS certificate for the domain in Shopify Admin > Domains.' });
if (!https) {
  R.add({ id: 'SEC-HTTP-REDIRECT', title: 'http redirects to https', page: '/', actual: NA, status: 'N/A' });
} else {
  let actual; let status;
  try {
    const r = await ctx.request.get(`http://${o.host}/`, { maxRedirects: 0, timeout: 15000 });
    const loc = r.headers().location || '';
    status = r.status() >= 300 && r.status() < 400 && loc.startsWith('https://') ? 'PASS' : 'FAIL';
    actual = `HTTP ${r.status()}${loc ? ' -> ' + loc.slice(0, 80) : ''}`;
  } catch (e) { status = 'NOT_TESTED'; actual = `http request failed: ${String(e.message).split('\n')[0]}`; }
  R.add({ id: 'SEC-HTTP-REDIRECT', title: 'http redirects to https', page: '/', steps: `GET http://${o.host}/ without following redirects`, expected: '3xx to an https URL', actual, status, severity: 'medium',
    impact: 'Visitors arriving over http stay unencrypted.', fix: 'Force HTTPS at the domain level.' });
}
const H = homeHeaders;
const hdr = (id, title, test, expected, fix, httpsOnly = false) => {
  if (!H) return R.add({ id, title, page: '/', actual: 'No page loaded', status: 'NOT_TESTED' });
  if (httpsOnly && !https) return R.add({ id, title, page: '/', actual: NA, status: 'N/A' });
  const got = test(H);
  R.add({ id, title, page: '/', steps: 'Read response headers of the document request', expected, actual: got ? String(got).slice(0, 160) : 'Header absent', status: got ? 'PASS' : 'FAIL', severity: 'low',
    impact: 'Missing browser-side hardening (defence in depth).', fix });
};
const csp = (h) => h['content-security-policy'] || '';
hdr('SEC-HDR-HSTS', 'Strict-Transport-Security header', (h) => h['strict-transport-security'], 'Present with max-age', 'Shopify sets this on its domains; check any proxy/CDN in front of the store.', true);
hdr('SEC-HDR-CSP', 'Content-Security-Policy header', (h) => csp(h) || (h['content-security-policy-report-only'] ? `report-only: ${h['content-security-policy-report-only']}` : ''), 'Present', 'Shopify sends a baseline policy; a proxy may be stripping it.');
hdr('SEC-HDR-FRAME', 'Clickjacking protection', (h) => h['x-frame-options'] || (/frame-ancestors/i.test(csp(h)) ? 'CSP frame-ancestors' : ''), 'X-Frame-Options or CSP frame-ancestors', 'Restore the default headers (check proxies/apps).');
hdr('SEC-HDR-XCTO', 'X-Content-Type-Options: nosniff', (h) => (/nosniff/i.test(h['x-content-type-options'] || '') ? 'nosniff' : ''), 'nosniff', 'Restore the default headers (check proxies/apps).');
hdr('SEC-HDR-REFERRER', 'Referrer policy', (h) => h['referrer-policy'], 'Referrer-Policy header present', 'Add <meta name="referrer" content="strict-origin-when-cross-origin"> or the header at the proxy.');

// --- cookies (names and flags only; values are never read into the report)
const cookies = (await ctx.cookies()).map((c) => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, session: c.expires === -1 }));
writeEvidence(evDir, 'cookies.json', cookies);
const weak = cookies.filter((c) => /sess|auth|token|secure|login|customer|account/i.test(c.name) && !c.secure);
R.add({ id: 'SEC-COOKIES', title: 'Session-like cookies carry the Secure flag', page: 'site', steps: 'List cookies set during the visit (names and flags only)', expected: 'Session/auth-like cookies are Secure',
  actual: !https ? NA : `${cookies.length} cookie(s); ${weak.length ? 'without Secure: ' + weak.map((c) => c.name).join(', ') : 'no session-like cookie without Secure'}`,
  status: !https ? 'N/A' : weak.length ? 'FAIL' : 'PASS', severity: 'low', evidence: `${evRel}/cookies.json`, impact: 'Cookies can leak over http.', fix: 'Set the Secure flag where the cookie is created.' });

// --- trust signals
if (homeFacts) {
  R.add({ id: 'SEC-PRIVACY-LINK', title: 'Privacy policy is linked from the homepage', page: '/', steps: 'Look for a link whose text or href contains "privacy"', expected: 'Present', actual: homeFacts.privacy ? 'Link found' : 'No privacy link found',
    status: homeFacts.privacy ? 'PASS' : 'FAIL', severity: 'medium', impact: 'Legal exposure (GDPR/CCPA) and lower buyer trust.', fix: 'Add the privacy policy to the footer menu.' });
  R.add({ id: 'SEC-COOKIE-CONSENT', title: 'Cookie consent mechanism', page: '/', steps: 'Look for a known consent banner on first visit', expected: 'A consent mechanism where the law requires one',
    actual: homeFacts.consent ? `Banner detected (${homeFacts.consent}). Not verified that trackers are blocked before consent.` : 'No banner detected for this visitor. Banners are often region-gated, so absence here is not proof; verify from a target region.',
    status: homeFacts.consent ? 'PASS' : 'NOT_TESTED' });
} else {
  R.add({ id: 'SEC-PRIVACY-LINK', title: 'Privacy policy is linked from the homepage', page: '/', actual: 'Homepage not loaded', status: 'NOT_TESTED' });
  R.add({ id: 'SEC-COOKIE-CONSENT', title: 'Cookie consent mechanism', page: '/', actual: 'Homepage not loaded', status: 'NOT_TESTED' });
}
const tp = [...thirdParty].sort((a, b) => b[1] - a[1]).map(([host, requests]) => ({ host, requests }));
writeEvidence(evDir, 'third-party-scripts.json', tp);
R.add({ id: 'SEC-3P-INVENTORY', title: 'Third-party scripts are known and justified', page: 'site', steps: 'List script hosts loaded on sampled pages; a person must match each to an installed app or tag',
  expected: 'Every third-party script host is accounted for', actual: `${tp.length} third-party script host(s) listed in evidence. Review needed: ${tp.slice(0, 8).map((t) => t.host).join(', ') || 'none'}`,
  status: 'NOT_TESTED', evidence: `${evRel}/third-party-scripts.json` });

writeResults(out, 'security', R.records, { pages: pages.map((p) => p.path), scope: 'passive, public pages only' }, retest);
await browser.close();

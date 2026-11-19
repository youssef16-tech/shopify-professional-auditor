# Test procedures

Each section: what the script verifies, what must be done by hand, and how to read the result. Manual check IDs refer to `templates/manual-tests.json` (copied to `OUT/results/manual.json`). Severity guide is in `05-scoring-and-verdict.md`.

All collectors take `--url URL --out OUT` and optionally `--max N`, `--retest`. `run-all.mjs` forwards `--max` to functional, responsive, seo and a11y; security always runs with its own default (6 pages). Without `--max`, functional, seo and a11y run on every page inventory selected (all pages for small stores or `--all`).

Run-level records from `run-all.mjs`: `<AREA>-COLLECTOR` `BLOCKED` when a collector exits non-zero (`FUNCTIONAL-`, `RESPONSIVE-`, `SEO-`, `A11Y-`, `SECURITY-`, `PERFORMANCE-`); `INVENTORY-COLLECTOR` `BLOCKED` when the inventory fails, in which case no collector runs. A `BLOCKED` collector means that area has no results — report it as not assessed, not as clean.

## §FN Functional

`node scripts/functional.mjs`

| ID | Verifies |
|----|----------|
| `FN-LOAD-<page>` | Document returns HTTP < 400 |
| `FN-CONSOLE-<page>` | No console errors or uncaught exceptions on load. `NOT_TESTED` when the page did not load |
| `FN-NET-<page>` | No failed or 4xx/5xx sub-requests. `NOT_TESTED` when the page did not load |
| `FN-LINKS` | Internal links found on inspected pages respond < 400 (cap 150; `--external` adds external links). List in `evidence/functional/links.json` |
| `FN-SEARCH` | Search form exists and a query built from a real product handle returns product links. `FAIL` (high) when the query returns no product links. `NOT_TESTED` when no product page is in the sample to build a query from, or when results return but no search form was found |
| `FN-NAV-MOBILE` | At 375px a menu toggle exists and reveals more navigation links when activated |

`evidence/functional/interactive-inventory.json` lists every link, button, input, select and form per page and which kinds were exercised automatically. Everything else there must be accounted for manually (`FN-M*`): filters and sorting, variant pickers, quantity controls, galleries/zoom, accordions/tabs, sliders, modals, newsletter and contact forms (approval gate), localisation selectors, account links, footer links; search with an empty query (`FN-M09`), with no results (`FN-M10`) and for relevance (`FN-M11`); announcement bars (`FN-M12`); dropdown and mega menus by mouse and keyboard (`FN-M13`); external links open the right target safely (`FN-M14`).

Interpreting: a console error from a third-party app is still a defect (lower severity unless it breaks behaviour). A FAIL on `FN-NAV-MOBILE` or `NOT_TESTED` means the heuristic did not find the toggle — test by hand before reporting.

Record for every manual interaction: expected, actual, result, evidence (screenshot or short description of what was observed).

## §EC E-commerce journey

Automated by `functional.mjs`:

| ID | Stage |
|----|-------|
| `EC-COLLECTION` | Collection page lists products. `NOT_TESTED` when no collection page is in the sample |
| `EC-PDP-<page>` | Product page shows title, price, media and a purchase control |
| `EC-ATC` | Add to cart increases `/cart.js` `item_count` (core). Tries up to 3 sampled products. `BLOCKED` when no add-to-cart control could be clicked; `FAIL` when clicked but the count did not increase |
| `EC-CART` | Cart page shows the added line item (core). `BLOCKED` when nothing could be added |
| `EC-CHECKOUT-REACH` | Checkout control leads to a checkout URL (core). Nothing is entered. `PASS` only when reached through the cart's checkout control; `NOT_TESTED` when reached only by opening `/checkout` directly; `BLOCKED` when nothing could be added; otherwise `FAIL` |

`EC-ATC`, `EC-CART` and `EC-CHECKOUT-REACH` are all `NOT_TESTED` when no product page is in the sample. `BLOCKED` on these is not a store defect until reproduced by hand: the heuristic may have missed a custom purchase control.

Manual (`EC-M*`): homepage → collection path makes sense; filter/sort; variant selection changes price/image/availability; quantity update and remove in cart; cart drawer; discount-code field presence; shipping/tax messaging before checkout; cart persists across reload and navigation (`EC-M11`); empty-cart state (`EC-M12`); product recommendations are relevant and work (`EC-M13`); PDP quantity limits and inventory messaging (`EC-M14`); then the checkout stages — contact information, shipping method, payment, order confirmation, confirmation email. The checkout stages are `core` and stay `NOT_TESTED` unless the user authorised test orders on a development store or test gateway.

The report must list the 11 stages (homepage, collection, search/filter, product page, variant selection, add to cart, cart, checkout entry, contact/shipping, payment, confirmation) with the status of each. Never compress this to "checkout works".

## §UI UI/UX

Manual (`UI-M*`), using `evidence/responsive/*.png` and the live site. Evaluate:

- Visual design: hierarchy, typography scale and consistency, spacing rhythm, colour consistency, image quality and cropping, alignment, brand consistency, empty/placeholder content.
- User experience: navigation clarity, findability, feedback after actions, error states, loading states, trust signals, readability.
- Product experience: media, price and variant clarity, availability, shipping/returns info, reviews, cross-sell.

Each issue records: what, where (page + element), why it matters (rule or measurable harm), how to improve, severity.

Objective defect vs preference: a defect is broken, inconsistent with the store's own system, violates a standard (WCAG, platform convention), or demonstrably obstructs a task. "I would have chosen another font" is preference: put it under CRO/suggestions or omit it.

## §RSP Responsive

`node scripts/responsive.mjs [--max 6]` — real Chromium rendering at 320, 375, 430, 768, 1366, 1920.

Page sample: one page per type first, in the order home, product, collection, cart, page, search, article, blog, policy, other; then the remaining selected pages, capped at 6 unless `--max` is given. State this sample in the report. `RSP-OVERFLOW-<page>-<width>` is `NOT_TESTED` when the page did not load.

| ID | Verifies |
|----|----------|
| `RSP-OVERFLOW-<page>-<width>` | No horizontal overflow (`scrollWidth` ≤ viewport); offending elements listed |
| `RSP-TAP-<page>-375` | Interactive targets ≥ 24×24 CSS px (WCAG 2.5.8); heuristic, confirm manually |
| `RSP-TEXT-<page>-375` | No visible text under 12px |

Full-page screenshots: `evidence/responsive/<page>-<width>.png`. Manual (`RSP-M*`): review every screenshot for overlap, clipping, broken grids, unreadable text over images, sticky elements covering content; test orientation change and the menu on a touch device if available. Emulation is not a real device — say so.

## §SEO

`node scripts/seo.mjs`

Per page: `SEO-TITLE` (10–65 chars), `SEO-DESC` (50–165), `SEO-H1` (exactly one), `SEO-HEADINGS` (no skipped levels), `SEO-CANONICAL`, `SEO-INDEX` (no `noindex` on pages that should rank), `SEO-OG`, `SEO-ALT`, `SEO-JSONLD` (parses), `SEO-PRODUCT-SCHEMA` (name + offers with price), `SEO-BREADCRUMB`. Site: `SEO-LANG`, `SEO-ROBOTS-TXT`, `SEO-SITEMAP`, `SEO-DUP-TITLES`.

Non-pass/fail statuses: `SEO-PAGE-<page>` `NOT_TESTED` replaces all per-page checks when the page is not HTTP 200 or is the password page; `SEO-JSONLD` is `N/A` when the page has no JSON-LD; `SEO-LANG` is `NOT_TESTED` when the homepage `lang` could not be read; `SEO-ROBOTS-TXT` and `SEO-SITEMAP` are `BLOCKED` when the request fails; `SEO-DUP-TITLES` is `NOT_TESTED` when no titles were collected.

Manual (`SEO-M*`): URL structure (`SEO-M05`), internal linking depth (`SEO-M06`), redirect behaviour — www/non-www, old URLs (`SEO-M02`), pagination handling (`SEO-M07`), duplicate content — variant URLs, `/collections/x/products/y` canonicals (`SEO-M08`), image formats/dimensions (`SEO-M09`), validate structured data in Google's Rich Results Test (`SEO-M04`).

Limits: length thresholds are conventions, not Google rules — severity low. These checks show *indexability*, not *indexing*: only Search Console (owner access) shows what Google indexed. Never claim rankings or indexing from this data.

## §PERF Performance

`node scripts/lighthouse.mjs [--field]`

Lighthouse lab runs: mobile on home + first product + first collection, desktop on home. Reports in `evidence/performance/`.

| ID | Pass | Medium | High |
|----|------|--------|------|
| `PERF-SCORE-<page>-<form>` | ≥ 90 | 50–89 | < 50 |
| `PERF-LCP-…` | ≤ 2.5 s | ≤ 4 s | > 4 s |
| `PERF-CLS-…` | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| `PERF-TBT-…` | ≤ 200 ms | ≤ 600 ms | > 600 ms |

Always record conditions (in each record's `environment`): Lighthouse version, form factor, simulated throttling, single run, machine. Lab scores vary ±5 between runs; rerun before reporting borderline results, and re-test after every optimisation.

Lab vs field: INP cannot be measured in the lab (TBT is the proxy). Real-user Core Web Vitals come only from CrUX. `--field` queries PageSpeed Insights for them (`PERF-FIELD-*`); low-traffic stores have no CrUX data → `N/A`. Without `--field`, `PERF-INP-FIELD` is `NOT_TESTED`.

Non-pass/fail statuses: `PERF-LIGHTHOUSE` is `NOT_TESTED` under `--skip-lighthouse`; lab metric records are `BLOCKED` when the Lighthouse run fails or the metric is missing from the report; `PERF-FIELD-*` is `N/A` on local hosts and when CrUX has no data, `BLOCKED` when the PageSpeed Insights request fails.

Diagnosis (manual `PERF-M*`): read the HTML report's opportunities — render-blocking resources, unused JS/CSS, image formats/sizing, lazy loading of below-the-fold media, LCP element and its preload, third-party app cost (group by origin), font loading. Attribute cost to theme vs apps before recommending.

## §A11Y Accessibility (WCAG 2.2 AA)

`node scripts/a11y.mjs`

- `A11Y-AXE-<rule>-<page>` — one FAIL per violated axe rule per page (critical/serious → high, moderate → medium, minor → low); `A11Y-AXE-<page>` PASS when none.
- `A11Y-KBD-TAB-home`, `A11Y-KBD-FOCUS-home`, `A11Y-SKIPLINK-home` — Tab-key probe: focus moves, focus indicator computed as visible, first stop is a skip link. Heuristic; confirm by hand.

Non-pass/fail statuses: `A11Y-AXE-<page>` is `NOT_TESTED` when the page did not load and `BLOCKED` when axe failed to run; the keyboard probe records are `NOT_TESTED` when the homepage did not load; `A11Y-KBD-FOCUS-home` is `NOT_TESTED` when no distinct focus stops were found (PASS needs a visible indicator on at least 80% of stops).

Automated tools detect a minority of WCAG failures. Mandatory manual checks (`A11Y-M*`): full keyboard pass of the purchase path (menu, search, variant picker, add to cart, cart drawer, checkout button) with no traps; focus order and visibility; dialogs/drawers trap and return focus and close on Esc; form labels, error identification and suggestions; alt text *quality*; heading structure makes sense; 200% zoom / 320px reflow; motion and autoplay controls; target size; a screen-reader smoke test if one is available. State which were done and which were not — an unexecuted check is `NOT_TESTED`, and the report must not say "WCAG compliant".

## §SEC Security and trust

`node scripts/security.mjs [--max 6]` — passive only (boundaries in `01-access-and-safety.md`).

`SEC-HTTPS`, `SEC-HTTP-REDIRECT`, `SEC-HDR-HSTS`, `SEC-HDR-CSP`, `SEC-HDR-FRAME` (clickjacking protection), `SEC-HDR-XCTO` (nosniff), `SEC-HDR-REFERRER` (all low severity; Shopify controls most), `SEC-MIXED-<page>`, `SEC-COOKIES`, `SEC-SECRETS-<page>` (private-token patterns in HTML/inline scripts — critical; confirm it is a real secret before reporting), `SEC-FORMS-<page>`, `SEC-BLANK-<page>`, `SEC-PRIVACY-LINK`, `SEC-COOKIE-CONSENT`, `SEC-3P-INVENTORY` (always `NOT_TESTED`: the script lists third-party script origins, a human judges them).

Non-pass/fail statuses: `SEC-PAGE-<page>` `NOT_TESTED` replaces the per-page checks when the page did not load; `SEC-COOKIE-CONSENT` is `PASS` when a consent element is found and `NOT_TESTED` otherwise (absence is not proof — a banner may be geo-targeted); HTTPS-only checks are `N/A` on non-HTTPS (local) hosts.

Manual (`SEC-M*`): each third-party origin is expected and reputable (`SEC-M03`); no customer data in URLs, `localStorage` or `sessionStorage` (`SEC-M07`); privacy, refund, shipping, terms pages exist and are specific to the business (`SEC-M04`); contact details are real; consent banner actually blocks non-essential tags before consent in regions that require it, and accept/reject both work (`SEC-M06`, check the network panel); customer-account pages do not leak data.

Public by design, not findings: Storefront API access tokens, analytics IDs, the `myshopify.com` domain.

## §CRO Conversion optimisation

Manual, category `cro`, unscored. Two lists, never mixed:

1. **Usability defects affecting conversion** — already recorded as FAILs elsewhere; reference their IDs.
2. **Hypotheses** — phrased "We believe X for Y will improve Z because [evidence]. Test by …". Rank by evidence strength and effort.

Cover these 11 areas (rows in `templates/manual-tests.json`), each producing defects, hypotheses, or "nothing observed":

| ID | Area |
|----|------|
| `CRO-M01`–`CRO-M03` | Homepage value proposition, trust signals, checkout friction (existing rows) |
| `CRO-M04` | Navigation and findability |
| `CRO-M05` | Search and collection browsing |
| `CRO-M06` | Product-page persuasion (media, copy, reviews placement) |
| `CRO-M07` | Pricing, offers and shipping-cost clarity |
| `CRO-M08` | Social proof and urgency (honest only) |
| `CRO-M09` | Mobile purchase path |
| `CRO-M10` | Speed perception |
| `CRO-M11` | Post-purchase and retention prompts |

No uplift percentages or revenue claims unless the user provided analytics or experiment data, in which case cite it.

# Shopify Store Audit: http://127.0.0.1:44267

Date: 2026-11-19 · Verdict: **NOT READY FOR PRODUCTION** · Score: **35.9/100** · Confidence: **Medium** · Coverage: 69%

Statuses: PASS (verified by the stated test), FAIL (defect reproduced), BLOCKED (could not run), NOT_TESTED (not performed), N/A. Only PASS and FAIL earn or lose points.

## 1. Executive Summary

Store audited: http://127.0.0.1:44267. Verdict: **NOT READY FOR PRODUCTION**, score **35.9/100**, confidence **Medium** (coverage 69%).

313 checks recorded: 174 passed, 19 failed, 99 NOT TESTED, 0 blocked, 21 NOT APPLICABLE.
Open defects: 1 critical, 7 high, 5 medium, 6 low.

### Highest-priority open defects
| Defect | Severity | Location | Issue |
| --- | --- | --- | --- |
| D-001 (SEC-SECRETS-products-bad-mug) | critical | /products/bad-mug | No secret-looking tokens in page source or first-party scripts |
| D-002 (FN-LOAD-pages-broken) | high | /pages/broken | Page loads |
| D-003 (RSP-OVERFLOW-products-bad-mug-320) | high | /products/bad-mug | No horizontal overflow at 320px |
| D-004 (RSP-OVERFLOW-products-bad-mug-375) | high | /products/bad-mug | No horizontal overflow at 375px |
| D-005 (RSP-OVERFLOW-products-bad-mug-430) | high | /products/bad-mug | No horizontal overflow at 430px |
| D-006 (A11Y-AXE-color-contrast-products-bad-mug) | high | /products/bad-mug | Elements must meet minimum color contrast ratio thresholds |
| D-007 (A11Y-AXE-image-alt-products-bad-mug) | high | /products/bad-mug | Images must have alternative text |
| D-008 (A11Y-AXE-label-products-bad-mug) | high | /products/bad-mug | Form elements must have labels |

Results marked PASS were verified by the stated test only. Everything not listed as PASS or FAIL is unverified.

## 2. Store Discovery Document

### Store Discovery

Date: 2026-11-19

Every line is marked **Verified** (observed by a tool or by the auditor), **Stated** (told by the owner, not checked) or **Unknown**. Never fill a gap with a guess.

#### Observed from the storefront (Verified)

| Item | Value |
| --- | --- |
| Storefront URL | http://127.0.0.1:44267 — **Verified** (loaded in this session) |
| myshopify domain | fixture-store.myshopify.com — **Verified** (window.Shopify.shop) |
| Theme | Fixture Theme (id 1; based on unknown ) — **Verified** (window.Shopify.theme) |
| Theme version (base theme and version) | **Unknown** (theme does not expose schema_name; ask the owner or read config/settings_schema.json) |
| Currency | USD — **Verified** (window.Shopify.currency.active) |
| Locale | en — **Verified** (window.Shopify.locale / country) |
| Languages | en only observed — **Verified** (html lang; no hreflang or localisation form found) |
| Pages discovered | home: 1, product: 2, collection: 1, page: 2, policy: 1, cart: 1, search: 1 — **Verified** (sitemap + homepage links; published URLs only) |

#### Business context (ask the owner; mark Stated or Unknown)

| Item | Value | Source |
| --- | --- | --- |
| Business name and what it sells | | Unknown |
| Store type and business model (D2C, B2B/wholesale, dropshipping, subscription, print-on-demand, marketplace, single product) | | Unknown |
| Target customers and markets | | Unknown |
| Main goal of the store (sales, leads, wholesale) | | Unknown |
| Brand guidelines (colours, fonts, tone) | | Unknown |
| Payment methods and shipping regions | | Unknown |
| Installed apps the owner relies on | | Unknown |
| Known problems the owner wants fixed | | Unknown |
| Launch date or deadline | | Unknown |

#### Technical limitations (observed or stated)

| Limitation | Effect on the audit | Source |
| --- | --- | --- |
| Theme version is behind the current release of its base theme (check the theme store changelog) | Known upstream bugs may apply; updates may overwrite custom code | Unknown |
| Heavily customised or vintage (non-OS 2.0) theme | Sections everywhere / JSON templates may be unavailable | Unknown |
| Storefront password, geo or bot protection | Automated checks may be blocked or partial | Unknown |
| Apps injecting scripts or app blocks the auditor cannot inspect | Their code is out of scope; only their storefront effect is tested | Unknown |
| Markets, languages or currencies the auditor cannot switch to | Those variants stay NOT TESTED | Unknown |
| Shopify-hosted areas (checkout, accounts, payments) | Not editable through the theme; reachability only | Verified (Shopify platform) |

#### Access established for this audit

| Access | Status | How it was established |
| --- | --- | --- |
| Public storefront | | |
| Storefront password (owner session) | Not provided | |
| Theme source (local copy / CLI / GitHub) | Not provided | |
| Shopify Admin or collaborator account | Not provided | |
| Development or preview theme | Not provided | |
| Test payment gateway (Bogus / test mode) | Not provided | |
| Analytics, Search Console | Not provided | |

#### Audit scope

- Audit type: public-facing only / with theme access / with admin access
- In scope:
- Out of scope:
- Changes authorised: none (read-only) / development theme only / other (written approval attached)

#### Assumptions

List anything taken as true without verification, so the report can show it. Leave the list empty rather than invent one.

- (none yet)

#### Constraints

- Read-only by default: only the anonymous session cart is touched.
- Checkout is tested for reachability only; no payment details, orders or refunds.
- Security checks are passive only.
- Fixes go only to a development or unpublished theme, after a backup and with approval.
- Time, budget or access limits stated by the owner:

#### Missing requirements

Information the audit needs but does not have. Each item lowers confidence in the related category and is listed in the final report.

| Missing item | Needed for | Asked on | Answer |
| --- | --- | --- | --- |
| | | | |


## 3. Page Inventory

Pages: 9 discovered, 9 selected, 9 inspected with at least one verified result, 0 untested. Strategy: template sampling. **Sampled audit: untested pages are listed in page-inventory.csv.** Full list: page-inventory.csv.

| Path | Type | Coverage |
| --- | --- | --- |
| / | home | Inspected |
| /products/good-tee | product | Inspected |
| /products/bad-mug | product | Inspected |
| /collections/all | collection | Inspected |
| /pages/contact | page | Inspected |
| /policies/privacy-policy | policy | Inspected |
| /cart | cart | Inspected |
| /pages/broken | page | Inspected |
| /search | search | Inspected |

## 4. Page-by-Page Results

| Page / component | Pass | Fail | Untested | Failed checks |
| --- | --- | --- | --- | --- |
| / | 29 | 4 | 1 | SEC-HDR-CSP, SEC-HDR-FRAME, SEC-HDR-XCTO, SEC-HDR-REFERRER |
| /cart | 18 | 0 | 0 |  |
| /collections/all | 23 | 0 | 0 |  |
| /pages/broken | 0 | 1 | 10 | FN-LOAD-pages-broken |
| /pages/contact | 22 | 0 | 0 |  |
| /policies/privacy-policy | 21 | 0 | 0 |  |
| /products/bad-mug | 15 | 12 | 0 | A11Y-AXE-color-contrast-products-bad-mug, A11Y-AXE-image-alt-products-bad-mug, A11Y-AXE-label-products-bad-mug, FN-CONSOLE-products-bad-mug, RSP-OVERFLOW-products-bad-mug-320, RSP-OVERFLOW-products-bad-mug-375, +6 more |
| /products/good-tee | 29 | 1 | 0 | RSP-TAP-products-good-tee-375 |
| /robots.txt | 1 | 0 | 0 |  |
| /search | 14 | 0 | 0 |  |
| /sitemap.xml | 1 | 0 | 0 |  |
| account | 0 | 0 | 1 |  |
| admin | 0 | 0 | 3 |  |
| cart | 0 | 0 | 2 |  |
| cart / checkout | 0 | 0 | 1 |  |
| cart drawer | 0 | 0 | 1 |  |
| cart drawer, menu, popups | 0 | 0 | 1 |  |
| cart, cart drawer | 0 | 0 | 1 |  |
| cart, search, 404 | 0 | 0 | 1 |  |
| checkout | 0 | 0 | 3 |  |
| collection | 0 | 0 | 3 |  |
| contact | 0 | 0 | 1 |  |
| contact, account, cart | 0 | 0 | 1 |  |
| evidence/a11y/*.json | 0 | 0 | 1 |  |
| evidence/functional/interactive-inventory.json | 0 | 0 | 1 |  |
| evidence/security/third-party-scripts.json | 0 | 0 | 1 |  |
| footer / popup | 0 | 0 | 1 |  |
| header | 0 | 0 | 1 |  |
| header / footer | 0 | 0 | 1 |  |
| header, footer | 0 | 0 | 2 |  |
| home | 0 | 0 | 2 |  |
| home to collection to product | 0 | 0 | 1 |  |
| home, collection, product | 0 | 0 | 1 |  |
| home, collections, products | 0 | 0 | 1 |  |
| home, product | 0 | 0 | 3 |  |
| home, product, cart | 0 | 0 | 5 |  |
| home, product, collection | 0 | 0 | 1 |  |
| policies | 0 | 0 | 1 |  |
| product | 0 | 0 | 9 |  |
| product, cart | 0 | 0 | 1 |  |
| sampled pages | 0 | 0 | 1 |  |
| search | 0 | 0 | 3 |  |
| site | 1 | 1 | 21 | FN-LINKS |
| site (header, footer, content, social icons) | 0 | 0 | 1 |  |
| site, admin | 0 | 0 | 1 |  |
| site, cart | 0 | 0 | 1 |  |
| thank-you page, email | 0 | 0 | 1 |  |
| theme | 0 | 0 | 7 |  |

## 5. UI/UX Audit

**Score: 0 (not assessed) / 15** · coverage 0% · 0 passed, 0 failed, 10 untested

**What is needed to improve:** run or verify 10 unverified check(s) (UI-M01, UI-M02, UI-M03, UI-M04, UI-M05, UI-M06, +4 more).

No open defects among the checks that were run.

### Not verified (10)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| UI-M01 | Visual hierarchy: the primary action is the most prominent element on key pages | NOT TESTED | Not performed |
| UI-M02 | Typography is consistent (families, scale, line length, line height) | NOT TESTED | Not performed |
| UI-M03 | Spacing and alignment follow a consistent grid | NOT TESTED | Not performed |
| UI-M04 | Colour use is consistent and matches the brand guidelines if provided | NOT TESTED | Not performed |
| UI-M05 | Images are sharp, correctly cropped and consistent in ratio | NOT TESTED | Not performed |
| UI-M06 | Navigation labels are clear and the menu structure matches the catalogue | NOT TESTED | Not performed |
| UI-M07 | Product page presents price, variants, stock, shipping and returns clearly | NOT TESTED | Not performed |
| UI-M08 | Interactive states exist (hover, focus, active, disabled, loading) | NOT TESTED | Not performed |
| UI-M09 | Empty and error states are designed (empty cart, no results, 404, form errors) | NOT TESTED | Not performed |
| UI-M10 | Copy is free of placeholder text, spelling errors and broken translations | NOT TESTED | Not performed |

## 6. Responsive Results

**Score: 7.2 / 10** · coverage 88% · 60 passed, 4 failed, 9 untested

**What is needed to improve:** fix 4 open defect(s) (RSP-OVERFLOW-products-bad-mug-320, RSP-OVERFLOW-products-bad-mug-375, RSP-OVERFLOW-products-bad-mug-430, RSP-TAP-products-good-tee-375) and retest them; run or verify 9 unverified check(s) (RSP-OVERFLOW-pages-broken-320, RSP-OVERFLOW-pages-broken-375, RSP-OVERFLOW-pages-broken-430, RSP-OVERFLOW-pages-broken-768, RSP-OVERFLOW-pages-broken-1366, RSP-OVERFLOW-pages-broken-1920, +3 more).

### Open defects (4)

#### D-003 · RSP-OVERFLOW-products-bad-mug-320 · No horizontal overflow at 320px
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** scrollWidth <= viewport width
- **Actual:** scrollWidth 632px, viewport 320px; offenders: div (right edge 632px, width 616px)
- **Evidence:** evidence/responsive/products-bad-mug-320.png
- **Impact:** Content is cut off or the page scrolls sideways.
- **Recommended fix:** Constrain the offending element (max-width: 100%, overflow-wrap, responsive grid).
- **Fix status:** Open

#### D-004 · RSP-OVERFLOW-products-bad-mug-375 · No horizontal overflow at 375px
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** scrollWidth <= viewport width
- **Actual:** scrollWidth 632px, viewport 375px; offenders: div (right edge 632px, width 616px)
- **Evidence:** evidence/responsive/products-bad-mug-375.png
- **Impact:** Content is cut off or the page scrolls sideways.
- **Recommended fix:** Constrain the offending element (max-width: 100%, overflow-wrap, responsive grid).
- **Fix status:** Open

#### D-005 · RSP-OVERFLOW-products-bad-mug-430 · No horizontal overflow at 430px
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** scrollWidth <= viewport width
- **Actual:** scrollWidth 632px, viewport 430px; offenders: div (right edge 632px, width 616px)
- **Evidence:** evidence/responsive/products-bad-mug-430.png
- **Impact:** Content is cut off or the page scrolls sideways.
- **Recommended fix:** Constrain the offending element (max-width: 100%, overflow-wrap, responsive grid).
- **Fix status:** Open

#### D-015 · RSP-TAP-products-good-tee-375 · Tap targets at least 24x24 CSS px
- **Severity:** low
- **Location:** /products/good-tee
- **Expected:** No target under 24x24 (WCAG 2.5.8)
- **Actual:** 1 small target(s): select "SmallLarge" 57x19. Heuristic: confirm manually (spacing exception not evaluated).
- **Evidence:** evidence/responsive/products-good-tee-375.png
- **Impact:** Small targets are hard to hit on touch screens.
- **Recommended fix:** Increase padding or min-size of the listed controls.
- **Fix status:** Open

### Not verified (9)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| RSP-OVERFLOW-pages-broken-320 | No horizontal overflow at 320px | NOT TESTED | HTTP 404; page did not load |
| RSP-OVERFLOW-pages-broken-375 | No horizontal overflow at 375px | NOT TESTED | HTTP 404; page did not load |
| RSP-OVERFLOW-pages-broken-430 | No horizontal overflow at 430px | NOT TESTED | HTTP 404; page did not load |
| RSP-OVERFLOW-pages-broken-768 | No horizontal overflow at 768px | NOT TESTED | HTTP 404; page did not load |
| RSP-OVERFLOW-pages-broken-1366 | No horizontal overflow at 1366px | NOT TESTED | HTTP 404; page did not load |
| RSP-OVERFLOW-pages-broken-1920 | No horizontal overflow at 1920px | NOT TESTED | HTTP 404; page did not load |
| RSP-M01 | Screenshots reviewed at all six widths for overlap, clipping and broken layouts | NOT TESTED | Not performed |
| RSP-M02 | Sticky elements (header, add-to-cart bar, chat, cookie banner) do not cover content or controls on phones | NOT TESTED | Not performed |
| RSP-M03 | Checked on at least one physical phone or a second browser engine (Safari/WebKit) | NOT TESTED | Not performed |

## 7. Functional Results

**Score: 9.9 / 20** · coverage 64% · 26 passed, 3 failed, 16 untested

**What is needed to improve:** fix 3 open defect(s) (FN-LOAD-pages-broken, FN-CONSOLE-products-bad-mug, FN-LINKS) and retest them; run or verify 16 unverified check(s) (FN-CONSOLE-pages-broken, FN-NET-pages-broken, FN-M01, FN-M02, FN-M03, FN-M04, +10 more).

### Open defects (3)

#### D-002 · FN-LOAD-pages-broken · Page loads
- **Severity:** high
- **Location:** /pages/broken
- **Expected:** HTTP < 400
- **Actual:** HTTP 404
- **Evidence:** evidence/functional/pages-broken.png
- **Impact:** Visitors reach an error instead of the page.
- **Recommended fix:** Restore the page or remove/redirect links pointing to it.
- **Fix status:** Open

#### D-009 · FN-CONSOLE-products-bad-mug · No console errors on load
- **Severity:** medium
- **Location:** /products/bad-mug
- **Expected:** 0 errors
- **Actual:** 2 error(s): fixture: simulated console error | Uncaught: fixture: simulated uncaught error
- **Evidence:** see test-case-log.csv
- **Impact:** Script errors can silently break features that depend on the failing script.
- **Recommended fix:** Trace each error to its script (theme or app) and fix or remove it.
- **Fix status:** Open

#### D-010 · FN-LINKS · Internal links respond without error
- **Severity:** medium
- **Location:** site
- **Expected:** All respond < 400
- **Actual:** 9 checked of 9 found; 1 broken: 404 http://127.0.0.1:44267/pages/broken (on /)
- **Evidence:** evidence/functional/links.json
- **Impact:** Dead links break navigation and waste crawl budget.
- **Recommended fix:** Update or remove each broken link; add URL redirects for moved pages.
- **Fix status:** Open

### Not verified (16)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| FN-CONSOLE-pages-broken | No console errors on load | NOT TESTED | Page did not load; check not performed |
| FN-NET-pages-broken | No failed sub-requests | NOT TESTED | Page did not load; check not performed |
| FN-M01 | Every header and footer menu item opens the intended destination | NOT TESTED | Not performed |
| FN-M02 | Contact form submits and shows a confirmation (test submission only, with owner approval) | NOT TESTED | Not performed |
| FN-M03 | Newsletter signup validates input and confirms (test address only, with owner approval) | NOT TESTED | Not performed |
| FN-M04 | Customer account: register, log in, log out, password reset (test account only) | NOT TESTED | Not performed |
| FN-M05 | Sliders, tabs, accordions, modals and popups open, close and do not trap the user | NOT TESTED | Not performed |
| FN-M06 | Product media: gallery, zoom and video work | NOT TESTED | Not performed |
| FN-M07 | Language and currency selectors switch and persist | NOT TESTED | Not performed |
| FN-M08 | Interactive element inventory reviewed: every listed control is tested or explicitly marked untested | NOT TESTED | Not performed |
| FN-M09 | Search with an empty query is handled | NOT TESTED | Not performed |
| FN-M10 | Search with no results shows a helpful state | NOT TESTED | Not performed |
| FN-M11 | Search relevance: known product names, types and a misspelling return the expected products first | NOT TESTED | Not performed |
| FN-M12 | Announcement bars: text is current, links work, rotation and dismiss behave, no overlap with the header | NOT TESTED | Not performed |
| FN-M13 | Dropdown and mega menus open and close by mouse, keyboard and touch | NOT TESTED | Not performed |
| FN-M14 | External links go to the right destination and open safely | NOT TESTED | Not performed |

## 8. E-commerce Journey Results

### Purchase journey

| Stage | Result | Checks |
| --- | --- | --- |
| 1. Landing on the homepage | VERIFIED | FN-LOAD-home: PASS |
| 2. Discovering products | PARTLY VERIFIED | EC-COLLECTION: PASS; EC-M01: NOT TESTED; FN-SEARCH: PASS; EC-M02: NOT TESTED |
| 3. Opening a product | PARTLY VERIFIED | EC-PDP-products-good-tee: PASS; EC-PDP-products-bad-mug: PASS; EC-M13: NOT TESTED |
| 4. Selecting variants | PARTLY VERIFIED | EC-VARIANT: PASS; EC-PRICE-UPDATE: PASS; EC-M03: NOT TESTED |
| 5. Adding products to the cart | PARTLY VERIFIED | EC-ATC: PASS; EC-QTY: PASS; EC-M14: NOT TESTED |
| 6. Updating the cart | PARTLY VERIFIED | EC-CART: PASS; EC-CART-TOTAL: PASS; EC-CART-UPDATE: PASS; EC-CART-REMOVE: PASS; EC-M04: NOT TESTED; EC-M05: NOT TESTED; EC-M06: NOT TESTED; EC-M11: NOT TESTED; EC-M12: NOT TESTED |
| 7. Proceeding to checkout | VERIFIED | EC-CHECKOUT-REACH: PASS |
| 8. Entering customer information | NOT TESTED | EC-M07: NOT TESTED |
| 9. Reviewing shipping options | NOT TESTED | EC-M08: NOT TESTED |
| 10. Reviewing payment options (test gateway only) | NOT TESTED | EC-M09: NOT TESTED |
| 11. Completing a test transaction (dev store, test gateway only) | NOT TESTED | EC-M10: NOT TESTED |

**Score: 6.9 / 15** · coverage 46% · 12 passed, 0 failed, 14 untested

**What is needed to improve:** run or verify 14 unverified check(s) (EC-M01, EC-M02, EC-M03, EC-M04, EC-M05, EC-M06, +8 more).

No open defects among the checks that were run.

### Not verified (14)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| EC-M01 | A shopper can get from the homepage to a product through the navigation | NOT TESTED | Not performed |
| EC-M02 | Collection filters and sorting change the product list correctly | NOT TESTED | Not performed |
| EC-M03 | Variant selection updates price, image, availability and the variant added to the cart | NOT TESTED | Not performed |
| EC-M04 | Cart quantity update and remove work and totals recalculate | NOT TESTED | Not performed |
| EC-M05 | Cart drawer or cart notification opens, updates and links to cart and checkout | NOT TESTED | Not performed |
| EC-M06 | Discount code field, shipping and tax messaging are present and accurate | NOT TESTED | Not performed |
| EC-M07 | Checkout contact and address step validates and continues | NOT TESTED | Not performed |
| EC-M08 | Shipping methods and rates appear for the target regions | NOT TESTED | Not performed |
| EC-M09 | Payment completes on a TEST gateway only (Bogus Gateway or Shopify Payments test mode) | NOT TESTED | Not performed |
| EC-M10 | Order confirmation page and confirmation email are correct | NOT TESTED | Not performed |
| EC-M11 | Cart persists across pages, reload and a return visit | NOT TESTED | Not performed |
| EC-M12 | Empty cart state | NOT TESTED | Not performed |
| EC-M13 | Product recommendations load and are relevant | NOT TESTED | Not performed |
| EC-M14 | PDP quantity selector limits: minimum, maximum, invalid input | NOT TESTED | Not performed |

## 9. SEO Audit

**Score: 7.6 / 10** · coverage 85% · 54 passed, 4 failed, 10 untested

**What is needed to improve:** fix 4 open defect(s) (SEO-ALT-products-bad-mug, SEO-H1-products-bad-mug, SEO-PRODUCT-SCHEMA-products-bad-mug, SEO-BREADCRUMB-products-bad-mug) and retest them; run or verify 10 unverified check(s) (SEO-PAGE-pages-broken, SEO-M01, SEO-M02, SEO-M03, SEO-M04, SEO-M05, +4 more).

### Open defects (4)

#### D-011 · SEO-ALT-products-bad-mug · Images have an alt attribute
- **Severity:** medium
- **Location:** /products/bad-mug
- **Expected:** Every img has alt
- **Actual:** 1 of 1 without alt: http://127.0.0.1:44267/img.svg
- **Evidence:** evidence/seo/onpage.json
- **Impact:** Images are invisible to image search and screen readers.
- **Recommended fix:** Add alt text in the media library or the section markup.
- **Fix status:** Open (retest failed)

#### D-013 · SEO-H1-products-bad-mug · Exactly one H1
- **Severity:** medium
- **Location:** /products/bad-mug
- **Expected:** 1
- **Actual:** 2: "Bad Mug", "Second main heading"
- **Evidence:** evidence/seo/onpage.json
- **Impact:** Unclear main topic for search engines and screen-reader users.
- **Recommended fix:** Keep one h1 (the page or product title); demote the others.
- **Fix status:** Open (retest failed)

#### D-014 · SEO-PRODUCT-SCHEMA-products-bad-mug · Product structured data with name and priced offer
- **Severity:** medium
- **Location:** /products/bad-mug
- **Expected:** Product with name and offers.price
- **Actual:** No Product node
- **Evidence:** evidence/seo/onpage.json
- **Impact:** No price/availability rich results.
- **Recommended fix:** Output Product JSON-LD (e.g. {{ product | structured_data }}).
- **Fix status:** Open (retest failed)

#### D-016 · SEO-BREADCRUMB-products-bad-mug · BreadcrumbList structured data
- **Severity:** low
- **Location:** /products/bad-mug
- **Expected:** Present
- **Actual:** Absent
- **Evidence:** evidence/seo/onpage.json
- **Impact:** No breadcrumb trail in search results.
- **Recommended fix:** Add BreadcrumbList JSON-LD to the product template.
- **Fix status:** Open (retest failed)

### Not verified (10)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| SEO-PAGE-pages-broken | Page available for SEO checks | NOT TESTED | HTTP 404 |
| SEO-M01 | Indexing verified in Google Search Console (owner access required) | NOT TESTED | Not performed |
| SEO-M02 | Structured data validated with the Rich Results Test on one product page | NOT TESTED | Not performed |
| SEO-M03 | Titles and descriptions are unique, accurate and written for the target keywords | NOT TESTED | Not performed |
| SEO-M04 | URL redirects exist for removed or renamed pages; internal links avoid redirect chains | NOT TESTED | Not performed |
| SEO-M05 | URL structure: handles are readable, lowercase, hyphenated and free of tracking or session parameters | NOT TESTED | Not performed |
| SEO-M06 | Internal linking: every important page is reachable within three clicks of the homepage and none is orphaned | NOT TESTED | Not performed |
| SEO-M07 | Pagination: paginated collection, blog and search pages are crawlable and canonicalised correctly | NOT TESTED | Not performed |
| SEO-M08 | Duplicate content: variant URLs and /collections/x/products/y paths canonicalise to the main product URL | NOT TESTED | Not performed |
| SEO-M09 | Images: served in a modern format at appropriate dimensions with width and height set | NOT TESTED | Not performed |

## 10. Performance Audit

**Score: 0 (not assessed) / 10** · coverage 0% · 0 passed, 0 failed, 3 untested

**What is needed to improve:** run or verify 3 unverified check(s) (PERF-LIGHTHOUSE, PERF-M01, PERF-M02).

No open defects among the checks that were run.

### Not verified (3)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| PERF-LIGHTHOUSE | Lighthouse lab run | NOT TESTED | Skipped with --skip-lighthouse: performance was not measured |
| PERF-M01 | Lighthouse re-run at least twice more; median reported | NOT TESTED | Not performed |
| PERF-M02 | Largest images, third-party scripts and app embeds reviewed in the Lighthouse report | NOT TESTED | Not performed |

## 11. Accessibility Audit

**Score: 2.7 / 10** · coverage 59% · 10 passed, 3 failed, 9 untested

**What is needed to improve:** fix 3 open defect(s) (A11Y-AXE-color-contrast-products-bad-mug, A11Y-AXE-image-alt-products-bad-mug, A11Y-AXE-label-products-bad-mug) and retest them; run or verify 9 unverified check(s) (A11Y-AXE-pages-broken, A11Y-M01, A11Y-M02, A11Y-M03, A11Y-M04, A11Y-M05, +3 more).

### Open defects (3)

#### D-006 · A11Y-AXE-color-contrast-products-bad-mug · Elements must meet minimum color contrast ratio thresholds
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** No "color-contrast" violation
- **Actual:** 1 element(s), axe impact serious: p:nth-child(5)
- **Evidence:** evidence/a11y/axe-products-bad-mug.json
- **Impact:** WCAG failure (wcag143): Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
- **Recommended fix:** See https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright
- **Fix status:** Open

#### D-007 · A11Y-AXE-image-alt-products-bad-mug · Images must have alternative text
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** No "image-alt" violation
- **Actual:** 1 element(s), axe impact critical: img
- **Evidence:** evidence/a11y/axe-products-bad-mug.json
- **Impact:** WCAG failure (wcag111): Ensure <img> elements have alternative text or a role of none or presentation
- **Recommended fix:** See https://dequeuniversity.com/rules/axe/4.10/image-alt?application=playwright
- **Fix status:** Open

#### D-008 · A11Y-AXE-label-products-bad-mug · Form elements must have labels
- **Severity:** high
- **Location:** /products/bad-mug
- **Expected:** No "label" violation
- **Actual:** 1 element(s), axe impact critical: input[type="text"]
- **Evidence:** evidence/a11y/axe-products-bad-mug.json
- **Impact:** WCAG failure (wcag412): Ensure every form element has a label
- **Recommended fix:** See https://dequeuniversity.com/rules/axe/4.10/label?application=playwright
- **Fix status:** Open

### Not verified (9)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| A11Y-AXE-pages-broken | axe-core scan | NOT TESTED | HTTP 404; page did not load |
| A11Y-M01 | Full keyboard pass: every control reachable and operable, logical order, no trap | NOT TESTED | Not performed |
| A11Y-M02 | Screen reader pass (NVDA, VoiceOver or Orca) on the purchase path | NOT TESTED | Not performed |
| A11Y-M03 | Zoom to 200% and reflow at 320px without loss of content or function | NOT TESTED | Not performed |
| A11Y-M04 | Alt text is meaningful (not just present); decorative images have empty alt | NOT TESTED | Not performed |
| A11Y-M05 | Form errors are identified in text, linked to the field and announced | NOT TESTED | Not performed |
| A11Y-M06 | Modals, drawers and menus manage focus (move in, trap inside, return on close, Escape closes) | NOT TESTED | Not performed |
| A11Y-M07 | Motion: autoplay carousels and video can be paused; prefers-reduced-motion respected | NOT TESTED | Not performed |
| A11Y-M08 | axe 'incomplete' items (needs review) checked by a person | NOT TESTED | Not performed |

## 12. Technical Audit

**Score: 0 (not assessed) / 5** · coverage 0% · 0 passed, 0 failed, 8 untested

**What is needed to improve:** run or verify 8 unverified check(s) (TECH-M01, TECH-M02, TECH-M03, TECH-M04, TECH-M05, TECH-M06, +2 more).

No open defects among the checks that were run.

### Not verified (8)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| TECH-M01 | Theme is under version control or a backup copy exists before any change | NOT TESTED | Not performed |
| TECH-M02 | Sections and blocks use valid schema and are editable in the theme editor | NOT TESTED | Not performed |
| TECH-M03 | Liquid review: no unbounded loops, heavy logic in loops, or deprecated objects and filters | NOT TESTED | Not performed |
| TECH-M04 | Assets: no unused or duplicated libraries; scripts deferred; images use responsive image_url sizes | NOT TESTED | Not performed |
| TECH-M05 | Leftover app code from uninstalled apps removed from the theme | NOT TESTED | Not performed |
| TECH-M06 | Theme settings and translations complete; no hard-coded strings that should be translatable | NOT TESTED | Not performed |
| TECH-M07 | Installed apps reviewed for overlap, necessity and storefront impact | NOT TESTED | Not performed |
| TECH-M08 | Custom code changes are documented and limited to a development theme until approved | NOT TESTED | Not performed |

## 13. Security & Trust Findings

**Score: 1.6 / 5** · coverage 65% · 12 passed, 5 failed, 9 untested

**What is needed to improve:** fix 5 open defect(s) (SEC-SECRETS-products-bad-mug, SEC-HDR-CSP, SEC-HDR-FRAME, SEC-HDR-REFERRER, SEC-HDR-XCTO) and retest them; run or verify 9 unverified check(s) (SEC-COOKIE-CONSENT, SEC-3P-INVENTORY, SEC-M01, SEC-M02, SEC-M03, SEC-M04, +3 more).

### Open defects (5)

#### D-001 · SEC-SECRETS-products-bad-mug · No secret-looking tokens in page source or first-party scripts
- **Severity:** critical
- **Location:** /products/bad-mug
- **Expected:** No Admin API tokens, live payment keys or private keys
- **Actual:** Shopify Admin/app access token x1 in page HTML (shpat_[REDACTED]). Values redacted; rotate before anything else.
- **Evidence:** see test-case-log.csv
- **Impact:** Anyone can read the token and call the API with its permissions.
- **Recommended fix:** Revoke/rotate the credential now, then remove it from theme code; keep secrets server-side.
- **Fix status:** Open

#### D-017 · SEC-HDR-CSP · Content-Security-Policy header
- **Severity:** low
- **Location:** /
- **Expected:** Present
- **Actual:** Header absent
- **Evidence:** see test-case-log.csv
- **Impact:** Missing browser-side hardening (defence in depth).
- **Recommended fix:** Shopify sends a baseline policy; a proxy may be stripping it.
- **Fix status:** Open

#### D-018 · SEC-HDR-FRAME · Clickjacking protection
- **Severity:** low
- **Location:** /
- **Expected:** X-Frame-Options or CSP frame-ancestors
- **Actual:** Header absent
- **Evidence:** see test-case-log.csv
- **Impact:** Missing browser-side hardening (defence in depth).
- **Recommended fix:** Restore the default headers (check proxies/apps).
- **Fix status:** Open

#### D-019 · SEC-HDR-REFERRER · Referrer policy
- **Severity:** low
- **Location:** /
- **Expected:** Referrer-Policy header present
- **Actual:** Header absent
- **Evidence:** see test-case-log.csv
- **Impact:** Missing browser-side hardening (defence in depth).
- **Recommended fix:** Add <meta name="referrer" content="strict-origin-when-cross-origin"> or the header at the proxy.
- **Fix status:** Open

#### D-020 · SEC-HDR-XCTO · X-Content-Type-Options: nosniff
- **Severity:** low
- **Location:** /
- **Expected:** nosniff
- **Actual:** Header absent
- **Evidence:** see test-case-log.csv
- **Impact:** Missing browser-side hardening (defence in depth).
- **Recommended fix:** Restore the default headers (check proxies/apps).
- **Fix status:** Open

### Not verified (9)

| Test ID | Check | Status | Reason |
| --- | --- | --- | --- |
| SEC-COOKIE-CONSENT | Cookie consent mechanism | NOT TESTED | No banner detected for this visitor. Banners are often region-gated, so absence here is not proof; verify from a target region. |
| SEC-3P-INVENTORY | Third-party scripts are known and justified | NOT TESTED | 0 third-party script host(s) listed in evidence. Review needed: none |
| SEC-M01 | Staff accounts, collaborator access and two-step authentication reviewed | NOT TESTED | Not performed |
| SEC-M02 | App permissions and custom-app API scopes reviewed | NOT TESTED | Not performed |
| SEC-M03 | Third-party script inventory reviewed with the owner | NOT TESTED | Not performed |
| SEC-M04 | Legal and trust pages complete and accurate (privacy, refund, shipping, terms, contact details) | NOT TESTED | Not performed |
| SEC-M05 | Cookie consent and customer privacy settings match the target markets | NOT TESTED | Not performed |
| SEC-M06 | Cookie-consent banner interaction: accept, decline and preferences are honoured and remembered | NOT TESTED | Not performed |
| SEC-M07 | No customer data in URLs or browser storage | NOT TESTED | Not performed |

## 14. CRO Recommendations

CRO items are hypotheses to test, not defects, and are not scored. No uplift is claimed.

| ID | Hypothesis / check | Status | Notes |
| --- | --- | --- | --- |
| CRO-M01 | Hypothesis: value proposition and primary call to action above the fold on the homepage | NOT TESTED |  |
| CRO-M02 | Hypothesis: trust signals near the buy button (reviews, returns, delivery time, secure payment) | NOT TESTED |  |
| CRO-M03 | Hypothesis: friction in cart and checkout entry (forced account, surprise costs, distractions) | NOT TESTED |  |
| CRO-M04 | Hypothesis: navigation and findability (menu labels, category structure, path to a product) | NOT TESTED |  |
| CRO-M05 | Hypothesis: search and collection pages (filtering, sorting, merchandising, product-card information) | NOT TESTED |  |
| CRO-M06 | Hypothesis: product page persuasion (media, copy, benefits, sizing and delivery information) | NOT TESTED |  |
| CRO-M07 | Hypothesis: pricing and offers (discount clarity, free-shipping threshold, bundles) | NOT TESTED |  |
| CRO-M08 | Hypothesis: social proof and urgency (reviews, ratings, stock or delivery cut-off messages that are truthful) | NOT TESTED |  |
| CRO-M09 | Hypothesis: mobile purchase experience (sticky add to cart, thumb reach, form effort) | NOT TESTED |  |
| CRO-M10 | Hypothesis: speed perception and loading feedback (skeletons, button states, cart feedback) | NOT TESTED |  |
| CRO-M11 | Hypothesis: post-purchase and retention (email capture, account value, reorder path) | NOT TESTED |  |

## 15. Screenshots & Evidence

| Folder | Files | Examples |
| --- | --- | --- |
| evidence/a11y/ | 8 | axe-cart.json, axe-collections-all.json, axe-home.json, axe-pages-contact.json |
| evidence/functional/ | 15 | cart-totals.png, cart-with-item.png, cart.png, collections-all.png |
| evidence/inventory/ | 0 |  |
| evidence/responsive/ | 48 | cart-1366.png, cart-1920.png, cart-320.png, cart-375.png |
| evidence/security/ | 2 | cookies.json, third-party-scripts.json |
| evidence/seo/ | 1 | onpage.json |

## 16. Bug / Defect Register

| Defect | Test ID | Severity | Category | Location | Issue | Fix status |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | SEC-SECRETS-products-bad-mug | critical | Security & Trust | /products/bad-mug | No secret-looking tokens in page source or first-party scripts | Open |
| D-002 | FN-LOAD-pages-broken | high | Functionality & Reliability | /pages/broken | Page loads | Open |
| D-003 | RSP-OVERFLOW-products-bad-mug-320 | high | Mobile & Responsive | /products/bad-mug | No horizontal overflow at 320px | Open |
| D-004 | RSP-OVERFLOW-products-bad-mug-375 | high | Mobile & Responsive | /products/bad-mug | No horizontal overflow at 375px | Open |
| D-005 | RSP-OVERFLOW-products-bad-mug-430 | high | Mobile & Responsive | /products/bad-mug | No horizontal overflow at 430px | Open |
| D-006 | A11Y-AXE-color-contrast-products-bad-mug | high | Accessibility | /products/bad-mug | Elements must meet minimum color contrast ratio thresholds | Open |
| D-007 | A11Y-AXE-image-alt-products-bad-mug | high | Accessibility | /products/bad-mug | Images must have alternative text | Open |
| D-008 | A11Y-AXE-label-products-bad-mug | high | Accessibility | /products/bad-mug | Form elements must have labels | Open |
| D-009 | FN-CONSOLE-products-bad-mug | medium | Functionality & Reliability | /products/bad-mug | No console errors on load | Open |
| D-010 | FN-LINKS | medium | Functionality & Reliability | site | Internal links respond without error | Open |
| D-011 | SEO-ALT-products-bad-mug | medium | SEO | /products/bad-mug | Images have an alt attribute | Open (retest failed) |
| D-012 | SEO-DESC-products-bad-mug | medium | SEO | /products/bad-mug | Meta description present, 50-165 characters | Fixed – verified by retest |
| D-013 | SEO-H1-products-bad-mug | medium | SEO | /products/bad-mug | Exactly one H1 | Open (retest failed) |
| D-014 | SEO-PRODUCT-SCHEMA-products-bad-mug | medium | SEO | /products/bad-mug | Product structured data with name and priced offer | Open (retest failed) |
| D-015 | RSP-TAP-products-good-tee-375 | low | Mobile & Responsive | /products/good-tee | Tap targets at least 24x24 CSS px | Open |
| D-016 | SEO-BREADCRUMB-products-bad-mug | low | SEO | /products/bad-mug | BreadcrumbList structured data | Open (retest failed) |
| D-017 | SEC-HDR-CSP | low | Security & Trust | / | Content-Security-Policy header | Open |
| D-018 | SEC-HDR-FRAME | low | Security & Trust | / | Clickjacking protection | Open |
| D-019 | SEC-HDR-REFERRER | low | Security & Trust | / | Referrer policy | Open |
| D-020 | SEC-HDR-XCTO | low | Security & Trust | / | X-Content-Type-Options: nosniff | Open |

Full detail: defect-register.csv.

## 17. Professional Scorecard

| Category | Score | Weight | Coverage | Pass | Fail | Untested | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI/UX & Visual Design | 0 (not assessed) | 15 | 0% | 0 | 0 | 10 |  |
| Functionality & Reliability | 9.9 | 20 | 64% | 26 | 3 | 16 |  |
| E-commerce & Checkout | 6.9 | 15 | 46% | 12 | 0 | 14 |  |
| Mobile & Responsive | 7.2 | 10 | 88% | 60 | 4 | 9 |  |
| SEO | 7.6 | 10 | 85% | 54 | 4 | 10 |  |
| Performance | 0 (not assessed) | 10 | 0% | 0 | 0 | 3 |  |
| Accessibility | 2.7 | 10 | 59% | 10 | 3 | 9 |  |
| Technical Quality & Maintainability | 0 (not assessed) | 5 | 0% | 0 | 0 | 8 |  |
| Security & Trust | 1.6 | 5 | 65% | 12 | 5 | 9 |  |

Formula: category score = weight x coverage x quality. Coverage = (PASS+FAIL) / applicable checks. Quality = PASS / (PASS + weighted FAILs; critical 8, high 4, medium 2, low 1). Untested checks earn no points and lower confidence.

## 18. Fixes Implemented

| Defect | Test ID | Issue | Status |
| --- | --- | --- | --- |
| D-012 | SEO-DESC-products-bad-mug | Meta description present, 50-165 characters | Fixed – verified by retest |

### Attempted, not verified by retest

A retest was run for these defects but did not confirm the fix. They stay open and are not counted as fixed.

| Defect | Test ID | Issue | Status |
| --- | --- | --- | --- |
| D-011 | SEO-ALT-products-bad-mug | Images have an alt attribute | Open (retest failed) |
| D-013 | SEO-H1-products-bad-mug | Exactly one H1 | Open (retest failed) |
| D-014 | SEO-PRODUCT-SCHEMA-products-bad-mug | Product structured data with name and priced offer | Open (retest failed) |
| D-016 | SEO-BREADCRUMB-products-bad-mug | BreadcrumbList structured data | Open (retest failed) |

## 19. Regression Results

Retest files: seo.retest.json. 1 fixed and verified, 4 still open or unverified, 0 regression(s).

| Defect | Test ID | Issue | Result |
| --- | --- | --- | --- |
| D-011 | SEO-ALT-products-bad-mug | Images have an alt attribute | Open (retest failed) |
| D-013 | SEO-H1-products-bad-mug | Exactly one H1 | Open (retest failed) |
| D-014 | SEO-PRODUCT-SCHEMA-products-bad-mug | Product structured data with name and priced offer | Open (retest failed) |
| D-016 | SEO-BREADCRUMB-products-bad-mug | BreadcrumbList structured data | Open (retest failed) |

## 20. Remaining Risks & Limitations

- 99 check(s) are NOT TESTED and 0 are BLOCKED. They earn no points; see test-case-log.csv.
- Pages: 9 discovered, 9 selected, 9 inspected with at least one verified result, 0 untested. Strategy: template sampling. This is a template sample, not the whole site: 0 discovered page(s) were not inspected. Re-run with --all for full coverage.
- Responsive results come from emulated viewports in headless Chromium, not physical devices or other browser engines (Safari, Firefox).
- No Lighthouse run produced a result.
- Automated accessibility rules (axe-core) detect only part of WCAG 2.2 AA. Conformance is not claimed without the manual checks A11Y-M01 to A11Y-M08.
- Security review is passive (headers, cookies, exposed patterns, mixed content). No penetration testing was performed and the store is not certified secure.
- Automation stops at the checkout entry. Contact, shipping, payment and confirmation are verified only if the manual checks EC-M07 to EC-M10 were performed on a test gateway. No purchase was made by the scripts.
- Theme source code was not provided or not analysed: the technical audit is limited to what is visible from the storefront.
- Search-engine indexing status, rankings and Search Console data were not verified unless a manual SEO check says so.

## 21. Final Independent Verdict

**Verdict: NOT READY FOR PRODUCTION**

- Total score: **35.9 / 100**
- Confidence: **Medium** (overall coverage 69%; 193 of 281 applicable checks have a PASS or FAIL result)
- Open defects: 1 critical, 7 high, 5 medium, 6 low

Rules that produced this verdict:
- NOT READY: 1 open critical defect(s): SEC-SECRETS-products-bad-mug
- NOT READY: total score 35.9 is below 70
- NOT READY: 1 open high-severity defect(s) in functionality, e-commerce or security: FN-LOAD-pages-broken

**Independent review: NOT DONE.** This is the computed verdict only (a ceiling), not an independent verdict. See references/05 §Independent final audit.

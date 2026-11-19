---
name: shopify-professional-auditor
description: Use when asked to audit, inspect, QA, review, score, or certify a Shopify store or theme; when checking a storefront's UI/UX, responsiveness, functionality, cart and checkout journey, SEO, performance, accessibility, security or Liquid theme quality; when deciding whether a Shopify store is production ready; or when fixing and re-testing defects found in a Shopify audit.
---

# Shopify Professional Auditor

Evidence-first audit, QA and fix-verification system for Shopify stores. Every claim in a report traces to a test record with evidence. Untested is reported as untested, never as passing.

All paths below are relative to this skill's directory. `OUT` is the audit output directory for one store (create one per audit, e.g. `audits/<store>-<YYYY-MM-DD>`).

## Non-negotiable rules

1. **Read-only by default.** Storefront inspection changes nothing. The only state touched is the anonymous session cart.
2. **Claim only verified access.** Public URL only means a public-facing audit. Never state or imply Admin, source code, or checkout-configuration access that was not established in this session.
3. **Never ask for passwords or tokens in chat.** Storefront password: the user unlocks it themselves with `node scripts/auth-session.mjs`. Theme/Admin: `shopify` CLI browser login. Secrets live in environment variables.
4. **Checkout = reachability only.** Never fill payment details, place orders, issue refunds, or touch payment settings. Test orders need explicit user authorization AND a development store or test gateway.
5. **Security checks are passive.** No fuzzing, brute force, injection, scanning, or anything aimed at third-party services. Never write "the store is secure".
6. **PASS means verified.** Statuses: `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED`, `N/A`. Clickable is not working; a media query is not a responsive pass; an axe pass is not WCAG conformance.
7. **Never fabricate** scores, screenshots, logs, business facts, or indexing status. Separate observation, assumption and verified result.
8. **Fixes go to a development or unpublished theme**, after a backup (`shopify theme pull` + Git commit). Explicit approval is required before anything in `references/01-access-and-safety.md` §Approval gates.
9. **No secrets or customer data in reports.** Scripts redact; check manual notes too.

## Workflow

| # | Phase | Read | Run |
|---|-------|------|-----|
| 0 | Access & scope | `references/01-access-and-safety.md` | `node scripts/auth-session.mjs` (locked stores only) |
| 1 | Store discovery | `references/02-discovery-and-inventory.md` §Discovery | fill `templates/discovery.md` → `OUT/discovery.md` |
| 2 | Page inventory & coverage | `references/02-discovery-and-inventory.md` §Inventory | `node scripts/inventory.mjs` |
| 3 | Functional + e-commerce journey | `references/03-test-procedures.md` §FN §EC | `node scripts/functional.mjs` |
| 4 | UI/UX + responsive | `references/03-test-procedures.md` §UI §RSP | `node scripts/responsive.mjs` + manual review of screenshots |
| 5 | SEO | `references/03-test-procedures.md` §SEO | `node scripts/seo.mjs` |
| 6 | Performance | `references/03-test-procedures.md` §PERF | `node scripts/lighthouse.mjs` |
| 7 | Accessibility | `references/03-test-procedures.md` §A11Y | `node scripts/a11y.mjs` + manual checks |
| 8 | Shopify technical (theme access only) | `references/04-shopify-technical.md` | `bash scripts/theme-check.sh THEME_DIR OUT` |
| 9 | Security & trust | `references/03-test-procedures.md` §SEC | `node scripts/security.mjs` |
| 10 | CRO | `references/03-test-procedures.md` §CRO | manual, unscored |
| 11 | Fix & re-test (audit-and-fix only) | `references/06-evidence-fix-retest.md` | rerun the collector with `--retest` |
| 12 | Score & independent verdict | `references/05-scoring-and-verdict.md` | `node scripts/report.mjs --out OUT`, then a **fresh-context reviewer** writes `OUT/independent-review.json`, then `report.mjs` again |
| 13 | Deliverables | `templates/final-report.md` (21 sections) | complete `OUT/audit-report.md` |

Phases 2–9 (automated part) run in one command with `run-all.mjs`. Automation never completes an audit: `OUT/results/manual.json` holds the manual checks, all `NOT_TESTED` until the auditor performs them.

## Quick start

```bash
cd scripts && npm install          # once; npx playwright install chromium if no browser is cached
npm run selftest                   # proves the toolchain against a local fixture store
node run-all.mjs --url https://store.example --out /abs/path/OUT
node report.mjs --out /abs/path/OUT   # re-run after editing manual.json or after retests
```

### Every store you build (per-project launcher)

```bash
node scripts/audit.mjs install     # once per machine: puts `shopify-audit` in ~/.local/bin
cd ~/projects/new-store            # each project root
shopify-audit init --store x.myshopify.com --live https://example.com   # writes shopify-audit.json, gitignores audits/
shopify theme dev                  # other terminal; serves http://127.0.0.1:9292
shopify-audit                      # audits the default target (local)
shopify-audit preview              # targets.preview = https://x.myshopify.com/?preview_theme_id=ID
shopify-audit live --field         # any run-all flag passes through
shopify-audit auth live            # password-protected store: owner types it once; reused by every run
shopify-audit report [target]      # rebuild the report in the latest folder for that target
```

Each run writes `audits/<target>-<host>-<date>[-N]/` (that is OUT). `--retest`/`--only` reuse the latest folder for the target. `themeDir` (auto-detected by `init`) is passed as `--theme`; `options` in the config sets `autoAll`, `max`, `skipLighthouse`, `field` (live only). Local target: if the dev server is down the launcher exits 3 and says to start `shopify theme dev`. Preview target: the launcher first visits the preview URL headless, saves the preview cookie into `OUT/.auth/storage-state.json`, and writes `OUT/preview-check.json`; if `window.Shopify.theme.id` on a page without the query does not match the requested ID it warns that results may describe the live theme. Treat that warning as a blocker for preview results. Preview cookie behaviour has not yet been verified on a real store. Exit codes are run-all's, plus 65 = no `shopify-audit.json`.

Useful flags: `--all` (inspect every discovered page), `--auto-all N` (stores with at most N non-account pages are inspected in full; default 50), `--max N` (sample size for larger stores, default 15; passing it forces sampling), `--skip-lighthouse`, `--theme DIR` (adds Theme Check), `--retest`, `--only seo,a11y`, `--field` (Lighthouse: also query CrUX via PageSpeed Insights; sends the URL to Google). `--max` is forwarded to functional, responsive, seo and a11y; without it, functional, seo and a11y test every page inventory selected; responsive takes one page per type first and defaults to 6 pages; security always uses its own default of 6.

Run-level records: `--skip-lighthouse` writes `PERF-LIGHTHOUSE` `NOT_TESTED`. A collector that exits non-zero leaves `<AREA>-COLLECTOR` `BLOCKED` (`FUNCTIONAL-`, `RESPONSIVE-`, `SEO-`, `A11Y-`, `SECURITY-`, `PERFORMANCE-`). `INVENTORY-COLLECTOR` `BLOCKED` stops the run: no collector starts.

Requirements: node >= 20, the Playwright Chromium from `scripts/node_modules` (or any Chrome/Chromium via the `CHROME_PATH` environment variable), and, for `--theme`, the Shopify CLI (`shopify theme check` is used; jq, ruby and a standalone `theme-check` are not needed). `run-all.mjs` prints `[preflight] WARN` lines for anything missing and carries on; a missing CLI makes Theme Check `BLOCKED`.

URL-only audit: with no theme files or CLI, Technical Quality scores 0 and confidence cannot be High, so the verdict cannot be PRODUCTION READY. The store owner can list `technical` under `acceptedUnassessed` in `OUT/risk-acceptance.json` (see `templates/risk-acceptance.example.json` and `references/05`); it still scores 0.

Password-protected storefront: `node scripts/auth-session.mjs --url URL --out OUT`, the user types the password in the opened browser, presses Enter in the terminal; all collectors then reuse `OUT/.auth/storage-state.json`.

## Test record (every test, automated or manual)

```json
{ "id": "EC-ATC", "category": "ecommerce", "title": "Add to cart from product page",
  "page": "/products/x", "preconditions": "...", "steps": ["..."],
  "expected": "...", "actual": "...", "status": "PASS|FAIL|BLOCKED|NOT_TESTED|N/A",
  "severity": "critical|high|medium|low|null", "evidence": ["evidence/functional/x.png"],
  "date": "ISO-8601", "environment": "chromium 145 / 1366x768 / https://store",
  "source": "automated|manual", "impact": "...", "fix": "..." }
```

Categories: `uiux functionality ecommerce mobile seo performance accessibility technical security` (scored) and `cro` (unscored). IDs are stable (`SEO-DESC-<page-slug>`), which is what lets a retest supersede the original.

Manual records go in `OUT/results/manual.json`. A manual record with the same `id` as an automated one overrides it — use this to adjudicate a false positive, with the justification in `actual`. A manual row still `NOT_TESTED` never overrides an automated result.

## Quick reference

| Need | Use | Interpreting it |
|------|-----|-----------------|
| What pages exist / were covered | `OUT/inventory.json`, `OUT/page-inventory.csv` | Discovered ≠ inspected. Report all three counts. |
| Does X work | `OUT/results/functional.json` | FAIL needs reproduction by hand before reporting as critical. |
| Layout at 320–1920 | `OUT/evidence/responsive/*.png` | Overflow check is automatic; visual quality is a manual judgement on the screenshots. |
| Lab performance | `OUT/evidence/performance/*.report.html` | Lab data, one run, simulated throttling. INP is field-only. |
| Accessibility | `OUT/results/a11y.json` | axe finds roughly a third of WCAG issues. Manual keyboard/screen-reader checks are mandatory. |
| Theme code quality | `OUT/evidence/technical/theme-check.json` | Requires local theme files. Without them the category is "not assessed" (0 points). |
| Score, verdict | `OUT/score.json`, `OUT/scorecard.md` | Computed verdict is a ceiling: the auditor may downgrade, never upgrade. |
| Was it independently reviewed | `OUT/independent-review.json`, report §21 | "Independent review: NOT DONE" means the verdict is not final. Never review your own work in the same context. |
| All defects | `OUT/defect-register.csv` | One row per failed test, with fix status. |

## Common mistakes

| Mistake | Correct behaviour |
|---------|-------------------|
| Reporting the run-all output as "the audit" | Do the manual checks in `manual.json`, or leave them `NOT_TESTED` and say so. |
| Giving points for untested areas | Untested lowers coverage, score and confidence. Never assume PASS. |
| "Checkout works" after seeing the checkout page load | Say exactly: reached checkout URL; contact/shipping/payment/order stages not tested. |
| Calling Lighthouse numbers "Core Web Vitals" | Lab vs field. Only CrUX/PSI field data are real-user CWV. |
| Claiming pages are indexed by Google | Only indexability signals are verified; indexing needs Search Console. |
| Listing taste as defects | A defect cites a rule, a broken behaviour, or measurable harm. Preference goes in CRO/suggestions. |
| Promising conversion uplift | CRO items are hypotheses unless analytics or experiment data were provided. |
| Editing the live theme | Duplicate to a development theme, back up, fix, retest, then ask before publishing. |
| Declaring a good-looking store professional | Verdict follows evidence and the scoring caps, not appearance. |

## First message when invoked without a URL

Ask only these, then start:

1. Store URL, and is the storefront password-protected?
2. Audit only, or audit and fix?
3. Access available: storefront only / theme files or `shopify` CLI / Admin staff account?
4. Checkout: reachability only (default), or test orders on a development store with a test gateway?
5. Optional: target audience, markets, priorities, known problems.

With only a public URL, start the public-facing audit immediately and record everything else as unknown in the discovery document.

## Limitations of this skill

- Automated collectors use heuristics tuned for Online Store 2.0 themes; headless or heavily customised storefronts need more manual work.
- Bot protection or rate limiting can block collectors; such tests are `BLOCKED`, not failed.
- No screen-reader automation, no real-device testing, no load testing, no penetration testing.
- Admin configuration (payments, taxes, shipping, apps, customer data) is outside what the scripts can see.

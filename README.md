# shopify-professional-auditor

An evidence-first audit and QA system for Shopify stores, packaged as a [Claude skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview).

It inspects a storefront the way a QA engineer would and scores it out of 100. A verdict is issued only from what was actually tested. Anything it could not test is reported as **NOT TESTED** or **BLOCKED**, never as passing.

## What it checks

| Area | How |
|------|-----|
| Page inventory and coverage | robots.txt, sitemaps, homepage links (Playwright) |
| Functionality and the purchase journey | real add-to-cart, quantity, cart update/remove, checkout reachability (no orders placed) |
| Responsive layout | real Chromium rendering at 320, 375, 430, 768, 1366 and 1920 px |
| SEO | titles, descriptions, headings, canonicals, JSON-LD, product and breadcrumb schema, robots, sitemap |
| Performance | Lighthouse lab runs; optional CrUX field data |
| Accessibility | axe-core (WCAG 2.2 AA rules) plus a keyboard probe; manual checklist for the rest |
| Security and trust | passive only: headers, mixed content, exposed secrets, cookies, privacy links |
| Theme code | Shopify Theme Check (when theme files are available) |

## Design decisions

- **PASS means verified.** A clickable button is not a working button. A media query is not a responsive pass.
- **One root cause, one defect.** A theme bug that shows up on 18 pages is scored once, and the register shows every page it affects.
- **No self-approval.** The final verdict comes from a reviewer in a fresh context. Without that review the report prints *Independent review: NOT DONE*, and the reviewer can lower the verdict but never raise it.
- **No verdict without evidence.** If nothing could be tested, the report says *NO VERDICT* instead of scoring the store 0.
- **A FAIL must reproduce.** Journey checks wait for the page to settle and retry once from a fresh load before failing. When bot protection refuses Lighthouse, it backs off once, then stops and points to PageSpeed Insights.
- **Safe by default.** Read-only. No real orders, no form submissions, no passwords in chat, no active security testing.

## Quick start

```bash
cd scripts && npm ci                # Node >= 20
npx playwright install chromium     # or set CHROME_PATH to an existing Chrome/Chromium
npm run selftest                    # 73 checks against a bundled fake store
node run-all.mjs --url https://your-store.com --out ../audits/your-store
```

Output: `audit-report.md` (21 sections), `scorecard.md`, `defect-register.csv`, `test-case-log.csv`, plus screenshots and raw tool output under `evidence/`.

As a Claude skill: copy this folder to `~/.claude/skills/shopify-professional-auditor/`, then ask Claude to audit a Shopify store. `SKILL.md` drives the workflow.

## Layout

```
SKILL.md        workflow and rules Claude follows
references/     procedures: access and safety, discovery, test procedures, theme, scoring, fix and retest
scripts/        collectors, report builder, selftest with a fixture store
templates/      discovery doc, manual checklist (86 rows), bug report, final report
evals/          behaviour tests for the skill (no fabricated scores, no self-approval, no real orders)
```

## Case study: STARWORLD (starworldd.com), November 2026

The first run against a real store (a live Egyptian streetwear shop on Shopify's Horizon theme) tested the tool as much as the store.

**The tool was wrong about 45 of 124 "defects".** The real store exposed bugs the fixture never could:

| False result | Cause | Fix in the tool |
|---|---|---|
| Console and network errors on every page (38) | The auditor's DNS blocker refused Shopify's own telemetry | Telemetry hosts are counted but never scored |
| SEO and accessibility failures on `/agents.md` (7) | Shopify lists an AI-agent text file in its sitemap | Non-HTML URLs are not inspected as pages |
| "Text under 12px" on gallery dots | Visually hidden text (font-size 0) | Hidden text is skipped |
| Broken account links (406) | Bot protection on login pages | 405/406 count as inconclusive |
| Cart update reported as a high-severity FAIL | Automation could not drive the theme's +/- control | Presses the + button; API-only success is BLOCKED, not FAIL |
| One theme bug counted on up to 18 pages | Scoring per record | Scored once per root cause |
| Variant check failed once, passed on rerun | Timing | Settle and retry before FAIL |
| Lighthouse refused with HTTP 403 | Bot protection after repeated runs | Back off once, then fall back to PageSpeed Insights |

**Real store fixes shipped** (3 theme files, through backup → unpublished preview → browser verification → file-only push to the live theme):
the logo link got an accessible name, the gallery controls use `aria-current` instead of the invalid `aria-selected` (axe: critical), and the slide dots got a 24 px tap target.

| | First run | After |
|---|---|---|
| Score | 30.8 | 49.2 |
| Open defects | 124 | 70 |
| Distinct root causes | 39 (regrouped) | 18 |
| Mobile performance (lab) | 79 | 91 (PageSpeed Insights) |

Most of the score change came from removing false positives, not from the store getting better. The verdict is still **NOT READY FOR PRODUCTION**: image links without alt text, missing meta descriptions, a duplicate product title and gallery keyboard access remain open.

## Limitations

- Heuristics are tuned for Online Store 2.0 themes. Headless storefronts need more manual work.
- Bot protection can block collectors. Those checks are BLOCKED, not failed.
- No screen-reader automation, no real-device testing, no load or penetration testing.
- Admin settings (payments, shipping, apps) are outside what the scripts can see.

## License

MIT

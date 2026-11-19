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

## Limitations

- Heuristics are tuned for Online Store 2.0 themes. Headless storefronts need more manual work.
- Bot protection can block collectors. Those checks are BLOCKED, not failed.
- No screen-reader automation, no real-device testing, no load or penetration testing.
- Admin settings (payments, shipping, apps) are outside what the scripts can see.

## License

MIT

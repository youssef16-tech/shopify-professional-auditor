# Scoring and verdict

Computed by `node scripts/report.mjs --out OUT` from the test records. The numbers are reproducible: same records, same score.

## Severity

| Severity | Definition | Examples |
|----------|-----------|----------|
| Critical | Blocks purchasing, loses orders/data, exposes secrets or customer data, or makes the store unusable for a major group | Add to cart broken; checkout unreachable; private token in page source; homepage 5xx |
| High | Major feature broken or seriously degraded; serious accessibility barrier; key page not indexable | Mobile menu does not open; product page overflows on phones; keyboard trap; `noindex` on products |
| Medium | Noticeable defect with a workaround; standards violation with moderate impact | Console errors; broken footer link; missing meta description; LCP 3.5 s |
| Low | Cosmetic or best-practice deviation | Title slightly long; missing optional header |

Severity describes user/business impact, not effort to fix.

## Category weights (100)

| Category key | Category | Weight |
|--------------|----------|--------|
| `uiux` | UI/UX & Visual Design | 15 |
| `functionality` | Functionality & Reliability | 20 |
| `ecommerce` | E-commerce & Checkout | 15 |
| `mobile` | Mobile & Responsive | 10 |
| `seo` | SEO | 10 |
| `performance` | Performance | 10 |
| `accessibility` | Accessibility | 10 |
| `technical` | Technical Quality & Maintainability | 5 |
| `security` | Security & Trust | 5 |

`cro` records are reported but unscored.

## Formula

Per category, over its records excluding `N/A`:

- `coverage = (PASS + FAIL) / all` — `BLOCKED` and `NOT_TESTED` earn nothing.
- `quality = PASS / (PASS + Σ failWeight)`, failWeight: critical 8, high 4, medium 2, low 1.
- `score = weight × coverage × quality`.
- No records, or nothing tested → 0, labelled **not assessed**.
- Any open critical defect caps the category at 40% of its weight.

Total = sum of categories. An open critical defect in `ecommerce` or `security` caps the **total at 59**: a high visual score never compensates for a broken purchase journey or a critical security problem.

A defect fixed and verified by retest counts as PASS; a regression counts as FAIL.

## Confidence

| Confidence | Condition |
|------------|-----------|
| High | Overall coverage ≥ 85% and every scored category assessed or listed in `acceptedUnassessed` |
| Medium | Overall coverage ≥ 60% |
| Low | Otherwise |

Always print coverage next to the score. A score with Low confidence is an indication, not an assessment.

## Verdict rules

1. **NOT READY FOR PRODUCTION** if any: an open critical defect; total < 70; an open high defect in `functionality`, `ecommerce` or `security`.
2. **PRODUCTION READY** only if all: no open critical or high defects; total ≥ 85; confidence High; every `core` record is PASS, or is listed in `OUT/risk-acceptance.json` (see `templates/risk-acceptance.example.json`) with a named `acceptedBy` and reason.
3. Otherwise **READY WITH NON-CRITICAL ISSUES**.

The computed verdict is a ceiling. The auditor may downgrade it with a written reason (e.g. a manual finding the scripts cannot weigh). Upgrading is not allowed; change the evidence instead (test the untested, fix and retest).

Risk acceptance is the store owner's documented decision, never the auditor's assumption. It lifts the "core unverified" condition only — it never turns a FAIL into a PASS and adds no points.

`acceptedUnassessed` (optional, category keys or names, e.g. `["technical"]`) records that the owner accepts a whole category as not assessed — typically Technical Quality on a public-URL-only audit with no theme files or CLI. The category still scores 0 (so the total caps at 95), but it no longer blocks High confidence, so PRODUCTION READY becomes reachable when every other condition holds. The report prints the acceptance, who gave it and why. Without this file, a URL-only audit cannot be PRODUCTION READY (Phase 17: unverified critical areas need documented risk acceptance).

## Independent final audit

The auditor who did the work cannot also approve it. Re-reading your own results in the same context finds what you already believe, so the final check runs in a **fresh context that never saw the work**.

How:

1. Finish everything else first, then run `node scripts/report.mjs --out OUT`.
2. Start the reviewer:
   - With an agent/subagent tool (Claude Code, Cowork): spawn one with the prompt below. Give it only the two paths. Do not summarise your findings for it, because that would hand it your conclusions.
   - Without one: tell the user to open a new session and paste the prompt below. Never do the review in the same context and call it independent.
3. When the reviewer is done, rerun `node scripts/report.mjs --out OUT`. The report then prints the reviewer's verdict in section 21. Without `OUT/independent-review.json` it prints **Independent review: NOT DONE**, and the verdict must not be presented as final.

Reviewer prompt (fill in OUT and the store URL):

> You are an independent auditor who did not do this Shopify audit. Read `references/05-scoring-and-verdict.md` in the skill at SKILL_DIR, then the audit at OUT (`score.json`, `test-case-log.csv`, `defect-register.csv`, `results/`, `evidence/`). Assume the previous auditor was too generous.
> 1. Re-run the critical journey yourself: `node SKILL_DIR/scripts/functional.mjs --url URL --out OUT --retest`.
> 2. Work through the checklist below. For every record you do not accept, add a row with the same `id` to `OUT/results/manual.json`, status `FAIL` or `NOT_TESTED`, and `actual` starting with `[independent review]` plus your reason.
> 3. Write `OUT/independent-review.json`: `{"reviewer": "...", "date": "YYYY-MM-DD", "verdict": "<one of the three verdicts>", "reason": "...", "disputed": [{"id": "...", "why": "..."}], "reran": ["..."]}`.
> Do not edit any other file.

The reviewer's verdict can only lower the computed one. `report.mjs` ignores an attempt to raise it.

Reviewer checklist:

- Every FAIL: evidence file exists and shows the defect? Reproduced at least twice? Not a tool artefact?
- Every PASS: was the behaviour itself observed, or just an element's presence?
- Every `NOT_TESTED`/`BLOCKED` appears under Remaining Risks & Limitations.
- Coverage numbers match `page-inventory.csv`.
- Fixes: original test re-run and passing; regression pass done.
- No claim about indexing, real-user performance, security, conversion or WCAG conformance beyond what was measured.
- No secrets or personal data in any deliverable.

State the verdict, the reasons (the script lists the triggering rules), and the confidence level.

## Per-category write-up

For each category the report gives: score / weight, coverage, a short explanation, the evidence relied on, open defects (IDs), and recommended improvements.

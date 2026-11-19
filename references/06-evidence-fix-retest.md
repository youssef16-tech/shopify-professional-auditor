# Evidence, fixing and re-testing

## Output directory

```
OUT/
  discovery.md                 store discovery document
  inventory.json               pages, coverage strategy, Shopify globals
  results/<area>.json          test records per collector
  results/<area>.retest.json   retest records (written with --retest)
  results/manual.json          manual checks (from templates/manual-tests.json)
  evidence/<area>/             screenshots, raw tool output, link lists
  risk-acceptance.json         optional, owner-signed
  independent-review.json      written by the fresh-context reviewer (references/05)
  page-inventory.csv  test-case-log.csv  defect-register.csv
  score.json  scorecard.md  audit-report.md
  .auth/                       session state for locked stores (never share)
```

## Evidence rules

- Evidence is produced by a tool run or a real observation in this session. Never reconstruct, mock up, or describe a screenshot that was not taken.
- Every FAIL needs evidence. A PASS needs at least the record of what was observed (`actual`).
- Evidence paths in records are relative to `OUT`.
- Each record carries date and environment (browser build, viewport, target). Manual records: fill them in when the check is performed.
- Raw tool output is kept unedited (`*.report.json`, `theme-check.json`); interpretation goes in the report.
- Screenshots of pages showing personal data (accounts, orders) are not taken; crop or skip.
- If a tool failed, record `BLOCKED` with the error. Do not substitute an estimate.

## Bug report

Use `templates/bug-report.md` for defects that need more than the register row (anything critical/high, anything being fixed).

## Fix workflow (audit-and-fix mode only)

For each defect, in order:

1. **Reproduce** — run the original test again; confirm it still fails. Not reproducible → note it, do not "fix".
2. **Root cause** — identify the file/setting/app responsible. Distinguish theme code, theme settings, app injection, content, platform.
3. **Risk** — what else uses this code? What could regress? Is it reversible?
4. **Propose** — the smallest change that removes the cause.
5. **Approval** — required for anything under Approval gates (`01-access-and-safety.md`), for changes to visual design or business content, and for app/config changes. Routine code fixes on a development theme inside the agreed scope proceed.
6. **Implement** — on a development/unpublished theme (`shopify theme dev` or `shopify theme push --unpublished`), one Git commit per defect, message referencing the test ID. No unrelated changes, no opportunistic redesign.
7. **Re-run the original test** — same collector with `--retest`, pointed at the preview URL: e.g. `node scripts/seo.mjs --url PREVIEW_URL --out OUT --retest`.
8. **Regression** — rerun the collectors for areas the change could touch (at minimum `functional.mjs --retest`; layout changes also `responsive.mjs --retest`).
9. **Record** — `node scripts/report.mjs --out OUT`.

How the report reads retests (matched by test `id`):

| Original | Retest | Reported as |
|----------|--------|-------------|
| FAIL | PASS | Fixed – verified by retest |
| FAIL | FAIL | Open (retest failed) |
| FAIL | not reported any more, same check group re-ran | Fixed – verified by retest |
| PASS | FAIL | **REGRESSION** |
| any | BLOCKED / NOT_TESTED | Original stands; fix unverified |

Page slugs form part of the ID, so the preview URL must serve the same paths as the original (it does for `theme dev` and `?preview_theme_id=` previews).

A fix is "done" only with a passing retest. "Implemented, not verified" is a legitimate status and must be reported as such.

Publishing the fixed theme is a separate, explicitly approved step. After publishing, rerun the affected collectors against production.

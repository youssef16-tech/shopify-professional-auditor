# Scorecard

**Verdict: NOT READY FOR PRODUCTION**

- Total score: **35.9 / 100**
- Confidence: **Medium** (overall coverage 69%; 193 of 281 applicable checks have a PASS or FAIL result)
- Open defects: 1 critical, 7 high, 5 medium, 6 low

Rules that produced this verdict:
- NOT READY: 1 open critical defect(s): SEC-SECRETS-products-bad-mug
- NOT READY: total score 35.9 is below 70
- NOT READY: 1 open high-severity defect(s) in functionality, e-commerce or security: FN-LOAD-pages-broken

**Independent review: NOT DONE.** This is the computed verdict only (a ceiling), not an independent verdict. See references/05 §Independent final audit.

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

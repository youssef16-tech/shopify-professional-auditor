# Store discovery and page inventory

## Discovery

Output: `OUT/discovery.md` from `templates/discovery.md`.

Every field carries one of three markers:

- **Verified** — observed in this session; cite how (URL, script output, command).
- **Stated** — told by the user; quote or paraphrase them.
- **Unknown** — not established. Leave it unknown. Never fill gaps with plausible guesses.

What can be verified from the storefront alone (`inventory.mjs` records these in `OUT/inventory.json` → `shopify`):

| Field | Source |
|-------|--------|
| Store URL, `myshopify` domain | `window.Shopify.shop` |
| Theme name, id, parent theme and version | `window.Shopify.theme` (`name`, `id`, `schema_name`, `schema_version`) |
| Active currency, locale, country | `window.Shopify.currency.active`, `.locale`, `.country` |
| Languages / markets offered | localisation form options, `hreflang` links |
| Product and collection counts | sitemap URL counts (published and in sitemap only) |
| Third-party integrations | script origins in `OUT/evidence/security/third-party-scripts.json` |

What cannot be verified from the storefront: target audience, business objectives, revenue, traffic, installed-app list (only apps that inject front-end code are visible), payment providers before checkout, shipping rules, tax setup. Ask only if the answer changes the audit; otherwise mark Unknown.

Questions worth asking (once, together): see SKILL.md §First message. Do not block the public audit waiting for answers.

Mode: **audit-only** (no changes anywhere) or **audit-and-fix** (changes only on a development theme, per `06-evidence-fix-retest.md`). Default is audit-only.

## Inventory

`node scripts/inventory.mjs --url URL --out OUT [--max 15] [--all] [--auto-all 50]`

Sources, in order: `robots.txt` → sitemap index and child sitemaps → links on the homepage → Shopify conventions (`/cart`, `/search`). Pages reachable only through deep navigation, apps, or JavaScript routing can be missed; add them by hand to `OUT/inventory.json` (`"source": "manual"`, `"selected": true`) and rerun collectors.

Each page gets a `type`: `home product collection page blog article cart search policy account other`.

### Coverage strategy

Small stores are inspected in full: when discovery finds at most `--auto-all` (default 50) non-account pages and `--max` is not given, every page is selected (`coverage.full = true` in `inventory.json`). `--all` forces this for any size.

Larger catalogues are sampled by template, because pages of one type share a template. Default selection (total capped by `--max`):

| Type | Selected | Reason |
|------|----------|--------|
| home | 1 | unique |
| product | up to 3 | same template, different data (variants, media, stock) |
| collection | up to 2 | one normal, one large if possible |
| page | up to 3 | contact/about/FAQ often use different templates |
| blog / article | 1 each | |
| cart, search | 1 each | |
| policy | up to 2 | |
| other | up to 2 | |

Improve the sample by hand when it matters: include a product with variants, one sold out, one on sale, one with no reviews; a collection with pagination; any page using a distinct template (`?view=`, landing pages).

Exit code 2 and an `ACCESS-STOREFRONT` `BLOCKED` record mean the storefront is password-locked: run `auth-session.mjs`. Exit code 3 with the same record means the storefront was unreachable (network error or HTTP ≥ 400). Under `run-all.mjs` either case also writes `INVENTORY-COLLECTOR` `BLOCKED` and no collector runs.

### Reporting coverage

`report.mjs` writes `OUT/page-inventory.csv` with status per URL:

- **Discovered** — found by any source.
- **Inspected** — at least one test with PASS/FAIL ran on it.
- **Untested** — discovered, not inspected.

The report states all three numbers and the sampling rule. "All pages inspected" is only allowed when Untested = 0. Sampled coverage is phrased as "N of M product pages (same template)".

### Per-page inspection checklist

For each selected page, the automated collectors cover: load status, console errors, network failures, broken internal links, horizontal overflow at six widths, SEO tags, axe rules, mixed content, exposed-secret patterns. The auditor covers by eye on the screenshots and live page: visual quality, content accuracy and completeness, layout, navigation sense, interactive element behaviour, missing content (placeholder text, empty sections, broken images), unexpected behaviour. Record manual findings as records in `OUT/results/manual.json`.

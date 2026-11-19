# Shopify technical audit

Only with access level C (theme files). Without it the `technical` category is "not assessed" and scores 0 — say so; do not infer code quality from the rendered storefront.

## Getting the theme safely

```bash
shopify theme list --store STORE.myshopify.com        # proves access; note live theme id
shopify theme pull --store STORE.myshopify.com --theme THEME_ID --path ./theme
cd theme && git init && git add -A && git commit -m "Baseline: theme THEME_ID as pulled"
```

The baseline commit is the backup. Never work without it. The user runs `shopify auth login` themselves.

## Automated

`bash scripts/theme-check.sh THEME_DIR OUT` runs `shopify theme check --output json`, stores the raw output in `OUT/evidence/technical/theme-check.json` and converts it to records: `TECH-TC-<CheckName>` (one per failing check; error → medium, warning/info → low) or `TECH-TC-CLEAN`. If the CLI is missing or fails, a single `TECH-TC` `BLOCKED` record is written and the category stays not assessed. Verified with Shopify CLI 4.8.0, offline.

Interpreting: Theme Check is a linter. Zero offenses means lint-clean, not well-built. Read offenses by check, fix causes, not symptoms. `--auto-correct` changes files — only on a committed tree, and review the diff.

## Manual review (`TECH-M*`)

| Area | Look for |
|------|----------|
| Liquid | Logic in the right layer; no giant monolithic templates; `{% render %}` not `{% include %}`; no N+1 loops over `all_products`/nested collections; filters over manual string building; whitespace control |
| Sections & blocks | Schema complete with sensible defaults, limits and presets; merchant can edit content without code; no hard-coded text, prices, URLs or product handles |
| Snippets | Single purpose, parameters documented, no reliance on leaked outer variables |
| Templates / JSON templates | OS 2.0 JSON templates; alternate templates are intentional; no orphaned templates |
| Assets | No unused or duplicated libraries; deferred/async scripts; no parser-blocking JS in `<head>`; images through `image_url` + `image_tag` with `widths`/`sizes`; fonts preloaded sparingly |
| Settings | `settings_schema.json` organised; `settings_data.json` not hand-edited into an invalid state |
| Metafields | Namespaced, defined, guarded for blank values |
| Apps | Leftover snippets/assets from uninstalled apps; app embeds actually used; duplicate analytics tags |
| Locales | Strings through `t` filter; schema translations present if multilingual |
| Maintainability | Version control, readable naming, comments where non-obvious, distance from upstream theme version (upgrade risk) |
| Secrets | No private tokens or credentials anywhere in the theme (theme files are publicly fetchable) |

## Tools and when to use each

| Tool | Use for | Not for |
|------|---------|---------|
| Shopify CLI `theme pull/push/dev` | Getting code, previewing on a development theme | Publishing without approval |
| Theme Check | Lint: syntax, deprecated tags, performance and a11y rules | Proof of quality |
| Git | Baseline, one commit per fix, diff as evidence | — |
| Playwright collectors (this skill) | Behaviour on the rendered store or a `theme dev` preview URL | Admin configuration |
| Lighthouse | Lab performance before/after a change | Real-user CWV |
| Browser devtools | Network/coverage/performance traces, console, DOM inspection | — |

## Platform limits

Not accessible or changeable from a theme: checkout internals (non-Plus), Shopify's CDN and response headers, sitemap generation, core `robots.txt` rules (only via `robots.txt.liquid`), payment processing. Never claim otherwise. Never modify platform infrastructure.

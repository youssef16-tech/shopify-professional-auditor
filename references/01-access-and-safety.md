# Access, scope and safety

## Access levels

Establish the level by doing, not by assuming. Record it in `OUT/discovery.md`.

| Level | How it is established | What it unlocks | What stays out of scope |
|-------|----------------------|-----------------|-------------------------|
| A. Public storefront | URL loads without a password page | Phases 2–7, 9, 10 | Theme code, Admin config, order flow past checkout entry |
| B. Locked storefront | User unlocks via `node scripts/auth-session.mjs` | Same as A | Same as A |
| C. Theme files | A local theme directory exists, or `shopify theme list --store X` succeeds after the user's own `shopify auth login` | Phase 8, fixes on a development theme | Admin settings, apps' private code |
| D. Admin (staff/collaborator) | User confirms and a concrete Admin action/readout succeeded | Config review the user asks for | Anything not explicitly requested |

A website being reachable is not permission to modify its Admin. Level C/D statements in a report must cite the command or screen that proved them.

## Credentials

- Never ask the user to paste a password, token or API key into chat.
- Storefront password: `auth-session.mjs` opens a visible browser; the user types it; the session cookie is stored in `OUT/.auth/storage-state.json` (mode 600). Delete it when the audit ends. Never commit `OUT/.auth/`.
- Shopify CLI: `shopify auth login` (browser flow) run by the user. For CI-style use, `SHOPIFY_CLI_THEME_TOKEN` and `SHOPIFY_FLAG_STORE` as environment variables.
- PageSpeed Insights key (optional): `PSI_API_KEY` environment variable.
- Scripts pass every recorded string through a redactor (Shopify `shpat_/shpss_/shpca_/shppa_` tokens, `sk_live_`, AWS keys, bearer tokens, emails, checkout tokens, key-like query parameters). Manual notes are the auditor's responsibility.

## What the collectors do to the store

- HTTP GETs of public pages at human-like pace (sequential, short delay).
- One add-to-cart on an anonymous session, then a visit to cart and the checkout entry URL. No form on checkout is filled or submitted.
- No logins, no account creation, no form submissions other than add-to-cart and the on-site search.
- Contact/newsletter forms are **not** submitted automatically (that would send customer communications / create records). Test them manually only with user approval and a clearly marked test message.

## Approval gates

Stop and get an explicit yes in chat before:

- Publishing a theme to production
- Deleting store data (products, themes, files, orders, customers)
- Modifying live payment settings
- Making purchases, placing test orders, or issuing refunds
- Changing billing or subscription settings
- Changing domains or DNS
- Sending customer communications (including submitting live contact/newsletter forms)
- Changing business policies (shipping, returns, privacy, terms)
- Any irreversible production change

Approval is per action. Approval to fix a bug is not approval to publish.

## Security testing boundaries

Allowed: reading response headers, page source, loaded script origins, cookie attributes, form targets, TLS/redirect behaviour, visible policies and consent UI.

Not allowed: vulnerability scanners, credential guessing, injection payloads, rate/abuse testing, accessing other customers' data, probing Shopify infrastructure or third-party services, bypassing bot protection or CAPTCHAs.

Always state in the report: checks were passive, scope was limited to what a visitor's browser receives, and absence of findings is not proof of security.

## Platform boundaries

Shopify controls checkout rendering (non-Plus), TLS, core response headers, `robots.txt` defaults, CDN and sitemap generation. Report issues there as platform constraints with the available merchant-side lever (e.g. `robots.txt.liquid`, Checkout Extensibility), never as theme defects, and never claim the ability to change platform infrastructure.

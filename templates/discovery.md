# Store Discovery

Date: {{DATE}}

Every line is marked **Verified** (observed by a tool or by the auditor), **Stated** (told by the owner, not checked) or **Unknown**. Never fill a gap with a guess.

## Observed from the storefront (Verified)

| Item | Value |
| --- | --- |
| Storefront URL | {{URL}} |
| myshopify domain | {{MYSHOPIFY}} |
| Theme | {{THEME}} |
| Theme version (base theme and version) | {{THEME_VERSION}} |
| Currency | {{CURRENCY}} |
| Locale | {{LOCALE}} |
| Languages | {{LANGUAGES}} |
| Pages discovered | {{COUNTS}} |

## Business context (ask the owner; mark Stated or Unknown)

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

## Technical limitations (observed or stated)

| Limitation | Effect on the audit | Source |
| --- | --- | --- |
| Theme version is behind the current release of its base theme (check the theme store changelog) | Known upstream bugs may apply; updates may overwrite custom code | Unknown |
| Heavily customised or vintage (non-OS 2.0) theme | Sections everywhere / JSON templates may be unavailable | Unknown |
| Storefront password, geo or bot protection | Automated checks may be blocked or partial | Unknown |
| Apps injecting scripts or app blocks the auditor cannot inspect | Their code is out of scope; only their storefront effect is tested | Unknown |
| Markets, languages or currencies the auditor cannot switch to | Those variants stay NOT TESTED | Unknown |
| Shopify-hosted areas (checkout, accounts, payments) | Not editable through the theme; reachability only | Verified (Shopify platform) |

## Access established for this audit

| Access | Status | How it was established |
| --- | --- | --- |
| Public storefront | | |
| Storefront password (owner session) | Not provided | |
| Theme source (local copy / CLI / GitHub) | Not provided | |
| Shopify Admin or collaborator account | Not provided | |
| Development or preview theme | Not provided | |
| Test payment gateway (Bogus / test mode) | Not provided | |
| Analytics, Search Console | Not provided | |

## Audit scope

- Audit type: public-facing only / with theme access / with admin access
- In scope:
- Out of scope:
- Changes authorised: none (read-only) / development theme only / other (written approval attached)

## Assumptions

List anything taken as true without verification, so the report can show it. Leave the list empty rather than invent one.

- (none yet)

## Constraints

- Read-only by default: only the anonymous session cart is touched.
- Checkout is tested for reachability only; no payment details, orders or refunds.
- Security checks are passive only.
- Fixes go only to a development or unpublished theme, after a backup and with approval.
- Time, budget or access limits stated by the owner:

## Missing requirements

Information the audit needs but does not have. Each item lowers confidence in the related category and is listed in the final report.

| Missing item | Needed for | Asked on | Answer |
| --- | --- | --- | --- |
| | | | |

# Build 15 signed checkout: website package

Status 2026-09-21: source complete and locally tested. Nothing in this package is deployed. Deployment, production activation and real charges or refunds each keep their own approval gate. The Build 15 Ledger owner keeps app integration and release authority.

Pairs with Quests app branch `codex/build15-payment-routing-20260921` (PR 122) and its `handoff/build15-payments-20260921` acceptance ledger.

## What this package contains

| Area | Files | Source authority |
|---|---|---|
| Signed checkout contract | `functions/subscribe.js`, `functions/subscribe/policy.js`, `functions/subscribe/check.js`, `subscribe-app.js`, `_routes.json` | Prepared commit `7b8d859`, completed here |
| Approved checkout visuals | `functions/subscribe.js`, `subscribe-app.js`, `pro/success.html` | Commit `e57f9e2`. All four SHA-256 values in `HANDOFF-CHECKOUT-DESIGN.md` match that commit |
| Tests | `tests/payment-routing.test.mjs` | This package |

Visual integration notes:

- The six category and wordmark SVGs named in the design handoff are already on `main` with matching hashes.
- `assets/img/app-icon-sunset.png` stays at marketing's `main` version. It is the same artwork recompressed (19.9 KB against 36.6 KB) and 22 marketing pages reference it.
- `pro/success.html` is the approved graphite page plus marketing's three sitewide favicon links from `749355d`. Marketing made no other change to that file.
- No other marketing file is touched.

## Contract

Request: `/subscribe?version=2&uid=&attempt=&exp=&plan=&env=&appscheme=&storefront=&sig=`. Every parameter except `sig` is a signed claim, forwarded to the backend byte for byte. The website holds no signing secret.

| Gate | Where | Backend action | Closed result |
|---|---|---|---|
| Page entry | `GET /subscribe`, server side | `inspect_web` | Approved fallback page, no checkout config in the HTML |
| Immediately before the provider call | `POST /subscribe/check` from the browser, last step before `purchases.purchase()` | `validate_web`, moves the attempt from reserved to started atomically | Notice with one action, Return to Quests |
| Explicit SDK cancellation | `POST /subscribe/check` | `finish_web` with `outcome: cancelled` | Attempt released |

The backend (`sign-upgrade-link`) owns signature, expiry, entitlement, provider subscription state, storefront and the `payments.routing` kill switch, all read fresh on each action. A timeout, network error, non-2xx reply or unknown reply is closed.

Pending-state rules in the browser:

- Only `ErrorCode.UserCancelledError` from the RevenueCat SDK releases an attempt. `/subscribe/check` rejects any other reported outcome with 400.
- Browser closure, timeout and every other rejection report nothing. The attempt stays pending and the notice sends the user back to the app to check status. The module has no `pagehide`, `beforeunload` or beacon path.
- Try again appears only for failures before the attempt is claimed (SDK configure, offerings load, plan lookup). After the claim, and after a cancellation, the only action is Return to Quests.
- Every return uses `/subscribe/return` (server 302). Success goes to `pro-upgrade-success`, everything else to `home`. The app dismisses the sheet on both and checks purchase state before it offers a billing route. The redirect grants nothing.

## Deployment bindings

| Pages project | Domain | `PAYMENT_BACKEND_ENVIRONMENT` | Backend | Web Billing key |
|---|---|---|---|---|
| `quests-payment-review` | `quests-payment-review.pages.dev` | `staging` | `dswtlvkjthzgpsgtfvwx` | Sandbox (`rcb_sb_`) |
| `quests-invite` | `invite.thequestsapp.com` | `production` | `bltogjnxwvybhyfaivtw` | Live |
| `quests-invite-staging` | `invite-staging.thequestsapp.com` | none | none | Marketing's project. Outside this package. Unbound, so checkout stays closed there |

Set it as a plain text variable on the Production environment of each project. The binding, never the URL, selects the backend, the publishable key and the Stripe mode. The signed `env` claim must equal it. A missing, unknown or mismatched value serves the fallback page without a backend call. Preview deployments of `quests-invite` carry no binding and stay closed.

`RC_UPGRADE_SIGNING_SECRET` and `RC_UPGRADE_SIGNING_SECRET_STAGING` on `quests-invite`, and the staging secret on `quests-payment-review`, are unused by this source. Remove them after production acceptance, as a separate approved change.

## Coordinated deployment order

Keep `payments.routing.web_checkout_enabled` false through every step.

| Step | Action | Owner | State |
|---|---|---|---|
| 1 | Staging migration `20260921162033_payment_routing_configuration` | Ledger owner | Applied |
| 2 | Deploy staging `sign-upgrade-link` and `revenuecat-webhook` from the reviewed app commit | Ledger owner | Pending. Staging signer last deployed 2026-08-27 and still answers `unauthorized` to web actions |
| 3 | Deploy production `revenuecat-webhook` with the sandbox-web exclusion, or approve equivalent provider isolation | Ledger owner | Pending. Production webhook v21 was deployed 2026-09-17, before the exclusion was written. Blocks every sandbox web purchase |
| 4 | Set `PAYMENT_BACKEND_ENVIRONMENT=staging` on `quests-payment-review`, then `npx wrangler pages deploy . --project-name quests-payment-review --branch main` from this exact commit | Website | Pending approval |
| 5 | Staging acceptance: signed monthly and annual links from the paired signer, gates, cancellation, returns, then sandbox lifecycle once step 3 is verified | Website with Ledger owner | Pending |
| 6 | Production migration, then production signer and webhook | Ledger owner | Pending separate approval |
| 7 | Set `PAYMENT_BACKEND_ENVIRONMENT=production` on `quests-invite`, then merge PR 12. `quests-invite` builds from GitHub `main`, so the merge is the production deployment. The apex `thequestsapp.com/pro/success` page ships from the same merge through GitHub Pages | Website | Pending separate approval |
| 8 | Production-backed signed candidate, flag activation, bounded live charge and refund | Release owner | Each separately authorized |

Order matters in two places. Backend before website in each environment: the v2 website against a v1 signer fails closed, which is safe but unusable. Website before the new binary: Build 15 sends v2 links that the current production website rejects.

Merging PR 12 ends v1 link support on `invite.thequestsapp.com`. No shipped production build opens web checkout (both steering flags are false in Build 14), so no user path breaks.

## Rollback

1. Set `payments.routing` to the emergency object in the app package (`ios_primary: apple`, `web_checkout_enabled: false`). Page entry and initiation both close within one request. Verify with a stale signed link and with `POST /subscribe/check`.
2. Keep webhooks running so in-flight payments settle. Never clear a pending attempt on elapsed time.
3. Website rollback: Cloudflare Pages, roll `quests-invite` back to deployment `12d626a0-2460-4331-939a-b0f99e91d9da` (source `cca024b`), or revert the merge on `main`. The v1 website cannot serve v2 links, so rolling the website back while the flag is on strands web checkout. Flip the flag first.
4. `quests-payment-review` rolls back to `19561270-3beb-46f7-9b3c-4848a74e36b4`.

## Catalog

Source maps `monthly` to `quests_pro_monthly` and `yearly` to `quests_pro_annual`, and requests USD offerings. The app package verified both read-only in RevenueCat on 2026-09-21: USD 4.99 monthly, USD 29.99 yearly, both attached to `pro`, no trial. This package made no provider request. Exact rendered price, currency, renewal disclosure and wallet availability need the deployed checkout and stay pending. Apple Pay needs each checkout domain registered with Stripe.

## Validation

- `npm test`: 73 pass, 0 fail (50 existing, 23 payment routing).
- `wrangler pages functions build`: compiles.
- Local `wrangler pages dev` with the staging binding: fallback on bare `/subscribe`; `/subscribe/check` routed (405 on GET, 400 on bad body, 409 `environment_mismatch` with no backend call, 503 closed against the live staging v1 signer); `/subscribe/return` answers 302 to `quests-staging://home`.
- CSP in `functions/subscribe.js` equals the `/subscribe` block in `_headers`.

Found and fixed in the prepared patch: `/subscribe/check` was absent from `_routes.json`, so the browser gate would never have reached a Function; the publishable key was chosen from the URL `env` parameter instead of the binding; the failure notice offered Try again after the attempt was claimed; the gate accepted unbounded bodies and unfiltered claim keys.

## Acceptance cases owned by the website

Evidence layers stay separate: W is website behavior, P is provider processing, B is backend entitlement, D is physical device.

| Case | W, local | W, deployed | P | B | D |
|---|---|---|---|---|---|
| Invalid, legacy v1, unsigned link | Pass | Pending | n/a | n/a | Pending |
| Expired or tampered claim (plan, uid, attempt) | Pass, forwarded unchanged and closed on refusal | Pending | n/a | Pending | Pending |
| Environment mismatch, missing binding | Pass | Pending | n/a | n/a | n/a |
| Kill switch off at entry | Pass | Pending | n/a | Pending | Pending |
| Kill switch flipped after page load | Pass | Pending | n/a | Pending | Pending |
| Duplicate initiation, second tab, double tap | Pass | Pending | Pending | Pending | Pending |
| Explicit cancellation releases the attempt | Pass, source contract | Pending | Pending | Pending | Pending |
| Ambiguous failure keeps pending state | Pass, source contract | Pending | Pending | Pending | Pending |
| Browser closure keeps pending state | Pass, no reporting path exists | Pending | Pending | Pending | Pending |
| Monthly and annual product, price, currency, renewal text | Mapping pass | Pending | Pending | n/a | Pending |
| Supported wallets | n/a | Pending | Pending | n/a | Pending |
| Return to the originating app flow | 302 pass | Pending | n/a | n/a | Pending |
| Entitlement after payment | n/a | n/a | Pending | Pending | Pending |

# Build 15 Apple Pay checkout investigation

Updated September 21, 2026. Staging acceptance remains in progress.

## Observed purchase

Elliott confirmed Apple Pay appeared in the installed Quests [Staging] checkout.
He reported a tax-related price-update notice after authorizing the wallet,
confusing retry behavior, and eventual Pro access. The phone was disconnected
before a captured reproduction. Historical device-log collection required Mac
administrator authentication and was unavailable; no phone console trace was
captured for the original attempt.

Read-only Chrome inspection established:

- One annual web purchase attempt was created at 20:21:30 UTC and completed at
  20:22:22 UTC. This run exercised the annual plan.
- Stripe test PaymentIntent `pi_3UIDjDIc0E6TglSd2Yqs9buu` succeeded at 20:22:20 UTC
  for USD 29.99, using Apple Pay. Its timeline contains creation and successful
  confirmation. The latest all-payments list contains one September 21 payment;
  no second payment or decline appears for this run.
- Stripe tax transaction `tax_1UIDinIc0E6TglSdDQrrUoNa` used the wallet billing
  location in New Mexico, SaaS personal-use code `txcd_10103000`, tax-exclusive
  pricing, and the configured New York head office. Tax was USD 0.00. The
  detailed state/county/city reason is `Not collecting`. This is a registration
  configuration result and supplies no independent assessment of tax obligations.
- RevenueCat INITIAL_PURCHASE `41e3db8b-8cf4-416e-9ceb-e7006dbe483b` identifies
  app `app20b28546eb`, store `RC_BILLING`, environment `SANDBOX`, entitlement
  `pro`, and the matching purchase-attempt metadata. Annual sandbox renewal is
  accelerated to one hour. The customer dashboard showed active Pro.
- Read-only staging SQL confirmed `pro`, `is_active=true`, expiry at
  21:22:21.208 UTC, and update at 20:22:22.27799 UTC.
- The production webhook returned HTTP 200 with
  `{"success":true,"ignored":true,"reason":"web_sandbox_requires_staging"}`.
  This closes actual provider proof for this web-sandbox exclusion path.
- Stripe displays a simulated processing fee of USD 1.17 and net USD 28.82.
  Live economics and any separate RevenueCat/Tax charges remain separate checks.

No live charge, refund, cancellation, entitlement grant, or database mutation was
performed during this investigation. Full billing addresses remain in provider
records and are excluded from this document.

## Why the notice appears

The pinned `@revenuecat/purchases-js@1.42.1` source contains the exact reported
message under `price_update.base_message`. On wallet submission the SDK extracts
billing details, refreshes tax, and compares the new total with the displayed
total. A mismatch stops that pass before `checkoutComplete` and Stripe payment
confirmation, updates the total, and shows the notice. A fresh user confirmation
can then continue within the same checkout attempt.

The observed final New Mexico billing location and SDK behavior explain the
reported price-update interruption. The initial displayed amount/location and
any additional client-side failure remain unrecorded. A later successful payment
does not reconstruct every intermediate on-device screen.

## Presentation fix

The existing SDK notice now appears above payment fields, receives focus and an
accessible alert role, and scrolls into view once per visible mismatch. It stays
in document flow, preserving access to wallet and card controls. Its English
non-trial copy explains the billing-address tax recalculation and asks the user
to review and confirm again. Localized and free-trial terms remain intact.

The adapter preserves SDK text nodes and payment state. RevenueCat continues to
own pricing, tax, payment confirmation, and retry. No automatic second purchase,
new attempt, page reload, or backend unlock is introduced. Class observation is
required because the SDK toggles `fully-hidden` on an existing notice element.
Reverify these selectors when changing the pinned SDK.

## Verification

- 77 website tests pass, including hidden notice, first display, rerenders,
  subsequent mismatch, unmount, localization, and trial-copy cases.
- Cloudflare Pages Worker compilation passes. `git diff --check` passes.
- Local presentation fixture in Chrome at 390x844 and 320x568: notice is fully
  visible from y=16, focused, with no horizontal overflow. Confirmation hides
  the notice; another mismatch reveals it again. These are synthetic UI cases.
- Harness health was checked. All available iOS simulators had other owners'
  leases; the four configured pool devices were missing. Those lanes and their
  state were preserved. No new iOS simulator evidence was obtained in this pass.

Run the local, payment-free fixture with:

```sh
node scripts/preview-checkout-notice.mjs
```

Open `http://127.0.0.1:8996`. Fixture amounts are illustrative. Its server binds
only to localhost, never starts a provider checkout, and is excluded from Pages
assets with other scripts.

## Remaining acceptance

1. Physical iPhone: reproduce wallet location mismatch, verify the new notice,
   confirm the displayed final total, complete once, and return to the same app
   account. Capture console evidence during the reproduction if available.
2. Positive New York tax: use a valid New York billing location in an authorized
   sandbox checkout and match displayed tax to Stripe calculation and receipt.
   The New Mexico purchase proves automatic location handling and zero-tax
   behavior. The initial estimate in this run is unverified.
3. Monthly plan, cancellation, card decline, delayed webhook, repeated taps,
   refund/revocation, and safe reconciliation of an abandoned started attempt.
4. Final Build 15 artifact acceptance, native Apple sandbox regression,
   production signer/migration/routing gates, then Elliott's live purchase with
   the selected plan and final total visible. Production checkout stays gated.

## Staging deployment

Website commit `2257da0` was pushed to `github/codex/build15-payment-routing-20260921`
and deployed from a clean archive to the staging project `quests-payment-review`.
Deployment URL: https://217dabad.quests-payment-review.pages.dev. The artifact
retains `PAYMENT_BACKEND_ENVIRONMENT=staging` and excludes documentation, scripts,
tests, and private finance drafts. Chrome verified the stable host serves the
expected closed state for an unsigned checkout URL. A fresh signed phone checkout
is required for acceptance of the deployed notice inside RevenueCat.

Operational deployment note: an initial archive command ran from the previous
artifact directory and failed; the following deployment nevertheless published
`5d09d528-c024-47e4-ab5f-d43200584df9` with zero static assets. It was immediately
superseded by the verified clean-archive deployment
`217dabad-4435-4ce1-b132-0b5384b003d2`. Use `217dabad` or the prior known-good
`356e89f8` for rollback decisions; `5d09d528` is unusable. The stable-host notice
module SHA-256 matches source exactly:
`241f9d2a59caecb582ad3d58f4d108e09e87a86063f3e034fcad0a3445bbc83e`.
No production project was targeted.

## September 21 follow-up: preventing repeat authorization

Elliott requires checkout to complete with one wallet authorization when billing
location changes tax. The staged notice improvement is a presentation mitigation;
it does not meet this requirement by itself. Web production activation remains
blocked on a supported solution and physical-device acceptance of this case.

Online primary-source research:

- RevenueCat [tax documentation](https://www.revenuecat.com/docs/web/web-billing/tax)
  confirms that wallets supply the billing address used for customer tax location.
- RevenueCat [checkout documentation](https://www.revenuecat.com/docs/web/web-billing/checkout)
  explicitly excludes express checkout and wallets from both full-address
  collection settings. Changing Only when required to Always cannot be relied
  upon to fix the wallet total mismatch.
- Latest published Web SDK at research time is 1.63.1, released September 17.
  The [tagged payment-entry source](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/pages/payment-entry-page.svelte#L624-L742)
  still recalculates wallet taxes during submit, compares against the previous
  total, and throws TaxCustomerDetailsMissMatchError before completeCheckout and
  confirmElements. Both the npm package and tagged source were inspected.
  Upgrading our 1.42.1 pin alone supplies no evidence that repeat authorization
  disappears. No SDK upgrade was deployed during this research.
- The [July 15 RevenueCat release note](https://www.revenuecat.com/changelog)
  places full billing-address support in 1.47.0 and says wallet behavior remains
  unchanged. Our 1.42.1 pin predates that feature. Saved dashboard settings must
  be distinguished from SDK support, particularly for full-address-required
  regions. Current launch scope remains the US.
- Stripe [Express Checkout documentation](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=elements)
  provides address-change events and total updates for shipping-address flows.
  This shows that updating a wallet sheet before confirmation is possible in
  supported integrations. It does not establish a compatible billing-only hook
  in RevenueCat's public purchase API. Adding a fictitious shipping requirement
  to a digital subscription would require product and provider review.

Recommendation: first establish a supported RevenueCat solution that obtains the
required tax location and finalizes the amount before wallet authorization.
Request provider guidance with the reproducer below. If RevenueCat cannot
support that experience promptly, preserve the existing native Apple purchase
route for launch while qualifying Stripe Checkout/Billing as a separate payment
workstream. Stripe migration is a broader catalog, subscription, webhook,
reconciliation, tax and refund change. Treat it as a separately tested release.
Do not hide the mismatch, remove the amount guard, silently submit a higher
amount, disable tax, substitute the merchant address, or hardcode an illustrative
rate as a workaround.

Provider question draft, prepared locally and not sent:

> RevenueCat Billing with Stripe Tax and Apple Pay, purchases-js 1.42.1, requires
> another wallet confirmation when the wallet billing address changes tax from
> the initial estimate. The first pass enters the price-update mismatch state;
> the next confirmation succeeds. Source in 1.63.1 still contains this guard.
> Which supported API/configuration finalizes billing-address tax before the
> first Apple Pay authorization? Address collection documentation excludes
> wallets. Is there an upstream fix or recommended flow that preserves correct
> tax and one authorization, including when the selected wallet card changes?

### Physical-device sequence

1. Reconnect the unlocked iPhone for diagnostics. Use Quests [Staging] first.
   Verify installed artifact, signed-in account, staging host, sandbox provider
   mode, and current entitlement/renewal state. The previous successful sandbox
   subscription can block another purchase, so prepare an eligible test account
   or a provider-confirmed sandbox reset before opening a new checkout. Preserve
   the previous payment and attempt records.
2. Capture the checkout initial subtotal/tax/total and selected plan. Open Apple
   Pay and capture its displayed total and selected billing location before
   authorization. Establish whether a mismatch is present with ordinary usage.
   Reproduce the reported path with diagnostics. A successful second attempt
   closes payment recovery only; one-authorization acceptance stays open.
3. Once a supported correction is staged, test same-location and different-tax
   billing locations, including New York and the previously observed New Mexico
   case. Use legitimate wallet billing details; sandbox card fields may use
   documented test data. Include changing the selected wallet card/location
   before confirmation. Run monthly and annual plans with independently eligible
   test states. Pass requires the final tax-inclusive wallet amount to be the
   amount charged, one authorization, one successful payment, and no tax-change
   retry. Test a positive New York tax calculation and its receipt.
4. Match each successful run to Stripe payment/tax/receipt, RevenueCat event,
   staging webhook, completed attempt and Pro entitlement. Verify return to the
   same app account and retained access after relaunch. Exercise cancellation,
   decline, repeated tap, interrupted network, delayed webhook and refund/
   revocation separately. A pending provider outcome must not offer another
   purchase until reconciled.
5. Repeat on the final Build 15 candidate. Then, after production deployment and
   activation gates pass, Elliott makes the agreed live purchase with the exact
   plan and final amount visible. Reconcile the live payment, tax, receipt,
   entitlement and account return. Do not use the successful staging purchase
   as production sign-off.

USB is for diagnostics; the existing installed staging app and Safari run
without the cable. Safari Web Inspector/device logging access must be verified
before promising console capture. A recording of the UI and provider timestamps
remains useful if console access is unavailable.

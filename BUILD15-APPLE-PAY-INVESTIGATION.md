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

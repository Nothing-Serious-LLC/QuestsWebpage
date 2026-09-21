# Build 15 signed checkout contract

This branch is based on `github/main` `cca024b`. The live `quests-invite` deployment observed September 21 is `12d626a0-2460-4331-939a-b0f99e91d9da`. This source has not been deployed.

Pair with Quests app branch `codex/build15-payment-routing-20260921` and its `handoff/build15-payments-20260921` acceptance ledger. The app integration owner is the existing Build 15 Ledger task.

Required deployment binding: `PAYMENT_BACKEND_ENVIRONMENT=staging` for `quests-payment-review`, `production` for `quests-invite`. Missing binding or mismatched signed environment closes checkout. The backend verifies the complete v2 capability, UUID, plan, storefront, expiry, route flag, entitlement and durable account attempt. The browser checks `/subscribe/check` immediately before calling RevenueCat purchase. Explicit SDK cancellation releases the attempt. Ambiguous errors and browser termination retain pending state.

Production web payments are live, including when opened by TestFlight. Sandbox web payments belong to staging. The current RevenueCat production webhook accepts sandbox from all apps, so the backend sandbox exclusion must be approved and deployed before sandbox web purchase testing. No provider purchases, refunds, configuration edits or website deployments were performed in this task.

Source uses the existing Web Billing keys and products `quests_pro_monthly` / `quests_pro_annual`, verified read-only in RevenueCat at USD 4.99 monthly / USD 29.99 yearly, both mapped to `pro`. Checkout requests USD. The SDK owns final payment disclosures and supported methods. Retest catalog parity before enabling the app route.

The existing production navy/white appearance is retained here. HANDOFF-CHECKOUT-DESIGN.md describes a separately approved graphite visual package. Coordinate that package with its owner before production promotion.

Validation: 55 node tests pass; Wrangler Pages Functions compiles. Deployment, supported wallets, failure lifecycle, signed-device return and production acceptance remain pending. Production promotion needs separate authorization. Rollback must preserve compatible v2 backend/client behavior and webhook settlement; first disable `payments.routing.web_checkout_enabled`.

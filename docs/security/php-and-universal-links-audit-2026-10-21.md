# PHP disclosure and universal-link audit, October 21, 2026

The inspected Quests website has no identified PHP runtime requiring the October 21 patches. Its apex serves static content through GitHub Pages; invite routes execute JavaScript Cloudflare Pages Functions. The audit found a separate Profile response-header gap, addressed by the code accompanying this report. Deployment and native-device acceptance remain pending.

## Disclosure and applicability

[OpenAI's October 21 announcement](https://openai.com/index/coordinated-disclosure-of-critical-vulnerabilities/) describes coordinated disclosure of two PHP remote-code-execution vulnerabilities. The [PHP security advisory](https://www.php.net/archive/2026.php) identifies CVE-2026-109618 (out-of-memory corruption) and CVE-2026-109619 (stale global state). Supported fixed releases are 8.2.35, 8.3.36, 8.4.27 and 8.5.12. Operators of a PHP-serving origin need the applicable fixed release or a verified vendor backport.

Evidence for this site's applicability assessment:

- Website baseline: `5d36817cf92b704025480c848c179fab435a565c`, freshly fetched from `Nothing-Serious-LLC/QuestsWebpage` main.
- Source inventory: 459 tracked files, 18 JavaScript Function files, zero PHP source/runtime configuration files or Composer manifests. The root package defines Node-based tests and maintenance scripts.
- Production Cloudflare listing: deployment `1617a415-6639-4f09-9b7c-0d9f9dc8a5a8`, branch `main`, source `5d36817`.
- Live apex response reports `GitHub.com`; its homepage and AASA bytes match the baseline. The production invite association bytes also match source.
- Invite production, staging and the three inspected Pages project hosts report Cloudflare. Function requests in source target configured backend APIs. No PHP-origin proxy was identified in the inspected code.
- GitHub documents that [Pages serves static files and lacks PHP server-side execution](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). Cloudflare documents [JavaScript Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/).

Absence of a PHP response header alone establishes no patch status. The [OpenAI checker](https://github.com/openai/php2shell-checker) documents that hidden or missing version headers produce `UNKNOWN`. This assessment uses source, provider deployment metadata and public responses. Provider-internal software and patch status remain outside the verified scope.

## Live association and routing results

Public readback completed October 21 at 14:48 Eastern, followed by checkout-return checks in the same session. The initial matrix contains 45 bounded HTTPS GET requests, with four additional checkout GETs. No exploit payload, account mutation, phone claim or purchase was submitted.

| Surface | Observation | Assessment and next action |
| --- | --- | --- |
| `invite.thequestsapp.com` | Direct AASA and Android assetlinks return 200 JSON. Production app identity and `/q/*`, `/p/*`, `/pro/*` are present in AASA. Android production package and recorded signing fingerprint match repository association data. | Hosted association checks pass. Final distributed-binary signature and OS routing remain device checks. |
| `invite-staging.thequestsapp.com` | Direct associations return 200 JSON. AASA includes production/hybrid and staging identities. Android staging fingerprints include `FA:C6:...:3B:9C` and `71:F7:...:82:C4`, matching staging source `2830c4c`. | Hosted checks pass against that source. Preserve both existing certificate entries during promotion. |
| Apple CDN, apex and both invite hosts | 200 JSON; parsed association content matches each origin. | CDN readback passes at this timestamp. |
| `thequestsapp.com` AASA | 200 with `application/octet-stream`; Apple CDN currently accepts the same JSON. | Hosting MIME defect remains. GitHub Pages ignores `_headers` and cannot set a per-file MIME override. Prepare an approved edge/hosting change that serves this exact URL directly as `application/json`, followed by origin and CDN readback. |
| Apex `/q/*` and `/p/*` | AASA advertises these routes, while tested browser paths return 404. Current app parsing and generated share URLs use the invite host. `/pro/success` returns 200. | Existing app ledger item `302-WEB-01` covers the apex routing mismatch. An approved host migration should provide path-preserving redirects to the invite host and reconcile AASA claims, preserving checkout return. |
| `www.thequestsapp.com` | Redirects to apex, including association URLs. | Keep canonical app links on declared apex/invite hosts. `www` is absent from the reviewed native associated-domain declarations. |
| `quests.app.link`, `quests-staging.app.link` | AASA and Apple CDN return 404; Android association endpoints return literal JSON `null`. | Retired-host gap remains for legacy iOS declarations. Restore provider associations if legacy links must remain supported, or retire claims in an explicitly selected native release. |
| Three Pages project hosts | Association endpoints respond 200 JSON for `quests-invite.pages.dev`, `quests-invite-staging.pages.dev`, `quests-payment-review.pages.dev`. | Auxiliary deployment endpoints are reachable. Native declarations use canonical custom hosts. |
| Malformed Quest/Profile links on both invite hosts | Quest route serves its existing 200 legacy fallback; Profile route returns its 404 unavailable page. | Recovery status behavior is preserved. These probes establish malformed-link fallback only. |
| Checkout return, both invite hosts | An HTTP-scheme destination receives 400. An allowed app-scheme/home destination receives 302 with `no-store`. | Redirect allowlist checks pass. Redirects were captured without following them. |

## Native branch distinction

Freshly fetched app main is `59097c1458e2ebe43589af11f71a4ccf9955df73`. It still declares retired Branch Android hosts, repeats staging `/q` without `/p`, and includes apex verification in staging. Apex currently publishes the production Android package only.

The Android workstream already fixes these declarations. [PR 160](https://github.com/Quests-Improve-Together-App/Quests/pull/160) merged into `android/302-integ`, and its merge is an ancestor of freshly fetched `android/302-build22-20261020` at `7243a13d1a90dfa6cd69873c6dab2a5bffaebbca`. That branch excludes retired Branch Android hosts, includes staging `/q` and `/p`, and adds apex `/pro` through the production-only manifest. Integrate and release the selected existing package through its owner.

[Android documents](https://developer.android.com/training/app-links/verify-applinks) that Android 11 and earlier require matching association data for every declared host. The stale main declarations therefore remain relevant to any binary built from that source. This session inspected source and remote PR state; it did not identify the exact source or certificate of every currently distributed binary.

## Implemented Profile fix

Live `/p/*` HTML lacked CSP, frame denial and other headers already declared in `_headers`. [Cloudflare's documented behavior](https://developers.cloudflare.com/pages/configuration/headers/) requires Function responses to set their own headers.

`functions/p/[[path]].js` now sets the existing Profile CSP directly on both successful and unavailable HTML responses, with frame denial, HSTS, permissions restrictions and noindex headers. Script execution, framing, plugins and external base URLs are restricted; existing styles, fonts, Supabase images, app links and store links remain allowed. Existing no-store, no-referrer and content-type handling are preserved.

Four new regression cases cover valid profiles, malformed codes, revoked links and malformed upstream metadata. They also verify escaped display names and preserved app/store destinations. The complete website suite passes 160 tests, and `wrangler pages functions build` compiles successfully. `git diff --check` passes.

This patch is prepared for review. Production and staging deployment have not occurred. After approval, deploy the same function change to the intended environments, verify real successful and unavailable Profile responses, inspect browser CSP violations, and recheck iOS/Android handoff with the selected signed builds.

## Evidence and limits

Session evidence is retained locally under `/Users/elliottthornburgsmac/Developer/Quests-evidence/php-universal-links-20261021/`: `http-report.json`, response bodies/headers, `source-inventory.json`, Cloudflare deployment metadata, checkout redirect results, website test output and compiled Worker.

Signed-device cold/warm launches, authenticated continuation, deferred install behavior, live phone submission and payment completion were outside this session's verification. No simulator was booted, no shared app worktree was edited, and no production configuration, DNS, database, release or recurring task was changed.

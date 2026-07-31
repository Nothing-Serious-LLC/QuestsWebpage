import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest } from "../functions/q/[[path]].js";
import { onRequestPost as startPhoneClaim } from "../functions/api/link-claims/start.js";
import {
  normalizeQuestSharePresentation,
} from "../functions/q/questSharePresentation.js";
import { questSharePage } from "../functions/q/questPage.js";

const ROOT = new URL("../", import.meta.url);
const SUPABASE_URL = "https://project.supabase.co";
const LEGACY_MARKUP = "<!doctype html><title>Legacy Quest invite</title>";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"));
}

function context({
  path = ["AbCd2345"],
  method = "GET",
  search = "",
  enabled = true,
  storyEnabled = false,
  assetCalls = [],
  envOverrides = {},
} = {}) {
  return {
    request: new Request(`https://invite.thequestsapp.com/q/${path.join("/")}${search}`, { method }),
    params: { path },
    env: {
      QUEST_SHARING_ENABLED: enabled ? "true" : "false",
      QUEST_STORY_SHARING_ENABLED: storyEnabled ? "true" : "false",
      QUEST_SHARE_SUPABASE_URL: SUPABASE_URL,
      QUEST_SHARE_WEB_SECRET: "web-secret",
      TURNSTILE_SITE_KEY: "0x4AAAAAACaMy8ev_fZjSv2s",
      ASSETS: {
        async fetch(request) {
          assetCalls.push(request.url);
          return new Response(LEGACY_MARKUP, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        },
      },
      ...envOverrides,
    },
  };
}

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

async function withSuppressedConsoleError(run) {
  const original = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = original;
  }
}

function phoneClaimContext(bodyOverrides = {}) {
  return {
    request: new Request("https://invite.thequestsapp.com/api/link-claims/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.42",
      },
      body: JSON.stringify({
        shareCode: "AbCd2345",
        phone: "+12025550123",
        turnstileToken: "verified-token",
        ...bodyOverrides,
      }),
    }),
    env: {
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      SUPABASE_URL,
      cloudflare_key: "server-secret",
      RATE_LIMIT: {
        async get() {
          return null;
        },
        async put() {},
      },
    },
  };
}

test("dark gate serves the exact legacy asset route", async () => {
  const assetCalls = [];
  const response = await onRequest(context({
    enabled: false,
    search: "?r=7",
    assetCalls,
  }));

  assert.equal(await response.text(), LEGACY_MARKUP);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, s-maxage=600");
  assert.equal(response.headers.get("Vary"), "Accept-Encoding");
  assert.deepEqual(assetCalls, ["https://invite.thequestsapp.com/q/?r=7"]);
});

test("server HTML contains complete first-response Quest metadata", async () => {
  const presentation = await fixture("quest-share-upcoming.json");
  let edgeRequest;

  const response = await withFetch(async (url, init) => {
    edgeRequest = { url, init, body: JSON.parse(init.body) };
    return Response.json(presentation, { status: 200 });
  }, () => onRequest(context()));

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(edgeRequest.url, `${SUPABASE_URL}/functions/v1/quest-share-web`);
  assert.equal(edgeRequest.init.headers["x-quest-share-secret"], "web-secret");
  assert.deepEqual(edgeRequest.body, { action: "metadata", shareCode: "AbCd2345" });
  assert.match(html, /<title>Join Morning Momentum on Quests<\/title>/);
  assert.match(html, /property="og:title" content="You've been invited to a Quest"/);
  assert.match(html, /\/q\/AbCd2345\/og\.png\?r=3/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /Morning Momentum/);
  assert.match(html, /Maya Chen/);
  assert.match(html, /30 days/);
  assert.match(html, />Private</);
  assert.match(html, />Productivity</);
  assert.match(html, /Check in daily/);
  assert.match(html, /4 people are doing this Quest/);
  assert.match(html, /fetch\("\/api\/link-claims\/start"/);
  assert.equal(presentation.availability, "joinable");
  assert.equal(typeof presentation.revision, "number");
  assert.doesNotMatch(html, /rel="alternate"[^>]+story\.png/);
  assert.match(html, /var shareCode = "AbCd2345"/);
  assert.match(html, /var APP_SCHEME = "info\.nothingserious\.quests"/);
  assert.match(html, /APP_SCHEME \+ ":\/\/q\/" \+ shareCode/);
  assert.match(html, /window\.location\.href = APP_STORE_URL/);
  assert.match(html, /Your number is securely matched/);
  assert.match(html, /class="visually-hidden" for="phone-input"/);
  assert.match(html, /success\.focus\(\)/);
  assert.doesNotMatch(html, /Your number is encrypted/);
  assert.doesNotMatch(html, /rest\/v1\/rpc\/get_quest_preview/);
  assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(
    response.headers.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
  );
  assert.equal(
    response.headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
});

test("environment app handoff bindings flow into installed-build targets", async () => {
  const presentation = await fixture("quest-share-upcoming.json");
  const response = await withFetch(
    async () => Response.json(presentation, { status: 200 }),
    () => onRequest(context({
      envOverrides: {
        QUEST_SHARE_APP_SCHEME: "quests-preview",
        QUEST_SHARE_ANDROID_PACKAGE: "info.nothingserious.quests.preview",
        QUEST_SHARE_IOS_STORE_URL: "https://install.example.com/quests-ios",
        QUEST_SHARE_ANDROID_STORE_URL: "https://install.example.com/quests-android",
      },
    })),
  );

  const html = await response.text();
  assert.match(html, /var APP_SCHEME = "quests-preview"/);
  assert.match(html, /var ANDROID_PACKAGE = "info\.nothingserious\.quests\.preview"/);
  assert.match(html, /var APP_STORE_URL = "https:\/\/install\.example\.com\/quests-ios"/);
  assert.match(html, /var PLAY_STORE_URL = "https:\/\/install\.example\.com\/quests-android"/);
  assert.match(html, /APP_SCHEME \+ ":\/\/q\/" \+ shareCode/);
  assert.match(html, /"intent:\/\/q\/" \+ shareCode/);
  assert.match(html, /"#Intent;scheme=" \+ APP_SCHEME \+ ";package=" \+ ANDROID_PACKAGE/);
});

test("presentation mapper escapes copy at render time and validates media origins", async () => {
  const raw = {
    ...(await fixture("quest-share-community.json")),
    title: "<img src=x onerror=alert(1)>",
    shortDescription: "Keep <script>alert(1)</script> moving",
    hostDisplayName: "A & B",
    hostAvatarUrl: "https://attacker.example/avatar.png",
    coverImageUrl: "https://attacker.example/cover.png",
  };
  const presentation = normalizeQuestSharePresentation(raw, { supabaseUrl: SUPABASE_URL });
  assert.ok(presentation);
  assert.equal(presentation.hostAvatarUrl, null);
  assert.equal(presentation.coverImageUrl, null);
  assert.equal(presentation.category, "social_lifestyle");

  const response = questSharePage({
    origin: "https://invite.thequestsapp.com",
    shareCode: "AbCd2345",
    presentation,
    turnstileSiteKey: "0x4AAAAAACaMy8ev_fZjSv2s",
  });
  const html = await response.text();
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /A &amp; B/);
});

test("approved same-project avatar and cover paths survive normalization", async () => {
  const raw = await fixture("quest-share-community.json");
  const standardArtwork = `${SUPABASE_URL}/storage/v1/object/public/standard-quest-backgrounds/social/default.png`;
  const presentation = normalizeQuestSharePresentation({
    ...raw,
    coverImageUrl: standardArtwork,
  }, { supabaseUrl: SUPABASE_URL });
  assert.ok(presentation);
  assert.equal(presentation.hostAvatarUrl, raw.hostAvatarUrl);
  assert.equal(presentation.coverImageUrl, standardArtwork);

  const unapproved = normalizeQuestSharePresentation({
    ...raw,
    coverImageUrl: `${SUPABASE_URL}/storage/v1/object/public/quest-share-media/private-cover.jpg`,
  }, { supabaseUrl: SUPABASE_URL });
  assert.ok(unapproved);
  assert.equal(unapproved.coverImageUrl, null);
});

test("schema v1 requires the complete join-safe presentation contract", async () => {
  const raw = await fixture("quest-share-upcoming.json");
  const required = [
    "presentationVersion",
    "revision",
    "title",
    "hostDisplayName",
    "startDate",
    "duration",
    "cadenceLabel",
    "frequency",
    "status",
    "availability",
    "participantCount",
    "privacyLevel",
  ];

  for (const field of required) {
    const candidate = { ...raw, [field]: null };
    assert.equal(
      normalizeQuestSharePresentation(candidate, { supabaseUrl: SUPABASE_URL }),
      null,
      `${field} should be required`,
    );
  }

  assert.equal(
    normalizeQuestSharePresentation({ ...raw, frequency: "SOMETIMES" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );
  assert.equal(
    normalizeQuestSharePresentation({ ...raw, privacyLevel: "FRIENDS" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );
  assert.equal(
    normalizeQuestSharePresentation({ ...raw, availability: "available" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );
  assert.equal(
    normalizeQuestSharePresentation({ ...raw, category: "community" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );

  const nullable = normalizeQuestSharePresentation({
    ...raw,
    category: null,
    icon: null,
    hostAvatarUrl: null,
    coverImageUrl: null,
    endDate: null,
    shortDescription: null,
    durationDays: null,
  }, { supabaseUrl: SUPABASE_URL });
  assert.ok(nullable);
  assert.equal(nullable.shortDescription, null);
  assert.equal(nullable.iconColor, raw.iconColor);

  assert.equal(
    normalizeQuestSharePresentation({ ...raw, isGroupQuest: "true" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );
  assert.equal(
    normalizeQuestSharePresentation({ ...raw, endDate: "not-a-date" }, { supabaseUrl: SUPABASE_URL }),
    null,
  );
});

test("Community presentation maps public, category, duration, and cadence card slots", async () => {
  const raw = await fixture("quest-share-community.json");
  const presentation = normalizeQuestSharePresentation(raw, { supabaseUrl: SUPABASE_URL });
  assert.ok(presentation);
  assert.equal(presentation.isGroupQuest, true);
  assert.equal(presentation.privacyLevel, "PUBLIC");

  const response = questSharePage({
    origin: "https://invite.thequestsapp.com",
    shareCode: "AbCd2345",
    presentation,
    turnstileSiteKey: "0x4AAAAAACaMy8ev_fZjSv2s",
  });
  const html = await response.text();
  assert.match(html, />Public</);
  assert.match(html, />12 weeks</);
  assert.match(html, />Social &amp; Lifestyle</);
  assert.match(html, /Check in every weekend/);
  assert.match(html, /128 people are doing this Quest/);
  assert.doesNotMatch(html, /class="quest-cover"/);
});

test("OG and Story routes proxy the requested PNG artifact", async () => {
  for (const [file, artifact] of [["og.png", "og"], ["story.png", "story"]]) {
    let edgeBody;
    const response = await withFetch(async (_url, init) => {
      edgeBody = JSON.parse(init.body);
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": "4",
        },
      });
    }, () => onRequest(context({
      path: ["AbCd2345", file],
      search: "?r=9",
      storyEnabled: artifact === "story",
    })));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(response.headers.get("Content-Length"), "4");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(edgeBody, {
      action: "image",
      artifact,
      shareCode: "AbCd2345",
      revision: 9,
    });
  }
});

test("unpublished Story artifact returns a private 404 response", async () => {
  const response = await withFetch(
    async () => Response.json({ code: "unavailable" }, { status: 404 }),
    () => onRequest(context({ path: ["AbCd2345", "story.png"], storyEnabled: true })),
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "Not found");
});

test("Story route stays dark behind its independent feature gate", async () => {
  let edgeCalled = false;
  const response = await withFetch(async () => {
    edgeCalled = true;
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "Content-Type": "image/png" },
    });
  }, () => onRequest(context({ path: ["AbCd2345", "story.png"] })));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(edgeCalled, false);
});

test("artifact upstream failures preserve image content contracts", async () => {
  const og = await withFetch(
    async () => Response.json({ code: "upstream_failed" }, { status: 502 }),
    () => onRequest(context({ path: ["AbCd2345", "og.png"] })),
  );
  assert.equal(og.status, 503);
  assert.match(og.headers.get("Content-Type"), /^text\/plain/);
  assert.equal(og.headers.get("Cache-Control"), "no-store");

  const story = await withFetch(
    async () => Response.json({ code: "upstream_failed" }, { status: 502 }),
    () => onRequest(context({ path: ["AbCd2345", "story.png"], storyEnabled: true })),
  );
  assert.equal(story.status, 404);
  assert.match(story.headers.get("Content-Type"), /^text\/plain/);
  assert.equal(story.headers.get("Cache-Control"), "no-store");
});

test("ended Quest page keeps the card and removes joining controls", async () => {
  const presentation = await fixture("quest-share-ended.json");
  const response = await withFetch(
    async () => Response.json(presentation, { status: 200 }),
    () => onRequest(context()),
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /This Quest has ended/);
  assert.match(html, /This Quest is complete/);
  assert.match(html, /Seven Days of Gratitude/);
  assert.equal(presentation.availability, "ended");
  assert.doesNotMatch(html, /id="phone-claim-form"/);
  assert.doesNotMatch(html, /challenges\.cloudflare\.com\/turnstile/);
});

test("unavailable valid link returns a generic page with zero Quest fields", async () => {
  const response = await withFetch(
    async () => Response.json({ code: "unavailable" }, { status: 404 }),
    () => onRequest(context()),
  );
  const html = await response.text();
  assert.equal(response.status, 404);
  assert.match(html, /This Quest link is unavailable/);
  assert.doesNotMatch(html, /phone-claim-form/);
});

test("malformed metadata fails closed", async () => {
  const response = await withFetch(
    async () => Response.json({ presentationVersion: 2, title: "Leaked Quest" }, { status: 200 }),
    () => onRequest(context()),
  );
  const html = await response.text();
  assert.equal(response.status, 404);
  assert.doesNotMatch(html, /Leaked Quest/);
});

test("pinned revision fails closed when upstream returns another revision", async () => {
  const presentation = {
    ...(await fixture("quest-share-upcoming.json")),
    revision: 4,
  };
  let edgeBody;
  const response = await withFetch(
    async (_url, init) => {
      edgeBody = JSON.parse(init.body);
      return Response.json(presentation, { status: 200 });
    },
    () => onRequest(context({ search: "?r=3" })),
  );
  const html = await response.text();
  assert.deepEqual(edgeBody, {
    action: "metadata",
    shareCode: "AbCd2345",
    revision: 3,
  });
  assert.equal(response.status, 404);
  assert.doesNotMatch(html, /Morning Momentum/);
});

test("upstream failure preserves the legacy Quest experience", async () => {
  const assetCalls = [];
  const response = await withFetch(
    async () => Response.json({ code: "upstream_failed" }, { status: 502 }),
    () => onRequest(context({ assetCalls })),
  );
  assert.equal(await response.text(), LEGACY_MARKUP);
  assert.deepEqual(assetCalls, ["https://invite.thequestsapp.com/q/"]);
});

test("HEAD and unsupported methods follow HTTP contracts", async () => {
  const presentation = await fixture("quest-share-upcoming.json");
  const head = await withFetch(
    async () => Response.json(presentation, { status: 200 }),
    () => onRequest(context({ method: "HEAD" })),
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const post = await onRequest(context({ method: "POST" }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
});

test("phone claim maps a lifecycle race to the stable unavailable response", async () => {
  let call = 0;
  const response = await withFetch(async () => {
    call += 1;
    if (call === 1) {
      return Response.json({
        success: true,
        hostname: "invite.thequestsapp.com",
      });
    }
    return Response.json({ error: "quest_not_joinable" });
  }, () => startPhoneClaim(phoneClaimContext()));

  assert.equal(response.status, 409);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    _v: "rl-600-v2",
    error: "quest_unavailable",
  });
});

test("phone claim bounds public bodies and Turnstile tokens before fetch", async () => {
  let fetchCalls = 0;
  const oversizedBody = await withFetch(
    async () => {
      fetchCalls += 1;
      return Response.json({});
    },
    () => startPhoneClaim(phoneClaimContext({ padding: "x".repeat(9000) })),
  );
  assert.equal(oversizedBody.status, 413);
  assert.deepEqual(await oversizedBody.json(), {
    _v: "rl-600-v2",
    error: "invalid_request",
  });

  const oversizedToken = await withFetch(
    async () => {
      fetchCalls += 1;
      return Response.json({});
    },
    () => startPhoneClaim(phoneClaimContext({ turnstileToken: "x".repeat(2049) })),
  );
  assert.equal(oversizedToken.status, 400);
  assert.equal(fetchCalls, 0);
});

test("phone claim requires a bounded Turnstile response from an allowed host", async () => {
  let suppliedSignal;
  const response = await withSuppressedConsoleError(() =>
    withFetch(
      async (_url, init) => {
        suppliedSignal = init.signal;
        return Response.json({ success: true });
      },
      () => startPhoneClaim(phoneClaimContext()),
    )
  );

  assert.ok(suppliedSignal instanceof AbortSignal);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    _v: "rl-600-v2",
    error: "turnstile_failed",
  });
});

test("phone claim keeps backend diagnostics out of anonymous errors", async () => {
  let call = 0;
  const response = await withSuppressedConsoleError(() =>
    withFetch(async () => {
      call += 1;
      if (call === 1) {
        return Response.json({
          success: true,
          hostname: "invite.thequestsapp.com",
        });
      }
      return new Response("sensitive database function detail", { status: 500 });
    }, () => startPhoneClaim(phoneClaimContext()))
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.deepEqual(body, { _v: "rl-600-v2", error: "internal_error" });
  assert.equal(JSON.stringify(body).includes("sensitive"), false);
  assert.equal("debug_message" in body, false);
  assert.equal("debug_stack" in body, false);
});

test("phone claim keeps thrown diagnostics out of anonymous errors", async () => {
  const response = await withSuppressedConsoleError(() =>
    withFetch(
      async () => {
        throw new Error("sensitive stack path");
      },
      () => startPhoneClaim(phoneClaimContext()),
    )
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    _v: "rl-600-v2",
    error: "service_unavailable",
  });
});

test("existing Profile, link claim, association, and route contracts remain present", async () => {
  const routes = JSON.parse(await readFile(new URL("_routes.json", ROOT), "utf8"));
  assert.ok(routes.include.includes("/q/*"));
  assert.ok(routes.include.includes("/p/*"));
  assert.ok(routes.include.includes("/api/*"));

  const aasa = JSON.parse(await readFile(new URL(".well-known/apple-app-site-association", ROOT), "utf8"));
  const paths = aasa.applinks.details.flatMap((detail) => detail.paths);
  assert.ok(paths.includes("/q/*"));
  assert.ok(paths.includes("/p/*"));

  const profileRoute = await readFile(new URL("functions/p/[[path]].js", ROOT), "utf8");
  const phoneEndpoint = await readFile(new URL("functions/api/link-claims/start.js", ROOT), "utf8");
  assert.match(profileRoute, /profile-share-web/);
  assert.match(phoneEndpoint, /start_link_claim/);
  assert.match(phoneEndpoint, /TURNSTILE_SECRET_KEY/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest } from "../functions/q/[[path]].js";
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
  assert.doesNotMatch(html, /rel="alternate"[^>]+story\.png/);
  assert.match(html, /var shareCode = "AbCd2345"/);
  assert.match(html, /info\.nothingserious\.quests:\/\/q\//);
  assert.match(html, /window\.location\.href = APP_STORE_URL/);
  assert.match(html, /Your number is securely matched/);
  assert.doesNotMatch(html, /Your number is encrypted/);
  assert.doesNotMatch(html, /rest\/v1\/rpc\/get_quest_preview/);
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

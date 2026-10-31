// Website invite CTAs must come from the campaign registry (durable links,
// 2026-10-31). The site test fails when any public page links a code the
// registry does not back, so a dead code like hf9vuqGB cannot ship again.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkInviteLinks,
  inviteLinksInText,
  loadRegistry,
  publicProjection,
  scanSite,
  syncInviteLinks,
} from "../scripts/invite-links.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PRIVATE_KEYS = /"(questId|hostUserId|hostDisplayName|partner|partnerShort|reason|verified|unregistered|projectRef|aliasEligibilityEvidence|questName)"/;

const REGISTRY = {
  schemaVersion: 1,
  inviteOrigin: "https://invite.thequestsapp.com",
  campaigns: [
    {
      id: "2026-11-tcaf-go-nuts",
      shareCode: "fvMz9mhk",
      canonicalUrl: "https://invite.thequestsapp.com/q/fvMz9mhk",
      status: "live",
      supersededCodes: [{ code: "hf9vuqGB", serverAlias: "none" }],
    },
    {
      id: "2026-10-sober",
      shareCode: "kqkHT9GV",
      canonicalUrl: "https://invite.thequestsapp.com/q/kqkHT9GV",
      status: "ended",
      supersededCodes: [],
    },
    {
      id: "2026-11-old",
      shareCode: "Zz23Zz23",
      canonicalUrl: "https://invite.thequestsapp.com/q/Zz23Zz23",
      status: "retired",
      supersededCodes: [{ code: "Yy34Yy34", serverAlias: "active" }],
    },
  ],
};

function check(html, registry = REGISTRY) {
  return checkInviteLinks(registry, inviteLinksInText("page.html", html));
}

const anchor = (href, campaign) =>
  `<a class="event-button" href="${href}"${campaign ? ` data-campaign="${campaign}"` : ""}>Join</a>`;

test("a bound canonical link to a live or ended campaign passes", () => {
  assert.deepEqual(check(anchor("https://invite.thequestsapp.com/q/fvMz9mhk", "2026-11-tcaf-go-nuts")).errors, []);
  assert.deepEqual(check(anchor("https://invite.thequestsapp.com/q/kqkHT9GV", "2026-10-sober")).errors, []);
});

test("a code missing from the registry fails", () => {
  const { errors } = check(anchor("https://invite.thequestsapp.com/q/JWfaB7wu", "2026-11-tcaf-go-nuts"));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not in campaigns\/invite-links\.json/);
});

test("a superseded code without an active server alias fails (the hf9vuqGB case)", () => {
  const { errors } = check(anchor("https://invite.thequestsapp.com/q/hf9vuqGB", "2026-11-tcaf-go-nuts"));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /superseded code of 2026-11-tcaf-go-nuts/);
});

test("a superseded code with an active server alias only warns", () => {
  const { errors, warnings } = check(anchor("https://invite.thequestsapp.com/q/Yy34Yy34"));
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});

test("revision queries, fragments, staging and relative invite links fail", () => {
  for (const href of [
    "https://invite.thequestsapp.com/q/fvMz9mhk?r=2",
    "https://invite.thequestsapp.com/q/fvMz9mhk#join",
    "https://invite-staging.thequestsapp.com/q/fvMz9mhk",
    "/q/fvMz9mhk",
  ]) {
    assert.equal(check(anchor(href, "2026-11-tcaf-go-nuts")).errors.length, 1, href);
  }
});

test("a retired campaign, an unbound link or the wrong campaign fails", () => {
  assert.match(check(anchor("https://invite.thequestsapp.com/q/Zz23Zz23", "2026-11-old")).errors[0], /retired/);
  assert.match(check(anchor("https://invite.thequestsapp.com/q/fvMz9mhk")).errors[0], /does not name its campaign/);
  assert.match(
    check(anchor("https://invite.thequestsapp.com/q/fvMz9mhk", "2026-10-sober")).errors[0],
    /campaign 2026-10-sober canonical URL/,
  );
});

test("JSON records bind through a sibling campaign key and never carry a dead code", () => {
  const links = inviteLinksInText("manifest.json", JSON.stringify({
    invite: "https://invite.thequestsapp.com/q/kqkHT9GV",
    campaign: "2026-10-sober",
  }));
  assert.deepEqual(checkInviteLinks(REGISTRY, links).errors, []);
  // An unbound record is accepted only while its code owns a live or ended
  // campaign; a dead code in a record still fails.
  const unbound = inviteLinksInText("manifest.json", JSON.stringify({
    invite: "https://invite.thequestsapp.com/q/kqkHT9GV",
  }));
  assert.deepEqual(checkInviteLinks(REGISTRY, unbound).errors, []);
  const dead = inviteLinksInText("manifest.json", JSON.stringify({
    invite: "https://invite.thequestsapp.com/q/hf9vuqGB",
  }));
  assert.equal(checkInviteLinks(REGISTRY, dead).errors.length, 1);
});

test("sync rewrites bound links from the registry and leaves links of retired campaigns failing", () => {
  const root = mkdtempSync(join(tmpdir(), "invite-links-"));
  mkdirSync(join(root, "blog"));
  writeFileSync(join(root, "blog", "a.html"), [
    anchor("https://invite.thequestsapp.com/q/fvMz9mhk?r=2", "2026-11-tcaf-go-nuts"),
    anchor("https://invite.thequestsapp.com/q/hf9vuqGB", "2026-11-old"),
  ].join("\n"));
  writeFileSync(join(root, "blog", "m.json"), JSON.stringify({
    invite: "https://invite.thequestsapp.com/q/hf9vuqGB",
    campaign: "2026-11-tcaf-go-nuts",
  }));
  assert.deepEqual(syncInviteLinks(root, REGISTRY), ["blog/a.html", "blog/m.json"]);
  const html = readFileSync(join(root, "blog", "a.html"), "utf8");
  assert.match(html, /href="https:\/\/invite\.thequestsapp\.com\/q\/fvMz9mhk" data-campaign/);
  assert.match(html, /q\/hf9vuqGB" data-campaign="2026-11-old"/);
  assert.match(readFileSync(join(root, "blog", "m.json"), "utf8"), /q\/fvMz9mhk/);
  const { errors } = checkInviteLinks(REGISTRY, scanSite(root));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /hf9vuqGB: superseded code/);
});

test("every invite link on the public site is backed by the vendored campaign registry", () => {
  const registry = loadRegistry(ROOT);
  assert.equal(registry.schemaVersion, 1);
  const links = scanSite(ROOT);
  assert.ok(links.length > 0, "the scan found the blog CTAs");
  const { errors } = checkInviteLinks(registry, links);
  assert.deepEqual(errors, []);
});

test("the vendored file is the public projection only (every repo file is served publicly)", () => {
  const text = readFileSync(join(ROOT, "campaigns", "invite-links.json"), "utf8");
  assert.doesNotMatch(text, PRIVATE_KEYS);
  const projection = JSON.parse(text);
  assert.match(projection.source.commit, /^[0-9a-f]{40}$/);
  assert.match(projection.source.sha256, /^[0-9a-f]{64}$/);
  const full = JSON.stringify({
    schemaVersion: 1,
    inviteOrigin: "https://invite.thequestsapp.com",
    projectRef: "ref",
    unregistered: [{ partner: "P", reason: "private" }],
    campaigns: [{
      id: "a", challengeName: "A", partner: "P", questId: "q", hostUserId: "u",
      shareCode: "fvMz9mhk", canonicalUrl: "https://invite.thequestsapp.com/q/fvMz9mhk",
      status: "live", supersededCodes: [{ code: "hf9vuqGB", questId: "q2", reason: "r", serverAlias: "none" }],
    }],
  });
  const projected = JSON.stringify(publicProjection(full, { commit: "c" }));
  assert.doesNotMatch(projected, PRIVATE_KEYS);
  assert.match(projected, /"hf9vuqGB"/);
});

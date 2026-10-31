#!/usr/bin/env node
// Website invite CTAs read from one campaign source: the Quests repo's
// campaigns/registry.json (owned by the campaign-url workstream). The full
// registry carries partner notes and user ids, and every file in this repo
// is served publicly, so the site vendors only its public projection,
// campaigns/invite-links.json (ids, codes, canonical URLs, status, superseded
// codes), stamped with the source commit and SHA-256. Regenerate it with
//   node scripts/invite-links.mjs vendor <path to Quests campaigns/registry.json> <commit>
// and a plain diff shows whether the copy is current. Every invite link on a public page names
// its campaign (data-campaign on an <a>) and must equal that campaign's
// canonical URL exactly. JSON records may name it with a sibling "campaign".
//
//   node scripts/invite-links.mjs check   fail on any link the registry does not back
//   node scripts/invite-links.mjs sync    rewrite bound links from the registry
//   node scripts/invite-links.mjs vendor  refresh the public projection
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTRY_PATH = "campaigns/invite-links.json";
const INVITE_ORIGIN = "https://invite.thequestsapp.com";
const SCANNED_EXTENSIONS = new Set([".html", ".htm", ".json", ".js", ".xml", ".txt", ".webmanifest"]);
// Internal notes, fixtures and server code carry example codes; only files a
// visitor can load are checked.
const SKIPPED_DIRECTORIES = new Set([
  ".git", ".next", ".wrangler", "node_modules", "campaigns", "design-refs",
  "dev", "docs", "functions", "handoff", "quest-share-fixtures", "scripts",
  "tests", "workers",
]);
// Absolute or site-relative invite URLs, staging included, up to a quote,
// whitespace or tag boundary.
const INVITE_URL_PATTERN =
  /(?:https?:\/\/invite(?:-staging)?\.thequestsapp\.com)?\/q\/[A-Za-z0-9]{8}(?![A-Za-z0-9])[^"'\s<>)\]]*/g;
const CANONICAL_PATTERN = /^https:\/\/invite\.thequestsapp\.com\/q\/([A-HJ-NP-Za-hj-kmnp-z2-9]{8})$/;
const ANCHOR_PATTERN = /<a\b[^>]*>/gi;

export function loadRegistry(root) {
  return JSON.parse(readFileSync(join(root, REGISTRY_PATH), "utf8"));
}

// The public projection of the Quests campaign registry: only what the site
// already publishes in its CTAs, plus provenance.
export function publicProjection(registryText, { commit = null } = {}) {
  const registry = JSON.parse(registryText);
  return {
    schemaVersion: registry.schemaVersion,
    source: {
      repository: "Quests-Improve-Together-App/Quests",
      path: "campaigns/registry.json",
      commit,
      sha256: createHash("sha256").update(registryText).digest("hex"),
    },
    inviteOrigin: registry.inviteOrigin,
    campaigns: (registry.campaigns ?? []).map((campaign) => ({
      id: campaign.id,
      challengeName: campaign.challengeName,
      shareCode: campaign.shareCode,
      canonicalUrl: campaign.canonicalUrl,
      status: campaign.status,
      supersededCodes: (campaign.supersededCodes ?? []).map((entry) => ({
        code: entry.code,
        serverAlias: entry.serverAlias,
      })),
    })),
  };
}

export function publicSiteFiles(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...publicSiteFiles(root, join(directory, entry.name)));
      }
    } else if (SCANNED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(join(directory, entry.name));
    }
  }
  return files.sort();
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function jsonBindings(value, path = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonBindings(item, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && child.match(INVITE_URL_PATTERN)) {
        out.push({ url: child, campaignId: typeof value.campaign === "string" ? value.campaign : null, where: `${path}.${key}` });
      } else {
        jsonBindings(child, `${path}.${key}`, out);
      }
    }
  }
  return out;
}

// Every invite URL in a file, with the campaign it is bound to when the
// enclosing <a> or JSON object names one.
export function inviteLinksInText(file, text) {
  const links = [];
  if (file.endsWith(".json") || file.endsWith(".webmanifest")) {
    try {
      for (const binding of jsonBindings(JSON.parse(text))) {
        links.push({ file, line: null, ...binding });
      }
      return links;
    } catch {
      // Malformed JSON falls through to the plain text scan.
    }
  }
  const anchors = [];
  for (const match of text.matchAll(ANCHOR_PATTERN)) {
    anchors.push({ start: match.index, end: match.index + match[0].length, tag: match[0] });
  }
  for (const match of text.matchAll(INVITE_URL_PATTERN)) {
    const anchor = anchors.find((a) => match.index >= a.start && match.index < a.end);
    links.push({
      file,
      line: lineOf(text, match.index),
      url: match[0],
      campaignId: anchor ? attribute(anchor.tag, "data-campaign") : null,
      where: anchor ? "a[href]" : "text",
    });
  }
  return links;
}

export function scanSite(root) {
  return publicSiteFiles(root).flatMap((path) =>
    inviteLinksInText(relative(root, path), readFileSync(path, "utf8")));
}

export function checkInviteLinks(registry, links) {
  const errors = [];
  const warnings = [];
  const campaigns = Array.isArray(registry?.campaigns) ? registry.campaigns : [];
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const byCode = new Map(campaigns.map((campaign) => [campaign.shareCode, campaign]));
  const superseded = new Map();
  for (const campaign of campaigns) {
    for (const entry of campaign.supersededCodes ?? []) superseded.set(entry.code, { campaign, entry });
  }

  for (const link of links) {
    const at = `${link.file}${link.line ? `:${link.line}` : ""} ${link.url}`;
    const canonical = CANONICAL_PATTERN.exec(link.url);
    if (!canonical) {
      errors.push(`${at}: not a canonical ${INVITE_ORIGIN}/q/<code> URL (no query, no fragment, production host)`);
      continue;
    }
    const code = canonical[1];
    const owner = byCode.get(code);
    if (!owner) {
      const old = superseded.get(code);
      if (old && old.entry.serverAlias === "active") {
        warnings.push(`${at}: superseded code redirects to ${old.campaign.canonicalUrl}; run sync`);
      } else if (old) {
        errors.push(`${at}: superseded code of ${old.campaign.id} with no active server alias; link ${old.campaign.canonicalUrl}`);
      } else {
        errors.push(`${at}: code ${code} is not in ${REGISTRY_PATH}`);
      }
      continue;
    }
    if (owner.status === "retired") {
      errors.push(`${at}: campaign ${owner.id} is retired`);
      continue;
    }
    if (!link.campaignId) {
      // Data files (event manifests) are records, not CTAs, and live under
      // the frozen assets boundary; their code must still be a live or ended
      // campaign. Page links must name their campaign.
      if (link.where !== "a[href]" && link.where !== "text") continue;
      errors.push(`${at}: invite link does not name its campaign (data-campaign="${owner.id}")`);
      continue;
    }
    const bound = byId.get(link.campaignId);
    if (!bound) {
      errors.push(`${at}: unknown campaign ${link.campaignId}`);
    } else if (bound.canonicalUrl !== link.url) {
      errors.push(`${at}: campaign ${bound.id} canonical URL is ${bound.canonicalUrl}`);
    }
  }
  return { errors, warnings };
}

// Rewrites every bound link to its campaign's canonical URL. Retired
// campaigns are left alone so the check keeps failing until a person decides.
export function syncInviteLinks(root, registry) {
  const byId = new Map((registry.campaigns ?? []).map((campaign) => [campaign.id, campaign]));
  const changed = [];
  for (const path of publicSiteFiles(root)) {
    const text = readFileSync(path, "utf8");
    let next = text;
    if (path.endsWith(".json")) {
      try {
        const data = JSON.parse(text);
        const visit = (value) => {
          if (Array.isArray(value)) return value.forEach(visit);
          if (!value || typeof value !== "object") return;
          const campaign = byId.get(value.campaign);
          if (campaign && campaign.status !== "retired" && typeof value.invite === "string" &&
            value.invite !== campaign.canonicalUrl) {
            next = next.replace(JSON.stringify(value.invite), JSON.stringify(campaign.canonicalUrl));
          }
          Object.values(value).forEach(visit);
        };
        visit(data);
      } catch {
        // Leave malformed JSON for the check to report.
      }
    } else {
      next = text.replace(ANCHOR_PATTERN, (tag) => {
        const campaign = byId.get(attribute(tag, "data-campaign"));
        if (!campaign || campaign.status === "retired") return tag;
        return tag.replace(/(\shref\s*=\s*")[^"]*(")/i, `$1${campaign.canonicalUrl}$2`);
      });
    }
    if (next !== text) {
      writeFileSync(path, next);
      changed.push(relative(root, path));
    }
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const command = process.argv[2] ?? "check";
  if (command === "vendor") {
    const [source, commit] = process.argv.slice(3);
    if (!source) {
      console.error("usage: node scripts/invite-links.mjs vendor <registry.json> <commit>");
      process.exit(2);
    }
    const projection = publicProjection(readFileSync(source, "utf8"), { commit: commit ?? null });
    writeFileSync(join(root, REGISTRY_PATH), `${JSON.stringify(projection, null, 2)}\n`);
    console.log(`wrote ${REGISTRY_PATH} from ${source} (${projection.source.sha256.slice(0, 12)})`);
  }
  const registry = loadRegistry(root);
  if (command === "sync") {
    const changed = syncInviteLinks(root, registry);
    console.log(changed.length ? `updated ${changed.join(", ")}` : "invite links already match the registry");
  }
  const { errors, warnings } = checkInviteLinks(registry, scanSite(root));
  for (const warning of warnings) console.warn(`warn  ${warning}`);
  for (const error of errors) console.error(`error ${error}`);
  if (errors.length) process.exit(1);
  console.log(`invite links ok (${scanSite(root).length} checked against ${REGISTRY_PATH})`);
}

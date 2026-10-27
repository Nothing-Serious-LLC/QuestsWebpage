#!/usr/bin/env node
// Local stand-in for the Supabase endpoints the share route and the claim
// endpoint call, so `wrangler pages dev` can be load tested without touching
// staging or production.
//
//   node scripts/claim-rpc-stub.mjs --port 8799
//
// Serves:
//   POST /rest/v1/rpc/start_link_claim        -> 200 { claim_id, ... }
//   POST /functions/v1/quest-share-web        -> metadata JSON or PNG by code
//   GET  /stats                               -> call counters
//
// Share codes: AbCd2345 is joinable, EnDeD234 has ended, anything else is 404.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1] || 8799);

const joinable = JSON.parse(
  await readFile(join(here, "../tests/fixtures/quest-share-upcoming.json"), "utf8"),
);
const ended = JSON.parse(
  await readFile(join(here, "../tests/fixtures/quest-share-ended.json"), "utf8"),
);
const png = await readFile(join(here, "../quest-share-og-fallback.png"));

const stats = { claims: 0, metadata: 0, images: 0 };

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function json(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === "GET" && url.pathname === "/stats") {
    return json(response, 200, stats);
  }

  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/start_link_claim") {
    const body = JSON.parse(await readBody(request));
    stats.claims += 1;
    return json(response, 200, {
      claim_id: `claim-${stats.claims}`,
      masked_phone: `***${String(body.p_phone_last4 || "0000")}`,
      status: "PENDING",
      expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    });
  }

  if (request.method === "POST" && url.pathname === "/functions/v1/quest-share-web") {
    const body = JSON.parse(await readBody(request));
    const presentation =
      body.shareCode === "AbCd2345" ? joinable
      : body.shareCode === "EnDeD234" ? ended
      : null;
    if (!presentation) return json(response, 404, { code: "not_found" });
    if (body.action === "image") {
      stats.images += 1;
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": png.length,
      });
      return response.end(png);
    }
    stats.metadata += 1;
    return json(response, 200, presentation);
  }

  json(response, 404, { code: "unknown_route" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`claim-rpc-stub listening on http://127.0.0.1:${port}`);
});

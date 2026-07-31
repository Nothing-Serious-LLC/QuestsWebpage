import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ICON_CREATIVITY,
  ICON_GROWTH,
  ICON_MINDFULNESS,
  ICON_RECHARGE,
  ICON_SOCIAL,
  WORDMARK,
} from "../functions/p/pageAssets.js";

const OUTPUT = new URL("../quest-share-og-fallback.png", import.meta.url);
const WIDTH = 1200;
const HEIGHT = 630;

function renderBrandAsset(svg, color, path) {
  const simplified = svg
    .replace(/ (?:clip-path|filter)="[^"]+"/g, "")
    .replace(/fill="url\([^"]+\)"/g, `fill="${color}"`);
  const rendered = spawnSync("magick", [
    "-background",
    "none",
    "svg:-",
    "png:-",
  ], {
    input: simplified,
    maxBuffer: 8 * 1024 * 1024,
  });

  if (rendered.status !== 0) {
    throw new Error(rendered.stderr.toString("utf8") || "Unable to render brand asset");
  }

  writeFileSync(path, rendered.stdout);
}

function geometryOffset(value) {
  return value >= 0 ? `+${value}` : String(value);
}

const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="1200" height="630" fill="#F3F1E7"/>
  <circle cx="600" cy="352" r="388" fill="#FFFFFF" opacity="0.18"/>

  <text x="600" y="131" text-anchor="middle" fill="#191919"
    font-family="Georgia, serif" font-size="43">You've been invited to a Quest</text>

  <rect x="152" y="181" width="896" height="344" rx="46" fill="#433B28" fill-opacity="0.08"/>
  <rect x="140" y="166" width="920" height="346" rx="46" fill="#FFFFFF" fill-opacity="0.95"/>
  <rect x="141" y="167" width="918" height="344" rx="45" fill="none" stroke="#191919" stroke-opacity="0.08" stroke-width="2"/>

  <circle cx="600" cy="234" r="43" fill="#E7DDF5"/>
  <circle cx="616" cy="218" r="18" fill="#FFB18F" fill-opacity="0.34"/>
  <text x="600" y="248" text-anchor="middle" fill="#292929"
    font-family="Avenir, Helvetica, sans-serif" font-size="38" font-weight="700">Q</text>

  <text x="600" y="330" text-anchor="middle" fill="#191919"
    font-family="Avenir, Helvetica, sans-serif" font-size="42" font-weight="700">Quest invitation</text>
  <text x="600" y="371" text-anchor="middle" fill="#5C5C5C"
    font-family="Avenir, Helvetica, sans-serif" font-size="20" font-weight="500">Open the link to see the Quest details and join.</text>

  <g font-family="Avenir, Helvetica, sans-serif" font-size="17" font-weight="500" fill="#525252">
    <rect x="397" y="409" width="178" height="44" rx="22" fill="#F3F1E7"/>
    <text x="486" y="437" text-anchor="middle">Shared with you</text>
    <rect x="591" y="409" width="212" height="44" rx="22" fill="#F3F1E7"/>
    <text x="697" y="437" text-anchor="middle">Open in Quests</text>
  </g>
</svg>`;

const temp = mkdtempSync(join(tmpdir(), "quest-share-og-fallback-"));
try {
  const base = join(temp, "base.png");
  const brandAssets = {
    creativity: join(temp, "creativity.png"),
    growth: join(temp, "growth.png"),
    mindfulness: join(temp, "mindfulness.png"),
    recharge: join(temp, "recharge.png"),
    social: join(temp, "social.png"),
    wordmark: join(temp, "wordmark.png"),
  };

  renderBrandAsset(ICON_CREATIVITY, "#FF8F5E", brandAssets.creativity);
  renderBrandAsset(ICON_GROWTH, "#D1AA56", brandAssets.growth);
  renderBrandAsset(ICON_MINDFULNESS, "#D5AFE8", brandAssets.mindfulness);
  renderBrandAsset(ICON_RECHARGE, "#92A8EC", brandAssets.recharge);
  renderBrandAsset(ICON_SOCIAL, "#92A8EC", brandAssets.social);
  renderBrandAsset(WORDMARK, "#191919", brandAssets.wordmark);

  const background = spawnSync("magick", ["svg:-", base], {
    input: source,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (background.status !== 0) {
    throw new Error(background.stderr.toString("utf8") || "Unable to render fallback background");
  }

  const placements = [
    { asset: "growth", x: -18, y: 30, width: 132, opacity: 92, rotate: -9 },
    { asset: "creativity", x: 1044, y: 42, width: 112, opacity: 90, rotate: 11 },
    { asset: "mindfulness", x: 1113, y: 250, width: 126, opacity: 78, rotate: 7 },
    { asset: "social", x: -36, y: 326, width: 128, opacity: 82, rotate: 6 },
    { asset: "recharge", x: 65, y: 525, width: 116, opacity: 88, rotate: 9 },
    { asset: "social", x: 954, y: 535, width: 128, opacity: 84, rotate: -7 },
    { asset: "growth", x: 1111, y: 501, width: 86, opacity: 82, rotate: -8 },
    { asset: "creativity", x: 131, y: 191, width: 72, opacity: 62, rotate: 4 },
    { asset: "wordmark", x: 527, y: 32, width: 146, height: 39, opacity: 100, rotate: 0 },
  ];

  const command = [base];
  for (const placement of placements) {
    command.push(
      "(",
      brandAssets[placement.asset],
      "-resize",
      `${placement.width}x${placement.height ?? placement.width}!`,
      "-channel",
      "A",
      "-evaluate",
      "multiply",
      String(placement.opacity / 100),
      "+channel",
      "-background",
      "none",
      "-rotate",
      String(placement.rotate),
      ")",
      "-geometry",
      `${geometryOffset(placement.x)}${geometryOffset(placement.y)}`,
      "-compose",
      "over",
      "-composite",
    );
  }
  command.push(
    "-strip",
    "-depth",
    "8",
    "-define",
    "png:compression-level=9",
    "png:-",
  );

  const rendered = spawnSync("magick", command, { maxBuffer: 16 * 1024 * 1024 });
  if (rendered.status !== 0) {
    throw new Error(rendered.stderr.toString("utf8") || "Unable to composite fallback image");
  }

  writeFileSync(OUTPUT, rendered.stdout);
  console.log(`Wrote ${OUTPUT.pathname} (${rendered.stdout.length} bytes)`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

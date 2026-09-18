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
const WIDTH = 1080;
const HEIGHT = 1350;

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
  <rect width="1080" height="1350" fill="#F3F1E7"/>
  <circle cx="540" cy="700" r="430" fill="#FFFFFF" opacity="0.18"/>

  <text x="540" y="176" text-anchor="middle" fill="#191919"
    font-family="Georgia, serif" font-size="56">You&#8217;ve been invited to a Quest</text>

  <rect x="172" y="239" width="736" height="558" rx="88" fill="#433B28" fill-opacity="0.08"/>
  <rect x="160" y="224" width="760" height="560" rx="88" fill="#FFFFFF" fill-opacity="0.95"/>
  <rect x="161" y="225" width="758" height="558" rx="87" fill="none" stroke="#191919" stroke-opacity="0.08" stroke-width="2"/>

  <circle cx="540" cy="358" r="64" fill="#E7DDF5"/>
  <circle cx="564" cy="334" r="27" fill="#FFB18F" fill-opacity="0.34"/>
  <text x="540" y="379" text-anchor="middle" fill="#292929"
    font-family="Avenir, Helvetica, sans-serif" font-size="56" font-weight="700">Q</text>

  <text x="540" y="520" text-anchor="middle" fill="#191919"
    font-family="Avenir, Helvetica, sans-serif" font-size="62" font-weight="700">Quest invitation</text>
  <text x="540" y="582" text-anchor="middle" fill="#5C5C5C"
    font-family="Avenir, Helvetica, sans-serif" font-size="30" font-weight="500">Open the link to see the Quest details and join.</text>

  <g font-family="Avenir, Helvetica, sans-serif" font-size="26" font-weight="500" fill="#525252">
    <rect x="252" y="648" width="260" height="64" rx="32" fill="#F3F1E7"/>
    <text x="382" y="689" text-anchor="middle">Shared with you</text>
    <rect x="528" y="648" width="300" height="64" rx="32" fill="#F3F1E7"/>
    <text x="678" y="689" text-anchor="middle">Open in Quests</text>
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
    { asset: "growth", x: -22, y: 120, width: 150, opacity: 92, rotate: -9 },
    { asset: "creativity", x: 936, y: 92, width: 130, opacity: 90, rotate: 11 },
    { asset: "mindfulness", x: 948, y: 560, width: 146, opacity: 78, rotate: 7 },
    { asset: "social", x: -34, y: 640, width: 148, opacity: 82, rotate: 6 },
    { asset: "recharge", x: 96, y: 1130, width: 132, opacity: 88, rotate: 9 },
    { asset: "social", x: 852, y: 1168, width: 146, opacity: 84, rotate: -7 },
    { asset: "growth", x: 972, y: 934, width: 98, opacity: 82, rotate: -8 },
    { asset: "creativity", x: 128, y: 968, width: 84, opacity: 62, rotate: 4 },
    { asset: "wordmark", x: 440, y: 44, width: 200, height: 53, opacity: 100, rotate: 0 },
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

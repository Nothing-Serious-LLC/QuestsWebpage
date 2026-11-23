// This release freezes the homepage, its assets, legal copy, and app infrastructure.
// Change the approved base only after a separately reviewed release.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Preserve independently merged PR 31 and its verified November 16 production release.
const base = '96ea3086f236986fae9a4759c88068edf06f3933';
const protectedPaths = [
  'index.html', 'css', 'js',
  'js/landing.js', 'js/clean-urls.js', 'js/device-download.mjs',
  'js/download-platform.mjs', 'js/download-qr-redirect.js', 'js/vendor',
  'css/device-download.css', 'assets',
  'favicon.ico', 'favicon-32.png', 'favicon-96.png', 'apple-touch-icon.png',
  'site.webmanifest', 'og-image.png', 'download-on-the-app-store.svg', 'google-play-badge.svg',
  'functions', '.well-known', '_headers', '_redirects', '_routes.json', 'CNAME', 'robots.txt',
  'QuestCard.pass', 'QuestCard.pkpass', 'fix-and-rebuild-pass.py',
  'subscribe-app.js', 'subscribe-boot.js', 'q/index.html',
  'privacy.html', 'terms.html', 'health-privacy.html', 'business-health',
];
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', base], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(file => file.endsWith('.sh') || protectedPaths.some(path => file === path || file.startsWith(`${path}/`)));
const changed = [];
for (const file of files) {
  const original = execFileSync('git', ['show', `${base}:${file}`], { cwd: root, maxBuffer: 20 * 1024 * 1024 });
  try { if (!original.equals(readFileSync(new URL(file, new URL('../', import.meta.url))))) changed.push(file); }
  catch { changed.push(file); }
}
if (changed.length) {
  console.error(`Protected files changed:\n${changed.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Release boundaries passed: ${files.length} protected files match approved base ${base.slice(0, 12)} byte-for-byte.`);
}

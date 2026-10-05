// Validate the public static pages that Google is asked to index.
// Run with npm run check:seo. Uses local files and makes no network requests.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const origin = 'https://thequestsapp.com';
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1].toLowerCase(), m[3]]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => attrs(m[0]));
const urls = [...readFileSync(new URL('sitemap.xml', root), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
check(new Set(urls).size === urls.length, 'Duplicate sitemap URLs');
const pages = new Map();
const titles = new Set();
const descriptions = new Set();
const entities = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d' };
const plainText = text => text.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, entity) =>
  entity.startsWith('#') ? String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10)) : entities[entity] ?? all).replace(/\s+/g, ' ').trim();

function localFile(pathname) {
  const path = decodeURIComponent(pathname.replace(/^\//, ''));
  const candidates = pathname === '/' ? ['index.html'] : [path, `${path}.html`, `${path}/index.html`];
  return candidates.map(p => new URL(p, root)).find(p => p.href.startsWith(root.href) && existsSync(p) && statSync(p).isFile());
}

for (const address of urls) {
  const url = new URL(address);
  check(url.origin === origin && !url.search && !url.hash, `Unexpected sitemap URL: ${address}`);
  const file = localFile(url.pathname);
  check(file, `Missing sitemap document: ${address}`);
  if (!file) continue;
  const html = readFileSync(file, 'utf8');
  check(/<html\b[^>]*lang=["']en["']/i.test(html), `Missing English language declaration: ${address}`);
  const meta = tags(html, 'meta');
  const canonical = tags(html, 'link').filter(t => t.rel === 'canonical');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = meta.find(t => t.name === 'description')?.content;
  check(canonical.length === 1 && canonical[0].href === address, `Canonical mismatch: ${address}`);
  check(title && !titles.has(title), `Missing or duplicate title: ${address}`);
  check(description && !descriptions.has(description), `Missing or duplicate description: ${address}`);
  check(!meta.some(t => /^(robots|googlebot)$/i.test(t.name || '') && /\b(noindex|none)\b/i.test(t.content)), `Indexing blocked: ${address}`);
  check((html.match(/<h1\b/gi) || []).length === 1, `Expected one descriptive H1: ${address}`);
  titles.add(title);
  descriptions.add(description);
  const links = tags(html, 'a').map(t => t.href).filter(Boolean);
  pages.set(address, { html, links });
  for (const image of tags(html, 'img')) {
    check(Object.hasOwn(image, 'alt'), `Image missing alt attribute: ${address}: ${image.src}`);
  }
  // Validate every linked local file, image, stylesheet and script.
  const assets = [...tags(html, 'img'), ...tags(html, 'script')].map(t => t.src);
  for (const tag of [...tags(html, 'img'), ...tags(html, 'source')]) {
    assets.push(...(tag.srcset || '').split(',').map(source => source.trim().split(/\s+/)[0]).filter(Boolean));
  }
  assets.push(...tags(html, 'link').filter(t => ['stylesheet', 'icon', 'apple-touch-icon', 'preload'].includes(t.rel)).map(t => t.href));
  for (const target of [...links, ...assets].filter(Boolean)) {
    const dest = new URL(target, address);
    if (dest.origin === origin) {
      const targetFile = localFile(dest.pathname);
      check(targetFile, `Missing local target: ${address}: ${target}`);
      if (targetFile && dest.hash && targetFile.pathname.endsWith('.html')) {
        const fragment = decodeURIComponent(dest.hash.slice(1));
        const ids = [...readFileSync(targetFile, 'utf8').matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(m => m[2]);
        check(ids.includes(fragment), `Missing fragment: ${address}: ${target}`);
      }
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const schema = JSON.parse(match[1]);
      for (const node of schema['@graph'] || [schema]) {
        if (node['@type'] === 'FAQPage') {
          const visibleFaq = [...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)].map(m => plainText(m[1]));
          for (const question of node.mainEntity || []) {
            check(visibleFaq.some(text => text.includes(plainText(question.name)) && text.includes(plainText(question.acceptedAnswer.text))), `FAQ schema differs from visible answer: ${address}: ${question.name}`);
          }
        }
        if (node['@type'] === 'BlogPosting') {
          const articleUrl = node.url || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage;
          check(articleUrl === address, `Article schema URL mismatch: ${address}`);
          check(node.author?.name && node.author?.url, `Missing author identity: ${address}`);
          if (node.author?.url) {
            const authorUrl = new URL(node.author.url, address);
            if (authorUrl.origin === origin) check(localFile(authorUrl.pathname), `Missing author destination: ${address}`);
            check(links.some(link => new URL(link, address).href === authorUrl.href), `Author destination must be linked on the page: ${address}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Invalid JSON-LD: ${address}: ${error.message}`);
    }
  }
}

// A sitemap alone does not make a page reachable through normal navigation.
const reachable = new Set();
const pending = [`${origin}/`];
while (pending.length) {
  const address = pending.pop();
  if (reachable.has(address) || !pages.has(address)) continue;
  reachable.add(address);
  for (const href of pages.get(address).links) {
    const target = new URL(href, address);
    target.hash = '';
    target.search = '';
    if (pages.has(target.href)) pending.push(target.href);
  }
}
for (const address of pages.keys()) check(reachable.has(address), `Orphan sitemap page: ${address}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`SEO checks passed: ${pages.size} indexable static pages, unique metadata, valid JSON-LD, existing local targets, linked author identity, and no orphan sitemap pages.`);
  console.log(`Source: ${fileURLToPath(root)}`);
}

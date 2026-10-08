// Local content inventory and peer-link audit. Keep output in private evidence.
import { readdirSync, readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const origin = 'https://thequestsapp.com';
const articles = new Map();
for (const file of readdirSync(new URL('blog/', root)).filter(file => file.endsWith('.html'))) {
  const html = readFileSync(new URL(`blog/${file}`, root), 'utf8');
  if (!/"@type":\s*"BlogPosting"/.test(html)) continue;
  const path = `/blog/${file.replace(/\.html$/, '')}`;
  const body = html.match(/<article class="card article[\s\S]*?<\/article>/)?.[0] || '';
  const links = source => [...source.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m => new URL(m[1], origin));
  articles.set(path, { path, title: html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1],
    words: body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
    outgoing: [...new Set(links(html).filter(url => url.origin === origin && url.pathname.startsWith('/blog/') && url.pathname !== path).map(url => url.pathname))],
    contextual: [...new Set(links(body).filter(url => url.origin === origin && url.pathname.startsWith('/blog/')).map(url => url.pathname))], incoming: [] });
}
for (const [from, article] of articles) for (const to of article.outgoing) articles.get(to)?.incoming.push(from);
const rows = [...articles.values()].sort((a, b) => a.path.localeCompare(b.path));
const peerOrphans = rows.filter(row => !row.incoming.length).map(row => row.path);
const report = { observedAt: new Date().toISOString(), articleCount: rows.length, peerOrphans,
  productGuideContextualLinks: rows.filter(row => row.contextual.includes('/blog/what-is-the-quests-app')).length,
  note: 'Counts verify content and links. Search performance requires provider data.', articles: rows };
console.log(JSON.stringify(report, null, 2));
if (peerOrphans.length) process.exitCode = 1;

// Read-only audit of our public site. Two requests at a time; no Google scraping.
// Usage: node scripts/audit-seo-live.mjs [https://thequestsapp.com] > /private/path/crawl.json
const origin = 'https://thequestsapp.com';
const base = new URL(process.argv[2] || origin);
if (base.origin !== origin && !['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use the official site or a local preview');
const issues = [];
const get = async (path, options = {}) => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000), redirect: 'manual', ...options });
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), body: await response.text() };
};
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const tags = (body, name) => [...body.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => m[0]);
try {
  const sitemap = await get('/sitemap.xml');
  if (sitemap.status !== 200) throw new Error(`Sitemap returned ${sitemap.status}`);
  const addresses = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (!addresses.length || new Set(addresses).size !== addresses.length) throw new Error('Empty or duplicate sitemap URLs');
  if (addresses.some(address => new URL(address).origin !== origin || new URL(address).search || new URL(address).hash)) throw new Error('Unexpected sitemap URL');
  const rows = [];
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < addresses.length) {
      const address = addresses[next++];
      const problems = [];
      try {
        const response = await get(new URL(address).pathname);
        const canonical = tags(response.body, 'link').filter(t => attr(t, 'rel') === 'canonical').map(t => attr(t, 'href'));
        const description = tags(response.body, 'meta').find(t => attr(t, 'name') === 'description');
        const robots = tags(response.body, 'meta').filter(t => /^(robots|googlebot)$/i.test(attr(t, 'name') || '')).map(t => attr(t, 'content')).join(',');
        const title = response.body.match(/<title>([^<]+)<\/title>/i)?.[1];
        if (response.status !== 200) problems.push(`HTTP ${response.status}`);
        if (!response.headers['content-type']?.includes('text/html')) problems.push('Expected HTML');
        if (canonical.length !== 1 || canonical[0] !== address) problems.push('Canonical mismatch');
        if (!title || !attr(description || '', 'content')) problems.push('Missing title or description');
        // Local review servers intentionally send noindex headers. Check production headers and all page meta tags.
        const indexingDirectives = `${robots},${base.origin === origin ? response.headers['x-robots-tag'] || '' : ''}`;
        if (/\b(noindex|none)\b/i.test(indexingDirectives)) problems.push('Indexing blocked');
        for (const script of response.body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
          try { JSON.parse(script[1]); } catch { problems.push('Invalid JSON-LD'); }
        }
        rows.push({ address, status: response.status, canonical: canonical[0] || null, title, issues: problems });
      } catch (error) { problems.push(error.message); rows.push({ address, status: null, issues: problems }); }
      issues.push(...problems.map(problem => `${address}: ${problem}`));
    }
  }));
  const missing = await get('/__quests_seo_missing_page_check__');
  if (missing.status !== 404) issues.push(`Missing page returned ${missing.status}, expected 404`);
  const robots = await get('/robots.txt');
  if (robots.status !== 200 || !robots.body.includes(`${origin}/sitemap.xml`)) issues.push('Robots sitemap declaration missing');
  const redirects = [];
  if (base.origin === origin) {
    for (const from of ['http://thequestsapp.com/', 'http://www.thequestsapp.com/', 'https://www.thequestsapp.com/']) {
      const response = await fetch(from, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const to = response.headers.get('location');
      await response.body?.cancel();
      redirects.push({ from, status: response.status, to });
      if (![301, 308].includes(response.status) || to !== `${origin}/`) issues.push(`Unexpected canonical redirect: ${from}`);
    }
  }
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), base: base.origin, pageCount: rows.length,
    missingPageStatus: missing.status, redirects, previewHeadersExcluded: base.origin !== origin,
    pages: rows.sort((a, b) => a.address.localeCompare(b.address)), issues,
    note: 'HTTP and markup checks confirm delivery. Search Console is required to verify indexing and ranking. Performance and Googlebot-specific robots rules require separate checks.' }, null, 2));
  if (issues.length) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }

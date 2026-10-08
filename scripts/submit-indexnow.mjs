// Dry run by default. Submit only after production publication has been verified.
// node scripts/submit-indexnow.mjs --urls /private/changed-urls.json
// Add --submit --receipt /private/indexnow-receipt.json to notify IndexNow.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://thequestsapp.com';
const endpoint = 'https://api.indexnow.org/indexnow';

export function makePayload(urls, config, sitemap) {
  if (config.host !== 'thequestsapp.com' || config.endpoint !== endpoint || !/^[a-f0-9]{32}$/.test(config.key)) {
    throw new Error('Unexpected IndexNow configuration');
  }
  if (!Array.isArray(urls) || !urls.length || urls.length > 10000) throw new Error('Supply 1 to 10000 changed URLs');
  const allowed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  for (const value of urls) {
    if (typeof value !== 'string') throw new Error('URL must be a string');
    const url = new URL(value);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash ||
        !(url.pathname === '/blog' || url.pathname.startsWith('/blog/')) || !allowed.has(value)) {
      throw new Error(`URL must be an exact, canonical blog URL in the sitemap: ${value}`);
    }
  }
  return { host: config.host, key: config.key, keyLocation: `${origin}/${config.key}.txt`, urlList: [...new Set(urls)] };
}

export async function verifyPublished(payload, request = fetch) {
  const get = url => request(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const keyResponse = await get(payload.keyLocation);
  if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== payload.key) throw new Error('Public ownership key is unavailable or differs');
  // Bound concurrency to avoid unnecessary load on the site.
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < payload.urlList.length) {
      const url = payload.urlList[next++];
      const response = await get(url);
      const body = await response.text();
      const canonical = [...body.matchAll(/<link\b[^>]*>/gi)]
        .map(m => m[0]).filter(tag => /\brel=["']canonical["']/i.test(tag))
        .map(tag => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]);
      const metaRobots = [...body.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0])
        .filter(tag => /\bname=["'](?:robots|googlebot|bingbot)["']/i.test(tag)).join(' ');
      if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html') ||
          canonical.length !== 1 || canonical[0] !== url ||
          /\b(?:noindex|none)\b/i.test(`${response.headers.get('x-robots-tag') || ''} ${metaRobots}`)) {
        throw new Error(`Publication check failed: ${url}`);
      }
    }
  }));
}

export function responseMeaning(status) {
  if (status === 200) return 'Accepted by IndexNow. Crawling, indexing and ranking remain unverified.';
  if (status === 202) return 'Received; IndexNow key validation is pending. Indexing remains unverified.';
  return 'Submission failed. Investigate the response before retrying.';
}

async function main() {
  const args = process.argv.slice(2);
  let urlsPath, receiptPath, submit = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--urls' && args[i + 1]) urlsPath = args[++i];
    else if (args[i] === '--receipt' && args[i + 1]) receiptPath = args[++i];
    else if (args[i] === '--submit') submit = true;
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (!urlsPath) throw new Error('--urls requires a JSON array of changed blog URLs');
  const payload = makePayload(JSON.parse(readFileSync(urlsPath, 'utf8')),
    JSON.parse(readFileSync(new URL('./indexnow-config.json', import.meta.url), 'utf8')),
    readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8'));
  if (!submit) {
    console.log(JSON.stringify({ mode: 'dry-run', endpoint, payload, note: 'No network requests made. Submit after deployment with a private receipt path.' }, null, 2));
    return;
  }
  if (!receiptPath) throw new Error('--submit requires a new private --receipt path');
  const receipt = resolve(receiptPath);
  const inside = relative(root, receipt);
  if ((!inside.startsWith(`..`) && !isAbsolute(inside)) || existsSync(receipt)) throw new Error('Receipt must be new and outside the public website checkout');
  await verifyPublished(payload);
  const response = await fetch(endpoint, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000) });
  const result = { observedAt: new Date().toISOString(), endpoint, urls: payload.urlList,
    status: response.status, meaning: responseMeaning(response.status), response: (await response.text()).slice(0, 4000) };
  writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
  if (![200, 202].includes(response.status)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

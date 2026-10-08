import test from 'node:test';
import assert from 'node:assert/strict';
import { makePayload, verifyPublished, responseMeaning } from '../scripts/submit-indexnow.mjs';

const url = 'https://thequestsapp.com/blog/example';
const config = { host: 'thequestsapp.com', key: 'a'.repeat(32), endpoint: 'https://api.indexnow.org/indexnow' };
const sitemap = `<urlset><url><loc>${url}</loc></url></urlset>`;
const payload = makePayload([url], config, sitemap);
test('submission only includes exact canonical blog URLs and removes duplicates', () => {
  assert.deepEqual(makePayload([url, url], config, sitemap).urlList, [url]);
  for (const invalid of [url + '?x=1', url + '#title', 'http://thequestsapp.com/blog/example',
    'https://example.com/blog/example', 'https://thequestsapp.com/', 'https://thequestsapp.com/blog/missing']) {
    assert.throws(() => makePayload([invalid], config, sitemap));
  }
  assert.throws(() => makePayload([], config, sitemap));
  assert.throws(() => makePayload([url], { ...config, endpoint: 'https://example.com' }, sitemap));
});
test('publication check verifies root key and indexable canonical HTML', async () => {
  const responses = [new Response(config.key), new Response(`<link rel="canonical" href="${url}">`, { headers: { 'Content-Type': 'text/html' } })];
  await verifyPublished(payload, async () => responses.shift());
  assert.equal(responses.length, 0);
});
test('failed ownership stops before any page request', async () => {
  let calls = 0;
  await assert.rejects(verifyPublished(payload, async () => { calls++; return new Response('wrong'); }), /ownership/);
  assert.equal(calls, 1);
});
for (const [label, status, body, headers] of [
  ['redirect', 301, '', { Location: url }],
  ['wrong canonical', 200, '<link rel="canonical" href="https://example.com">', {}],
  ['noindex header', 200, `<link rel="canonical" href="${url}">`, { 'X-Robots-Tag': 'noindex' }],
  ['noindex meta', 200, `<meta name="bingbot" content="noindex"><link rel="canonical" href="${url}">`, {}]
]) test(`publication check rejects ${label}`, async () => {
  let calls = 0;
  await assert.rejects(verifyPublished(payload, async () => ++calls === 1 ? new Response(config.key) :
    new Response(body, { status, headers: { 'Content-Type': 'text/html', ...headers } })), /Publication/);
});
test('accepted and pending responses preserve indexing uncertainty', () => {
  assert.match(responseMeaning(200), /remain unverified/);
  assert.match(responseMeaning(202), /validation is pending/);
  assert.match(responseMeaning(403), /failed/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('js/clean-urls.js', root), 'utf8');
function visit(address, cleanPath, { throws = false } = {}) {
  const location = new URL(address);
  const calls = [];
  const state = { scroll: 640 };
  const history = { state, replaceState(...args) { if (throws) throw new Error('unavailable'); calls.push(args); } };
  vm.runInNewContext(source, {
    window: { location, history },
    document: { currentScript: { getAttribute: () => cleanPath } },
  });
  return { calls, state };
}

test('legacy article addresses retain the exact query, anchor and history state', () => {
  const { calls, state } = visit('https://thequestsapp.com/blog/sober-october-with-friends.html?utm_source=friend&next=%2Fq%2Fabc#how-to-join', '/blog/sober-october-with-friends');
  assert.deepEqual(calls, [[state, '', '/blog/sober-october-with-friends?utm_source=friend&next=%2Fq%2Fabc#how-to-join']]);
});

test('home and utility addresses preserve query parameters during normalization', () => {
  for (const [legacy, clean] of [['/index.html', '/'], ['/pro/success.html', '/pro/success'], ['/success.html', '/success'], ['/share.html', '/share']]) {
    const { calls, state } = visit(`https://thequestsapp.com${legacy}?session_id=test%2Bvalue#continue`, clean);
    assert.deepEqual(calls, [[state, '', `${clean}?session_id=test%2Bvalue#continue`]]);
  }
});

test('clean addresses and unmatched 404 requests keep their original address', () => {
  assert.equal(visit('https://thequestsapp.com/blog?campaign=x#article', '/blog').calls.length, 0);
  assert.equal(visit('https://thequestsapp.com/missing.html', '/404').calls.length, 0);
});

test('invite hosts and dynamic invite paths are outside normalization', () => {
  for (const address of ['https://invite.thequestsapp.com/q/kqkHT9GV', 'https://invite.thequestsapp.com/privacy.html', 'https://invite-staging.thequestsapp.com/q/demo', 'https://thequestsapp.com/q/demo', 'https://thequestsapp.com/p/demo', 'https://thequestsapp.com/subscribe?token=demo']) {
    assert.equal(visit(address, '/privacy').calls.length, 0, address);
  }
});

test('unsupported origins and history restrictions leave the loaded page usable', () => {
  assert.equal(visit('file:///privacy.html', '/privacy').calls.length, 0);
  assert.equal(visit('https://preview.example/privacy.html', '/privacy').calls.length, 0);
  assert.equal(visit('https://thequestsapp.com/privacy.html', '/privacy', { throws: true }).calls.length, 0);
});

test('every sitemap address has a static document and matching clean canonical', () => {
  const sitemap = readFileSync(new URL('sitemap.xml', root), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  assert.ok(urls.length > 25);
  for (const url of urls) {
    assert.equal(url.origin, 'https://thequestsapp.com');
    assert.ok(!url.pathname.endsWith('.html'), url.href);
    const file = new URL(url.pathname === '/' ? 'index.html' : `${url.pathname.slice(1)}.html`, root);
    assert.ok(existsSync(file), url.href);
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes(`rel="canonical" href="${url.href}"`), url.href);
    assert.ok(html.includes(`data-clean-path="${url.pathname}"`), url.href);
    for (const match of html.matchAll(/href="([^"\s]+)"/g)) {
      const target = new URL(match[1], url);
      if (target.origin !== url.origin) continue;
      assert.ok(!target.pathname.endsWith('.html'), `${url.pathname}: ${target.pathname}`);
      if (target.pathname === url.pathname || target.pathname === '/') continue;
      assert.ok(existsSync(new URL(target.pathname.slice(1), root)) || existsSync(new URL(`${target.pathname.slice(1)}.html`, root)), `${url.pathname}: ${target.pathname}`);
    }
  }
});

test('the campaign shares its clean canonical and retains every live invite destination', () => {
  const html = readFileSync(new URL('blog/sober-october-with-friends.html', root), 'utf8');
  assert.equal((html.match(/href="https:\/\/invite\.thequestsapp\.com\/q\/kqkHT9GV"/g) || []).length, 3);
  const manifest = JSON.parse(readFileSync(new URL('assets/events/sober-october-2026/manifest.json', root), 'utf8'));
  assert.equal(manifest.canonical, 'https://thequestsapp.com/blog/sober-october-with-friends');
});

test('the blog directory alias preserves query and fragment when forwarding', () => {
  const html = readFileSync(new URL('blog/index.html', root), 'utf8');
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const redirects = [];
  vm.runInNewContext(inline, { window: { location: { search: '?source=friend', hash: '#latest', replace: value => redirects.push(value) } } });
  assert.deepEqual(redirects, ['/blog?source=friend#latest']);
});

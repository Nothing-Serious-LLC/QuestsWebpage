import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/p/[[path]].js';

const code = '0123456789abcdef0123456789abcdef';
const metadata = {
  displayName: '<script>alert(1)</script>',
  revision: 2,
  avatarUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/example.png',
};

for (const scenario of ['available', 'invalid-code', 'revoked', 'malformed-metadata']) {
  test(`profile HTML applies browser security policy for ${scenario}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      if (scenario === 'revoked') return new Response('', { status: 404 });
      if (scenario === 'malformed-metadata') return new Response('invalid JSON');
      return Response.json(metadata);
    });
    const path = scenario === 'invalid-code' ? 'invalid' : code;
    const response = await onRequest({
      request: new Request(`https://invite.thequestsapp.com/p/${path}?r=2`),
      params: { path: [path] },
      env: {
        PROFILE_SHARE_SUPABASE_URL: 'https://project.supabase.co',
        PROFILE_SHARE_WEB_SECRET: 'test',
      },
    });

    assert.equal(response.status, scenario === 'available' ? 200 : 404);
    assert.match(response.headers.get('Content-Type'), /^text\/html/);
    const policy = new Map(response.headers.get('Content-Security-Policy')
      .split(';').map((directive) => directive.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]));
    assert.deepEqual(policy.get('script-src'), ["'none'"]);
    assert.deepEqual(policy.get('frame-ancestors'), ["'none'"]);
    assert.deepEqual(policy.get('object-src'), ["'none'"]);
    assert.deepEqual(policy.get('base-uri'), ["'self'"]);
    assert.ok(policy.get('img-src').includes('https://*.supabase.co'));
    assert.ok(policy.get('style-src').includes('https://fonts.googleapis.com'));
    assert.ok(policy.get('font-src').includes('https://fonts.gstatic.com'));
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(response.headers.get('Strict-Transport-Security'), /^max-age=31536000/);
    assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');

    const html = await response.text();
    assert.ok(html.includes('https://apps.apple.com/app/id6745767553'));
    assert.ok(!html.includes('<script>'));
    if (scenario === 'available') {
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
      assert.ok(html.includes(`info.nothingserious.quests://p/${code}`));
      assert.ok(html.includes(metadata.avatarUrl));
    }
  });
}

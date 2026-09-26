import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/p/[[path]].js';

const code = '0123456789abcdef0123456789abcdef';
const play = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';
for (const host of ['invite.thequestsapp.com', 'invite-staging.thequestsapp.com', 'preview.quests-invite-staging.pages.dev']) {
  for (const platform of ['Android', 'iPhone']) {
    test(`${platform} profile actions on ${host} preserve revision and environment`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => Response.json({ displayName: 'Link QA', revision: 2 }));
      const response = await onRequest({ request: new Request(`https://${host}/p/${code}?r=2`, { headers: { 'User-Agent': platform } }), params: { path: [code] }, env: { PROFILE_SHARE_SUPABASE_URL: 'https://test.supabase.co', PROFILE_SHARE_WEB_SECRET: 'test' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Vary'), 'User-Agent');
      const html = await response.text();
      assert.ok(html.includes(`https://${host}/p/${code}?r=2`));
      if (platform === 'Android') {
        assert.ok(html.includes(`href="${play}"`));
        const staging = host.includes('staging');
        assert.ok(html.includes(`intent://p/${code}?r=2#Intent;scheme=${staging ? 'quests-staging' : 'info.nothingserious.quests'};package=info.nothingserious.quests${staging ? '.staging' : ''};`));
        assert.ok(html.includes(`S.browser_fallback_url=${encodeURIComponent(play)};end`));
      } else {
        assert.ok(html.includes('href="https://apps.apple.com/app/id6745767553"'));
        assert.ok(html.includes(`href="info.nothingserious.quests://p/${code}"`));
        assert.ok(!html.includes('intent://'));
      }
    });
  }
}
for (const state of ['invalid', 'revoked']) {
  test(`Android ${state} profile offers Google Play`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
    const path = state === 'invalid' ? 'bad' : code;
    const response = await onRequest({ request: new Request(`https://invite-staging.thequestsapp.com/p/${path}`, { headers: { 'User-Agent': 'Android' } }), params: { path: [path] }, env: { PROFILE_SHARE_SUPABASE_URL: 'https://test.supabase.co', PROFILE_SHARE_WEB_SECRET: 'test' } });
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes(`href="${play}"`));
  });
}

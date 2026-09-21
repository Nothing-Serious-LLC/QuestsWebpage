import { checkCheckout } from './policy.js';
export async function onRequestPost({ request, env }) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const body = await request.json();
    if (!['validate_web', 'finish_web'].includes(body.action)) return new Response('{}', { status: 400, headers });
    const allowed = await checkCheckout(env, body.claims, body.sig, body.action, body.outcome);
    return new Response(JSON.stringify({ allowed }), { status: allowed ? 200 : 409, headers });
  } catch { return new Response('{}', { status: 503, headers }); }
}

// Local UI fixture executing the real success renderer with billing disabled.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { onRequestGet } from '../functions/subscribe.js';
const claims = { version: 2, uid: '00000000-0000-4000-8000-000000000001', attempt: '00000000-0000-4000-8000-000000000002', exp: Math.floor(Date.now()/1000)+3600, plan: 'monthly', env: 'staging', appscheme: 'quests-staging', storefront: 'USA', sig: 'a'.repeat(64) };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{"allowed":true}');
let html;
try {
  html = await (await onRequestGet({ env: { PAYMENT_BACKEND_ENVIRONMENT: 'staging' }, request: new Request('http://localhost/subscribe?' + new URLSearchParams(claims)) })).text();
} finally { globalThis.fetch = originalFetch; }
html = html.replace(/<script type="module"[^>]*><\/script>/, `<script type="module">
import { showSuccess } from '/preview-success.js';
const realTimeout = window.setTimeout;
window.setTimeout = (fn, ms) => ms === 150 ? 0 : realTimeout(fn, ms);
showSuccess();
window.setTimeout = realTimeout;
</script>`);
const client = (await readFile(new URL('../subscribe-app.js', import.meta.url),'utf8'))
  .replace(/^import .*from "https:.*;$/m, '')
  .replace(/\nrun\(\);\s*$/, '\nexport { showSuccess };\n');
createServer(async (req,res) => {
  if (req.url === '/') { res.setHeader('Content-Type','text/html'); res.end(html); return; }
  if (req.url === '/preview-success.js') { res.setHeader('Content-Type','text/javascript'); res.end(client); return; }
  if (req.url === '/subscribe-notices.js') { res.setHeader('Content-Type','text/javascript'); res.end(await readFile(new URL('../subscribe-notices.js',import.meta.url))); return; }
  if (req.url.startsWith('/subscribe/return?')) { res.setHeader('Content-Type','text/plain'); res.end('LOCAL FIXTURE: return target ' + req.url + '. No app navigation or payment.'); return; }
  res.writeHead(404); res.end();
}).listen(8996,'127.0.0.1',()=>console.log('Local success fixture http://127.0.0.1:8996 (billing and automatic navigation disabled)'));

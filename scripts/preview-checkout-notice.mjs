// Local presentation fixture. No provider calls, signed links, or payment data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { onRequestGet } from '../functions/subscribe.js';
const port = Number(process.env.CHECKOUT_PREVIEW_PORT || 8996);
const claims = { version: 2, uid: '00000000-0000-4000-8000-000000000001', attempt: '00000000-0000-4000-8000-000000000002', exp: Math.floor(Date.now()/1000)+3600, plan: 'yearly', env: 'staging', appscheme: 'quests-staging', storefront: 'USA', sig: 'a'.repeat(64) };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{"allowed":true}');
const response = await onRequestGet({ env: { PAYMENT_BACKEND_ENVIRONMENT: 'staging' }, request: new Request('http://localhost/subscribe?' + new URLSearchParams(claims)) });
let page = await response.text();
globalThis.fetch = originalFetch;
page = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const fixture = `<style>
#rc-checkout {display:block!important} .page,#loading-white {display:none!important}
.rcb-ui-root{max-width:680px;margin:auto;font-family:system-ui}
.rcb-ui-navbar{padding:28px}.rcb-main-block{padding:24px}.rcb-typography{font-size:16px;line-height:1.5}
.rcb-info-title{margin-bottom:8px}.fully-hidden{display:none!important}
.preview-fields{min-height:600px;display:flex;flex-direction:column;gap:20px}
button{min-height:48px;padding:12px;font:inherit;border-radius:12px}
.preview-label{font-size:13px;background:#fff2c9;padding:12px}
</style><script type="module">
import { createPriceNoticeEnhancer } from '/subscribe-notices.js';
const mount=document.getElementById('rc-checkout');
mount.classList.add('is-open');
mount.innerHTML=\`<div class="rcb-ui-root"><div class="preview-label">LOCAL UI FIXTURE. No payment is possible. Amounts are illustrative.</div><section class="rcb-ui-navbar"><h1>Pro Subscription (Yearly)</h1><p>Subtotal $29.99</p><p id="tax">Sales tax $2.66</p><p id="total">Total $32.65</p></section><section class="rcb-main-block"><form class="rc-checkout-form"><div class="rc-checkout-form-container"><div class="preview-fields"><button type="button" id="wallet">Simulate wallet tax update</button><p>Payment fields placeholder</p><label>Email <input type="email" value="test@example.com"></label><p>Scroll area for small screen and keyboard checks</p><button type="button" id="error">Simulate another tax update</button></div><div class="rc-checkout-price-update-info-container fully-hidden"><div class="rcb-info"><div class="rcb-info-content"><div class="rcb-info-title"><span class="rcb-typography">Price update</span></div><div class="rcb-info-message"><span class="rcb-typography">The total price was updated with tax based on your billing address. Please review and try again. Your card will only be charged once.</span></div></div></div></div><button type="button" id="confirm">Simulate confirmation</button><p id="result" role="status"></p></div></form></section></div>\`;
const update=createPriceNoticeEnhancer(mount);
new MutationObserver(update).observe(mount,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
const notice=mount.querySelector('.rc-checkout-price-update-info-container');
function mismatch(){ document.getElementById('tax').textContent='Sales tax $0.00'; document.getElementById('total').textContent='Total $29.99'; notice.classList.remove('fully-hidden'); }
document.getElementById('wallet').onclick=mismatch;
document.getElementById('error').onclick=mismatch;
document.getElementById('confirm').onclick=()=>{notice.classList.add('fully-hidden'); document.getElementById('result').textContent='Fixture confirmation complete. No payment submitted.'};
</script>`;
page = page.replace('</body>', fixture+'</body>');
createServer(async (req,res) => {
  if(req.url === '/') { res.setHeader('Content-Type','text/html'); res.end(page); return; }
  if(req.url === '/subscribe-notices.js') { res.setHeader('Content-Type','text/javascript'); res.end(await readFile(new URL('../subscribe-notices.js',import.meta.url))); return; }
  res.writeHead(404); res.end();
}).listen(port,'127.0.0.1',()=>console.log('Checkout notice preview http://127.0.0.1:'+port));

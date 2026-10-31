import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questSharePage } from '../functions/q/questPage.js';
import { onRequest as downloadRedirect } from '../functions/api/download.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4187);
const snapshotPath = process.env.QUEST_PREVIEW_SNAPSHOT;
if (!snapshotPath) throw new Error('Set QUEST_PREVIEW_SNAPSHOT to a saved public presentation JSON file.');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const types = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json' };

http.createServer(async (req,res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Preview only. Joining is disabled here.'}));return;
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/download') {
      const response = downloadRedirect({ request: new Request(url, { method: req.method, headers: req.headers }) });
      res.writeHead(response.status, Object.fromEntries(response.headers));res.end();return;
    }
    if (url.pathname === `/q/${snapshot.shareCode}`) {
      const result = questSharePage({origin:snapshot.origin,shareCode:snapshot.shareCode,presentation:snapshot.presentation,interactionMode:'phone-demo',turnstileSiteKey:null});
      let html = await result.text();
      // The renderer is the production code. Only this local wrapper labels
      // the saved snapshot and disables the external CAPTCHA script.
      html = html.replace(/<script src="https:\/\/challenges.cloudflare.com[^>]*><\/script>/g,'');
      html = html.replace('</body>','<aside style="position:fixed;bottom:8px;left:8px;z-index:20;background:white;border:1px solid #ddd;border-radius:10px;padding:8px 12px;font:12px sans-serif">Local preview · No signup is saved · <a href="/share">Download page</a> · <a href="/">Main website</a></aside></body>');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':html);return;
    }
    let relative=decodeURIComponent(url.pathname);
    let file=path.resolve(root,'.'+relative);
    if (file !== root && !file.startsWith(root+path.sep)) throw new Error('Invalid path');
    if (relative.endsWith('/')) file=path.join(file,'index.html');
    try {await stat(file);} catch {if (!path.extname(file)) file+='.html';}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/q/${snapshot.shareCode}`));

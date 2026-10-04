// Headless Chrome screenshots over the DevTools protocol (no extra packages).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2];
const ONLY = process.argv[3]?.split(',');
mkdirSync(OUT, { recursive: true });
const TOKEN = readFileSync(join(process.env.TEMP, 'demo-token.txt'), 'utf8').trim();
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

const S = 'http://localhost:5174';
const A = 'http://localhost:5175/admin';
const ids = {
  field: '19b24e8a-407a-4e5c-a78c-55af3d396285',
  year: '6a120958-a197-45e1-b70d-8acd17d187f1',
  subject: '50c23c09-51ed-4cba-a20e-865f99ccf561',
  book: '61027314-5d3f-4696-80ea-a01ddd3c5926',
  order: 'b12203e7-c434-46fc-a82c-657ed68cd956',
};
const D = { w: 1440, h: 900, m: false };
const M = { w: 390, h: 844, m: true };
const shots = [
  ['store-home', `${S}/`, D],
  ['store-home-m', `${S}/`, M],
  ['store-book', `${S}/books/${ids.book}`, D],
  ['store-book-m', `${S}/books/${ids.book}`, M],
  ['store-search-m', `${S}/search?q=${encodeURIComponent('تفسير')}`, M],
  ['store-order-m', `${S}/books/${ids.book}`, M, 'order'],
  ['store-request-m', `${S}/search?q=${encodeURIComponent('شرح العقيدة الطحاوية')}`, M, 'request'],
  ['academic-fields', `${S}/academic`, D],
  ['academic-years', `${S}/academic/${ids.field}`, D],
  ['academic-subjects', `${S}/academic/years/${ids.year}`, D],
  ['academic-subject-m', `${S}/academic/subjects/${ids.subject}`, M],
  ['admin-overview', `${A}/`, D, 'admin'],
  ['admin-overview-m', `${A}/`, M, 'admin'],
  ['admin-orders', `${A}/orders`, D, 'admin'],
  ['admin-order', `${A}/orders/${ids.order}`, D, 'admin'],
  ['admin-requests', `${A}/requests`, D, 'admin'],
  ['admin-books', `${A}/books`, D, 'admin'],
  ['admin-quickadd', `${A}/quick-add`, D, 'admin'],
  ['admin-quickadd-m', `${A}/quick-add`, M, 'admin'],
  ['admin-inventory', `${A}/inventory`, D, 'admin'],
  ['admin-academic', `${A}/academic`, D, 'admin'],
  ['admin-social', `${A}/social-content`, D, 'admin'],
  ['admin-catalog', `${A}/catalog/categories`, D, 'admin'],
];

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), 'shoot-profile-' + Date.now())}`,
  '--no-first-run', '--hide-scrollbars', '--lang=ar', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { await sleep(250); }
}
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
// Seed the admin token once on the admin origin.
await send('Page.navigate', { url: `${A}/login` });
await sleep(1500);
await evaluate(`localStorage.setItem('bayan-admin-token', ${JSON.stringify(TOKEN)}); 'ok'`);

for (const [name, url, vp, action] of shots) {
  if (ONLY && !ONLY.includes(name)) continue;
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.m ? 2 : 1.5, mobile: vp.m });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url });
  await sleep(2500);
  // Wait for images to finish loading (covers come from the CDN).
  await evaluate(`Promise.race([Promise.all([...document.images].filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r}))), new Promise(r=>setTimeout(r,6000))]).then(()=>true)`);
  if (action === 'order' || action === 'request') {
    const label = action === 'order' ? 'اطلب هذا الكتاب' : 'اطلب';
    await evaluate(`(() => { const all=[...document.querySelectorAll('button,span,a')].filter(x=>[...x.childNodes].some(n=>n.nodeType===3&&n.textContent.includes(${JSON.stringify(label)}))&&x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden').reverse(); const el=all[0]; if(!el) return false; (el.closest('button,[role=button],span')||el).click(); return true })()`);
    await sleep(3000);
  }
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log('saved', name);
}
ws.close();
chrome.kill();
process.exit(0);

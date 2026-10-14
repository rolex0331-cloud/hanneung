import puppeteer from 'puppeteer-core';
import { startServer } from '../scripts/serve.mjs';
const base = process.argv[2] || null;
const s = base ? null : await startServer(0);
const B = base || `http://127.0.0.1:${s.address().port}`;
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function shot(name, path, w, h, fn, full = false, mobile = false) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: mobile, deviceScaleFactor: 1 });
  await p.goto(B + path, { waitUntil: 'networkidle0' }); if (fn) await fn(p);
  await p.screenshot({ path: `tools/shots/${name}.png`, fullPage: full }); await p.close();
}
await shot('d-home', '/', 1280, 900, null, true);
await shot('d-quiz', '/#/daily', 1280, 900, async (p) => { await p.click('#q-opts button[data-i="1"]'); await new Promise(r=>setTimeout(r,200)); });
await shot('m-home', '/', 390, 844, null, false, true);
await shot('m-quiz', '/#/daily', 390, 844, async (p) => { await p.click('#q-opts button[data-i="0"]'); await new Promise(r=>setTimeout(r,200)); }, true, true);
await shot('d-era', '/era/goryeo/', 1280, 900, null, false);
await b.close(); s?.close(); console.log('shots done');

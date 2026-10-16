// PWA 아이콘 생성: assets/symbol.svg → icons/*.png (일반·마스커블·애플)
// 실행: node tools/make-icons.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
const svg = readFileSync('assets/symbol.svg', 'utf8');
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage();
// 일반: 투명 배경에 도장 꽉 차게. 마스커블: 바탕색 위에 안전 영역(가운데 80%) 안쪽 64%로. 애플: 바탕색, 여백 조금
const shots = [
  ['icon-192.png', 192, 'transparent', 1], ['icon-512.png', 512, 'transparent', 1],
  ['maskable-512.png', 512, '#C92A2A', 0.64], ['maskable-192.png', 192, '#C92A2A', 0.64],
  ['apple-180.png', 180, '#F7F3EA', 0.86],
];
for (const [name, size, bg, scale] of shots) {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}">${svg.replace('<svg ', `<svg width="${Math.round(size * scale)}" height="${Math.round(size * scale)}" `)}</body></html>`);
  await p.screenshot({ path: `assets/icons/${name}`, omitBackground: bg === 'transparent' });
}
await b.close();
console.log('icons ok');

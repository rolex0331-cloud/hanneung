// 배포 후 운영 사이트가 방금 빌드한 dist와 같은 빌드인지 확인 (최대 90초 재시도)
import { readFileSync } from 'node:fs';
const id = readFileSync(new URL('../dist/build.txt', import.meta.url), 'utf8').trim();
const pages = ['/', '/about/', '/schedule/', '/era/pre/'];
const deadline = Date.now() + 90000;
let bad = pages;
while (Date.now() < deadline && bad.length) {
  const res = await Promise.all(bad.map(async (p) => [p, await fetch(`https://hanneung.com${p}?v=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } }).then((r) => r.text()).catch(() => '')]));
  bad = res.filter(([, t]) => !t.includes(`<meta name="build" content="${id}">`)).map(([p]) => p);
  if (bad.length) await new Promise((r) => setTimeout(r, 5000));
}
if (bad.length) { console.error('운영 사이트가 이번 빌드와 다름:', bad.join(', '), 'build', id); process.exit(1); }
console.log('운영 반영 확인', id);

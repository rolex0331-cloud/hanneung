import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
before(() => execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { env: { ...process.env, BUILD_DATE: '2026-10-14' } }));
const walk = (d, o = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, o);
    else o.push(p);
  }
  return o;
};

test('HTML 메타와 내부 링크', () => {
  const html = walk(dist).filter((f) => f.endsWith('.html'));
  assert.ok(html.length >= 13);
  for (const f of html) {
    const s = readFileSync(f, 'utf8');
    const rel = relative(dist, f);
    assert.match(s, /<html lang="ko">/, rel);
    assert.match(s, /name="viewport"/, rel);
    assert.match(s, /<title>[^<]{4,}<\/title>/, rel);
    assert.match(s, /name="description" content="[^"]{10,}"/, rel);
    for (const m of s.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      let p = join(dist, m[1]);
      if (m[1].endsWith('/')) p = join(p, 'index.html');
      assert.ok(existsSync(p), `${rel} → ${m[1]}`);
    }
  }
});

test('sitemap URL이 모두 실제 페이지', () => {
  const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>https:\/\/hanneung\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 12);
  for (const l of locs) assert.ok(existsSync(join(dist, l, 'index.html')), l);
});

test('비밀값 형태 문자열 없음, 앱 페이지는 외부 스크립트를 직접 불러오지 않음', () => {
  const pat = /(gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  for (const f of walk(dist).filter((x) => /\.(html|js|css|txt|xml|svg)$/.test(x))) assert.doesNotMatch(readFileSync(f, 'utf8'), pat, f);
  // 외부 스크립트는 애드센스 공식 스크립트만 허용
  assert.doesNotMatch(readFileSync(join(dist, 'index.html'), 'utf8').replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d{16}" crossorigin="anonymous" data-ads="1"><\/script>/g, ''), /<script[^>]+src="https?:/);
});

test('시대별 페이지에 문항과 해설이 실제로 들어 있다', () => {
  const s = readFileSync(join(dist, 'era', 'goryeo', 'index.html'), 'utf8');
  assert.ok((s.match(/<details>/g) || []).length >= 10);
  assert.match(s, /정답과 해설/);
});

test('PWA: 매니페스트 필수 항목·아이콘 실제 크기, 서비스 워커 미리 저장 목록이 실제 파일', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const d = join(import.meta.dirname, '..', 'dist');
  const m = JSON.parse(readFileSync(join(d, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'icons', 'id']) assert.ok(m[k], k);
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/app/');
  for (const need of ['192x192', '512x512']) assert.ok(m.icons.some((i) => i.sizes === need && i.purpose === 'any'), need);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) {
    const b = readFileSync(join(d, i.src));
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20); // PNG IHDR
    assert.equal(`${w}x${h}`, i.sizes, i.src);
  }
  const sw = readFileSync(join(d, 'sw.js'), 'utf8');
  const pre = JSON.parse(sw.match(/const PRE = (\[.*\]);/)[1]);
  for (const u of pre) assert.ok(existsSync(join(d, u === '/' ? 'index.html' : u.endsWith('/') ? `${u}index.html` : u)), u);
  assert.match(sw, new RegExp(`hanneung-${readFileSync(join(d, 'build.txt'), 'utf8').trim()}`), '캐시 이름에 빌드 ID');
  assert.match(readFileSync(join(d, 'app', 'index.html'), 'utf8'), /noindex/);
  assert.match(readFileSync(join(d, '_headers'), 'utf8'), /\/sw\.js\n  Cache-Control: no-cache/);
});

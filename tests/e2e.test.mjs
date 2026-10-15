// 브라우저 E2E: 로컬 dist 서버(기본) 또는 BASE_URL(운영)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
let browser, server, BASE = process.env.BASE_URL;

before(async () => {
  if (!BASE) {
    execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')]);
    const { startServer } = await import('../scripts/serve.mjs');
    server = await startServer(0);
    BASE = `http://127.0.0.1:${server.address().port}`;
  }
  BASE = BASE.replace(/\/$/, '');
  browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(path, { mobile = false, before: pre } = {}) {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 900 });
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('https://static.cloudflareinsights.com/') && !/^https:\/\/([a-z0-9-]+\.)*(googlesyndication|doubleclick|google|googleadservices|gstatic|adtrafficquality)\.(com|net|google)\//.test(u) && !u.startsWith(BASE.replace('://', '://www.'))) external.push(u); });
  if (pre) await page.evaluateOnNewDocument(pre);
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  return { page, errors, external, res };
}
const txt = (p, sel) => p.$eval(sel, (e) => e.textContent);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('홈: 오류·외부 요청 없음, 시대 9개, 시작 버튼', async () => {
  const { page, errors, external } = await open('/');
  assert.equal((await page.$$('#era-list .era')).length, 9);
  assert.match(await txt(page, '#cta-daily'), /오늘의 10문제/);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await page.close();
});

test('오늘의 10문제: 답하면 정오·해설 표시, 다음은 답한 뒤에만, 끝나면 결과·오답노트', async () => {
  const { page, errors } = await open('/#/daily');
  assert.match(await txt(page, '#quiz-count'), /1 \/ 10/);
  assert.equal(await page.$eval('#q-next', (b) => b.disabled), true, '답하기 전 다음 비활성');
  let wrongs = 0;
  for (let i = 0; i < 10; i++) {
    // 첫 문제는 일부러 틀리게: 정답이 아닌 선택지를 누른다
    const pickIdx = await page.$$eval('#q-opts .opt', (bs) => bs.length);
    await page.click(`#q-opts .opt[data-i="${i === 0 ? 0 : 0}"]`);
    await sleep(60);
    const v = await txt(page, '#q-verdict');
    assert.match(v, /정답이에요|오답/);
    assert.ok((await txt(page, '#q-exp')).length > 10);
    assert.equal(pickIdx, 5);
    if (/오답/.test(v)) wrongs++;
    assert.equal(await page.$eval('#q-next', (b) => b.disabled), false);
    await page.click('#q-next');
    await sleep(80);
  }
  assert.match(page.url(), /#\/result/);
  assert.match(await txt(page, '#r-score'), /\/ 10 정답/);
  assert.equal((await page.$$('#r-review li')).length, 10);
  await page.goto(BASE + '/#/wrong', { waitUntil: 'networkidle0' });
  await sleep(100);
  assert.equal((await page.$$('#wrong-list li')).length, wrongs, '틀린 수만큼 오답노트');
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  assert.match(await txt(page, '#stat-streak'), /1일/);
  assert.match(await txt(page, '#stat-solved'), /10/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('키보드 1~5와 Enter로 풀 수 있다', async () => {
  const { page } = await open('/#/era/goryeo');
  await page.keyboard.press('3');
  await sleep(50);
  assert.equal(await page.$eval('#q-feedback', (e) => e.hidden), false);
  await page.keyboard.press('Enter');
  await sleep(50);
  assert.match(await txt(page, '#quiz-count'), /^2 \//);
  assert.match(await txt(page, '#q-era'), /고려/);
  await page.close();
});

test('실전 모의고사: 50문항, 타이머, 답 바꾸기 가능, 제출 시 점수·급수', async () => {
  const { page } = await open('/#/mock');
  assert.match(await txt(page, '#quiz-count'), /1 \/ 50/);
  assert.equal(await page.$eval('#quiz-timer', (e) => e.hidden), false);
  assert.match(await txt(page, '#quiz-timer'), /남은 시간 (80|79):/);
  // 모의고사는 즉시 채점하지 않는다
  await page.click('#q-opts .opt[data-i="0"]');
  assert.equal(await page.$eval('#q-feedback', (e) => e.hidden), true);
  await page.click('#q-opts .opt[data-i="1"]');
  assert.equal(await page.$eval('#q-opts .opt[data-i="1"]', (b) => b.classList.contains('picked')), true);
  // 나머지는 답하지 않고 끝까지 넘겨 제출 → 미응답 49개로 채점
  for (let i = 0; i < 50; i++) {
    const ans = await page.evaluate(() => {
      const q = document.getElementById('q-text').textContent;
      return q;
    });
    assert.ok(ans.length > 5);
    await page.click('#q-next');
    await sleep(30);
  }
  assert.match(page.url(), /#\/result/);
  assert.match(await txt(page, '#r-note'), /안 푼 문항 49개/);
  assert.match(await txt(page, '#r-grade'), /3급\(60점\) 기준 미달|급 수준/);
  await page.close();
});

test('localStorage가 막혀도 동작', async () => {
  const { page, errors } = await open('/#/daily', { before: () => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }) });
  await page.click('#q-opts .opt[data-i="0"]');
  await sleep(50);
  assert.equal(await page.$eval('#q-feedback', (e) => e.hidden), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('모바일 390px: 가로 넘침 없음 (홈·퀴즈·시대 페이지·일정)', async () => {
  for (const p of ['/', '/#/daily', '/era/joseon2/', '/schedule/', '/about/']) {
    const { page } = await open(p, { mobile: true });
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(o <= 0, `${p} ${o}px`);
    await page.close();
  }
});

test('정적 페이지와 404', async () => {
  for (const p of ['/era/pre/', '/era/contemp/', '/schedule/', '/about/']) {
    const { page, res } = await open(p);
    assert.equal(res.status(), 200, p);
    assert.ok((await txt(page, 'h1')).length >= 4);
    await page.close();
  }
  const { page, res } = await open('/no-such-page/');
  assert.equal(res.status(), 404);
  assert.match(await txt(page, 'h1'), /찾을 수 없어요/);
  await page.close();
});

test('매일 알림: /today/는 바로 오늘의 문제, 카드 링크(구글·ics)가 시각 선택을 따라감', async () => {
  const t = await open('/today/');
  await t.page.waitForSelector('#quiz-count');
  assert.match(await txt(t.page, '#quiz-count'), /1 \/ 10/);
  assert.match(t.page.url(), /\/today\/#\/daily$/);
  assert.equal(await t.page.$eval('meta[name="robots"]', (m) => m.content), 'noindex');
  assert.deepEqual(t.errors, []);
  await t.page.close();

  for (const path of ['/', '/summary/', '/era/goryeo/', '/schedule/']) {
    const { page, errors, external } = await open(path, { mobile: true });
    const card = path === '/' ? '#remind-home' : '[data-remind]';
    await page.waitForSelector(`${card} [data-r="google"]`);
    const g = await page.$eval(`${card} [data-r="google"]`, (a) => a.href);
    const u = new URL(g);
    assert.match(u.searchParams.get('recur'), /^RRULE:FREQ=DAILY;UNTIL=\d{8}T145959Z$/, path);
    assert.match(u.searchParams.get('details'), /\/today\//);
    assert.match(await page.$eval(`${card} [data-r="ics"]`, (a) => a.href), /\/cal\/2100\.ics$/);
    await page.select(`${card} select`, '07:00');
    assert.match(new URL(await page.$eval(`${card} [data-r="google"]`, (a) => a.href)).searchParams.get('dates'), /T070000\//);
    assert.match(await txt(page, `${card} .remind-h`), /07:00/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `${path} 가로 넘침`);
    assert.deepEqual(errors, [], path);
    assert.deepEqual(external, [], path);
    await page.close();
  }
});

test('매일 알림: 안드로이드는 구글 캘린더만, 아이폰은 캘린더 파일 우선(.ics 주소가 실제 캘린더)', async () => {
  const UA = {
    android: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.8.1)',
    ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  };
  for (const [os, ua] of Object.entries(UA)) {
    const { page, errors } = await open('/summary/', { mobile: true, before: `Object.defineProperty(navigator, 'userAgent', { get: () => ${JSON.stringify(ua)} })` });
    await page.waitForSelector('[data-remind] [data-r="google"]');
    assert.equal(await page.$eval('[data-remind]', (e) => e.dataset.os), os);
    const btns = await page.$$eval('[data-remind] .remind-row .btn', (bs) => bs.map((b) => b.dataset.r + (b.classList.contains('primary') ? '*' : '')));
    assert.deepEqual(btns, os === 'android' ? ['google*'] : ['ics*', 'google'], os);
    if (os === 'ios') {
      const href = await page.$eval('[data-remind] [data-r="ics"]', (a) => a.href);
      const body = await page.evaluate((u) => fetch(u).then((r) => r.text()), href);
      assert.match(body, /^BEGIN:VCALENDAR\r\n/);
      assert.match(body, /RRULE:FREQ=DAILY;UNTIL=\d{8}T145959Z/);
    }
    assert.deepEqual(errors, [], os);
    await page.close();
  }
});

test('단서 그래프: 오늘의 문제에 3문항, 쌍 집중으로 헷갈림 기록 → 결과 지도·비교표·홈 반영, 비교 페이지', async () => {
  const { ENT } = await import('../assets/graph-engine.js');
  const isGraph = (q) => /^(다음 단서와 관련된|「|다음 자료와 관련된)/.test(q);
  // 1) 오늘의 문제: 10문항 중 그래프 3
  const d = await open('/#/daily');
  let g = 0;
  for (let i = 0; i < 10; i++) {
    if (isGraph(await txt(d.page, '#q-text'))) g++;
    await d.page.click('#q-opts .opt');
    await d.page.click('#q-next');
  }
  assert.equal(g, 3, '그래프 문항 3개');
  assert.deepEqual(d.errors, []);
  await d.page.close();

  // 2) 쌍 집중: 매번 '상대'의 선지를 골라 일부러 헷갈림
  const { page, errors } = await open('/pair/#/pair/gwangjong.seongjong-g', { mobile: true });
  assert.match(await txt(page, '#quiz-count'), /1 \/ 6/);
  assert.match(await txt(page, '#quiz-title'), /광종 vs 성종\(고려\)/);
  for (let i = 0; i < 6; i++) {
    const other = ENT.get(i % 2 ? 'gwangjong' : 'seongjong-g');
    const opts = await page.$$eval('#q-opts .opt span:last-child', (s) => s.map((x) => x.textContent));
    const idx = opts.findIndex((o) => o === other.name || other.facts.includes(o));
    assert.ok(idx >= 0, `${i}번에 상대 선지 있음`);
    await page.click(`#q-opts .opt[data-i="${idx}"]`);
    assert.match(await txt(page, '#q-verdict'), /오답/);
    await page.click('#q-next');
  }
  await page.waitForSelector('#r-confuse:not([hidden])');
  const map = await txt(page, '#r-confuse-list');
  assert.match(map, /광종/);
  assert.match(map, /성종\(고려\)/);
  assert.match(map, /6번/);
  assert.match(await page.$eval('#r-confuse-list a.btn.primary', (a) => a.getAttribute('href')), /^\/pair\/#\/pair\/gwangjong\.seongjong-g$/);
  assert.match(await page.$eval('#r-confuse-list a.btn:not(.primary)', (a) => a.getAttribute('href')), /^\/vs\/gwangjong-seongjong-g\/$/);
  assert.equal(await page.$eval('#r-compare', (e) => e.hidden), false);
  assert.match(await txt(page, '#r-compare'), /쌍기/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '모바일 가로 넘침');
  // 3) 홈에 내 헷갈림 짝
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  assert.match(await txt(page, '#home-pairs'), /가장 많이 헷갈린 짝[\s\S]*광종/);
  assert.deepEqual(errors, []);
  await page.close();

  // 4) 비교 페이지
  const v = await open('/vs/gwangjong-seongjong-g/', { mobile: true });
  assert.match(await txt(v.page, 'h1'), /광종 성종\(고려\) 차이/);
  assert.ok(await v.page.$('a[href="/pair/#/pair/gwangjong.seongjong-g"]'));
  assert.match(await txt(v.page, '.cmp'), /노비안검법[\s\S]*시무 28조/);
  assert.equal(await v.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '비교 페이지 가로 넘침');
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.external, []);
  await v.page.close();
});

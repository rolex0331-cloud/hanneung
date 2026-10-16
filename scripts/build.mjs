// dist/ 생성: 앱(index), 시대별 문제·해설 페이지, 일정, 소개, 404, sitemap, robots, _headers
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, ERAS } from '../assets/questions.js';
import { EXAMS, SITE, ADS } from '../assets/config.js';
import { presentQuestion, rng, hashSeed } from '../assets/engine.js';
import { SUMMARY } from './summary-data.mjs';
import { PAIRS } from '../assets/graph.js';
import { ENT, SET, vsPath, josa } from '../assets/graph-engine.js';
import { TIMES, reminderPlan, icsText, icsPath, examEvents, icsEvent, eventIcsPath } from '../assets/remind.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const BASE = 'https://hanneung.com';
const BUILT = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const BUILD_ID = process.env.BUILD_ID || Date.now().toString(36);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// 애드센스: 게시자 ID가 있을 때만 모든 페이지 head에 확인 메타와 광고 스크립트, ads.txt를 넣는다.
const PUB = ADS.client.replace(/^ca-/, '');
const ADS_HEAD = ADS.client
  ? `
<meta name="google-adsense-account" content="${ADS.client}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.client}" crossorigin="anonymous" data-ads="1"></script>`
  : '';
const LOGO = readFileSync(join(root, 'assets', 'logo-inline.svg'), 'utf8').trim();

const HEADER = `<header class="site-header"><div class="wrap header-in">
  <a class="logo" href="/" aria-label="한능 홈">${LOGO}</a>
  <nav class="nav" aria-label="주요 메뉴"><a href="/#/daily">오늘의 문제</a><a href="/#/mock">모의고사</a><a href="/summary/">핵심 정리</a><a href="/schedule/">시험 일정</a></nav>
</div></header>`;
const FOOTER = `<footer class="site-footer"><div class="wrap">
  <p>한능의 모든 문항은 직접 제작했으며 국사편찬위원회 기출문제를 옮기지 않았습니다. 공식 기출문제는 <a href="${SITE.officialExam}" target="_blank" rel="noopener">한국사능력검정시험 홈페이지</a>에서 볼 수 있어요.</p>
  <p class="foot-links"><a href="/summary/">핵심 정리</a><a href="/era/pre/">시대별 문제</a><a href="/schedule/">시험 일정·개편</a><a href="/about/">소개·개인정보</a><a href="${SITE.contact}" target="_blank" rel="noopener">오류 제보</a></p>
</div></footer>`;

// 시대 소개 (자체 작성)
const ERA_INTRO = {
  pre: '구석기·신석기·청동기·철기 시대의 유물과 생활 모습, 고조선의 범금 8조, 부여·고구려·옥저·동예·삼한의 제천 행사와 풍속이 자주 나옵니다. 유물 하나로 시대를 판별하는 문제가 기본입니다.',
  three: '고구려 소수림왕·광개토 대왕·장수왕, 백제 근초고왕·무령왕·성왕, 신라 법흥왕·진흥왕의 업적을 구별하는 문제가 핵심입니다. 가야의 성립과 멸망, 수·당과의 전쟁도 함께 정리하세요.',
  ns: '통일 신라 신문왕의 개혁, 하대의 혼란과 호족, 원효·의상·최치원 같은 인물, 발해 무왕·문왕·선왕의 업적이 자주 출제됩니다.',
  goryeo: '태조·광종·성종의 체제 정비, 거란·여진·몽골과의 대외 관계, 무신 정권, 공민왕의 개혁이 중심입니다. 사건 순서를 묻는 문제가 많습니다.',
  joseon1: '태종·세종·세조·성종의 통치 체제 정비, 사화, 임진왜란과 병자호란, 조선의 정치 기구와 서원·성리학이 핵심입니다.',
  joseon2: '대동법·영정법·균역법 같은 수취 제도 개편, 영조·정조의 탕평 정치, 실학자, 세도 정치기의 농민 봉기와 서민 문화가 자주 나옵니다.',
  modern: '흥선 대원군의 정책과 양요, 강화도 조약, 임오군란·갑신정변·동학 농민 운동·갑오개혁, 독립 협회와 대한제국, 국권 피탈과 애국 계몽 운동을 순서대로 정리하세요.',
  colonial: '시기별 일제의 통치 방식(무단 통치·문화 통치·민족 말살 통치), 3·1 운동과 임시 정부, 무장 독립 전쟁, 의열 투쟁, 신간회와 실력 양성 운동이 핵심입니다.',
  contemp: '광복 이후 정부 수립 과정, 6·25 전쟁, 4·19 혁명부터 6월 민주 항쟁까지의 민주화 운동, 정부별 경제·통일 정책을 구별하는 문제가 많습니다.',
};

function page({ title, desc, path, body, noindex = false, remind = false, events = false }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${BASE}${path}">`}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}${path}">
<meta property="og:image" content="${BASE}/assets/og.png">
<meta name="theme-color" content="#F7F3EA">
<meta name="build" content="${BUILD_ID}">${ADS_HEAD}
<link rel="icon" href="/assets/symbol.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/assets/icons/apple-180.png">
<meta name="apple-mobile-web-app-title" content="한능">
<link rel="preload" href="/assets/fonts/pretendard-subset.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
${HEADER}
<main class="wrap doc">
${body}
${events ? '<div data-events></div>' : ''}
${remind ? '<div data-remind></div>' : ''}
</main>
${FOOTER}
${remind || events ? '<script type="module" src="/assets/remind.js"></script>' : ''}
<script type="module" src="/assets/pwa.js"></script>
</body>
</html>
`;
}

function write(rel, content) {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });

// 앱
const APP = readFileSync(join(root, 'scripts', 'index.template.html'), 'utf8').replace('{{HEADER}}', HEADER).replace('{{FOOTER}}', FOOTER).replace('<meta name="theme-color" content="#F7F3EA">', `<meta name="theme-color" content="#F7F3EA">
<meta name="build" content="${BUILD_ID}">${ADS_HEAD}`);
write('index.html', APP);
// 알림 재방문 입구: 같은 앱을 /today/ 에서 열면 바로 오늘의 문제. 이 경로의 조회 수 = 알림으로 돌아온 방문
const NOINDEX_APP = APP.replace('<link rel="canonical" href="https://hanneung.com/">', '<link rel="canonical" href="https://hanneung.com/">\n<meta name="robots" content="noindex">');
write('today/index.html', NOINDEX_APP);
// 쌍 집중 퀴즈 입구: /pair/#/pair/a.b — 이 경로의 조회 수 = 헷갈림 지도·비교 페이지에서 집중 퀴즈로 들어온 수
write('pair/index.html', NOINDEX_APP);
// PWA: 매니페스트·서비스 워커. 아이콘으로 열면 /app/ (이 경로 조회 수 = 홈 화면 아이콘으로 다시 온 방문)
write('app/index.html', NOINDEX_APP);
write(
  'manifest.webmanifest',
  JSON.stringify(
    {
      id: '/app/',
      name: '한능 — 한능검 하루 10문제',
      short_name: '한능',
      description: '한국사능력검정시험 심화 대비: 오늘의 10문제, 헷갈림 지도, 오답노트, 모의고사',
      lang: 'ko',
      start_url: '/app/',
      scope: '/',
      display: 'standalone',
      background_color: '#F7F3EA',
      theme_color: '#F7F3EA',
      icons: [
        { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/assets/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/assets/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: '오늘의 10문제', url: '/today/', icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192' }] },
        { name: '실전 모의고사', url: '/app/#/mock', icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192' }] },
      ],
    },
    null,
    2
  )
);
{
  // 앱 셸 미리 저장: 앱 화면 4개 + assets 전부(폰트 포함). HTML·JS·CSS는 네트워크 우선(배포 즉시 반영), 실패 시 저장본
  const listAssets = (dir, base) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? listAssets(join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
  const pre = ['/', '/app/', '/today/', '/pair/', '/manifest.webmanifest', ...listAssets(join(out, 'assets'), '/assets/').filter((f) => !/LICENSE|\.txt$|og\.png$/.test(f))];
  write(
    'sw.js',
    `// 한능 서비스 워커 (빌드 ${BUILD_ID}) — scripts/build.mjs가 생성
const V = 'hanneung-${BUILD_ID}';
const PRE = ${JSON.stringify(pre)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('hanneung-') && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname === '/sw.js') return;
  // 폰트·아이콘은 저장본 우선
  if (/^\\/assets\\/(fonts|icons)\\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // 나머지(HTML·JS·CSS·.ics)는 네트워크 우선, 끊기면 저장본 → 화면 이동이면 앱 셸
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match(url.pathname.startsWith('/today') ? '/today/' : '/app/') : Response.error())))
  );
});
`
  );
}
write('build.txt', `${BUILD_ID}\n`);
// 알림용 .ics (시각별). 시작일은 빌드일, 목표 시험은 빌드 시점 기준 — 시험이 지나기 전에 재배포 필요
for (const t of TIMES) write(icsPath(t).slice(1), icsText(reminderPlan(new Date(`${BUILT}T00:00:00+09:00`), t), new Date(`${BUILT}T00:00:00Z`)));
for (const ev of examEvents(new Date(`${BUILT}T00:00:00+09:00`))) write(eventIcsPath(ev).slice(1), icsEvent(ev, new Date(`${BUILT}T00:00:00Z`)));

// 시대별 페이지
const eraNav = (cur) => `<p class="hint">${ERAS.map((e) => (e.id === cur ? `<b>${e.name}</b>` : `<a href="/era/${e.id}/">${e.name}</a>`)).join(' · ')}</p>`;
for (const er of ERAS) {
  const qs = QUESTIONS.filter((q) => q.era === er.id);
  const items = qs
    .map((q) => presentQuestion(q, rng(hashSeed(`static:${q.id}`))))
    .map((q, i) => `<li class="card"><p class="rv-q">${i + 1}. ${esc(q.q)}</p><ol>${q.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ol><details><summary>정답과 해설</summary><p class="rv-a">정답: ${'①②③④⑤'[q.answer]} ${esc(q.options[q.answer])}</p><p class="rv-e">${esc(q.e)}</p></details></li>`)
    .join('');
  const body = `<h1>${er.name} 한능검 문제와 해설</h1>
<p class="lead">${ERA_INTRO[er.id]}</p>
<p class="cta"><a class="btn primary lg" href="/#/era/${er.id}">${er.name} ${qs.length}문항 풀어 보기</a><a class="btn lg" href="/#/daily">오늘의 10문제</a></p>
${eraNav(er.id)}
<h2>${er.name} 연습 문제 ${qs.length}개</h2>
<ol class="qlist">${items}</ol>
<p class="src">이 페이지의 문항은 한능이 직접 만든 연습 문제입니다. 실제 기출문제는 국사편찬위원회 홈페이지에서 확인하세요.</p>`;
  write(`era/${er.id}/index.html`, page({ title: `${er.name} 한능검 문제 ${qs.length}개와 해설 | 한능`, desc: `한국사능력검정시험 심화 대비 ${er.name} 연습 문제 ${qs.length}개와 해설. ${ERA_INTRO[er.id].slice(0, 70)}…`, path: `/era/${er.id}/`, body, remind: true }));
}

// 성적 발표·원서 접수 안내 (시험 일정 알림이 데려오는 페이지, 검색용으로도 색인)
{
  const md2 = (iso) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일`;
  const dow = (iso) => '일월화수목금토'[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const ver = EXAMS.filter((e) => e.verified);
  const resEx = ver.filter((e) => e.result && e.result >= BUILT).sort((a, b) => a.result.localeCompare(b.result))[0] || ver.filter((e) => e.result).at(-1);
  const nextEx = ver.filter((e) => e.date > (resEx?.date || BUILT)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const official = `<a href="${SITE.officialExam}" target="_blank" rel="noopener">한국사능력검정시험 공식 홈페이지</a>`;
  const rows = (e, strong) => `<div class="card cmp"><table><tbody>
<tr><th scope="row">원서 접수</th><td>${strong ? `<b>${esc(e.apply)}</b>` : esc(e.apply)}</td></tr>
${e.extra ? `<tr><th scope="row">취소 좌석</th><td>${esc(e.extra)} (잔여 좌석 한정)</td></tr>` : ''}
${e.ticket ? `<tr><th scope="row">수험표 출력</th><td>${esc(e.ticket)}</td></tr>` : ''}
<tr><th scope="row">시험일</th><td><b>${md2(e.date)}(${dow(e.date)})</b> · ${e.type}</td></tr>
${e.result ? `<tr><th scope="row">성적 발표</th><td>${md2(e.result)}(${dow(e.result)})</td></tr>` : ''}
${e.refund ? `<tr><th scope="row">응시료 환불</th><td>${esc(e.refund)}</td></tr>` : ''}
</tbody></table></div>`;
  if (resEx)
    write(
      'result/index.html',
      page({
        title: `한능검 ${resEx.round}회 성적 발표 ${md2(resEx.result)} — 성적 조회·인증서 출력, 다음 시험 일정 | 한능`,
        desc: `한국사능력검정시험 제${resEx.round}회 성적 발표일은 ${md2(resEx.result)}(${dow(resEx.result)})입니다. 성적 조회와 인증서 출력 방법, 급수 기준, 3급이 안 나왔을 때 다음 회차 일정을 정리했습니다.`,
        path: '/result/',
        events: true,
        remind: true,
        body: `<h1>한능검 ${resEx.round}회 성적 발표</h1>
<p class="lead">제${resEx.round}회(${md2(resEx.date)} 시행) 성적은 <b>${md2(resEx.result)}(${dow(resEx.result)})</b>에 발표됩니다.</p>
<h2>성적 조회·인증서 출력</h2>
<ul><li>${official}에서 직접 성적을 조회하고 인증서를 출력합니다.</li><li>인증서는 정부24에서도 출력할 수 있어요.</li><li>정답(가답안)과 이의 신청 안내도 공식 홈페이지에서 확인하세요. 한능은 기출문제와 정답을 옮겨 싣지 않습니다.</li></ul>
<h2>급수 기준 (심화)</h2>
<ul><li>1급: 80점 이상</li><li>2급: 70점 이상 80점 미만</li><li>3급: 60점 이상 70점 미만 — 2027년부터 9급 공무원 한국사 대체 기준</li></ul>
${nextEx ? `<h2>다음 시험: 제${nextEx.round}회 (${md2(nextEx.date)})</h2>\n${rows(nextEx, false)}` : ''}
<p class="cta"><a class="btn primary lg" href="/#/daily">오늘의 10문제로 다시 시작</a><a class="btn lg" href="/#/mock">실전 모의고사 50문항</a></p>
<p class="src">일정 출처: ${esc(resEx.source)}. 최종 일정은 공식 홈페이지 공지를 따릅니다.</p>`,
      })
    );
  const apEx = ver.filter((e) => e.applyOpen && e.applyOpen.slice(0, 10) >= BUILT).sort((a, b) => a.applyOpen.localeCompare(b.applyOpen))[0];
  if (apEx)
    write(
      'apply/index.html',
      page({
        title: `한능검 ${apEx.round}회 원서 접수 ${md2(apEx.applyOpen.slice(0, 10))} ${apEx.applyOpen.slice(11, 16)} — 접수 기간·취소 좌석·환불 정리 | 한능`,
        desc: `한국사능력검정시험 제${apEx.round}회 원서 접수는 ${apEx.apply}입니다. 시험일 ${md2(apEx.date)}, 취소 좌석 접수, 수험표 출력, 환불 기간과 성적 발표일을 공식 일정 기준으로 정리했습니다.`,
        path: '/apply/',
        events: true,
        remind: true,
        body: `<h1>한능검 ${apEx.round}회 원서 접수</h1>
<p class="lead">접수는 <b>${esc(apEx.apply)}</b>입니다. 응시자가 늘어 가까운 시험장은 일찍 마감될 수 있으니, 원하는 시험장이 있다면 첫날 접수를 권해요.</p>
${rows(apEx, true)}
<p>접수는 ${official}에서 합니다.</p>
<p class="cta"><a class="btn primary lg" href="/#/daily">시험까지 매일 10문제</a><a class="btn lg" href="/summary/">시대별 핵심 정리</a></p>
<p class="src">일정 출처: ${esc(apEx.source)}. 최종 일정은 공식 홈페이지 공지를 따릅니다.</p>`,
      })
    );
}

// 일정·개편
const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;
const examRows = EXAMS.filter((e) => e.verified)
  .map((e) => `<tr><td>제${e.round}회</td><td>${esc(e.apply || '')}</td><td><b>${md(e.date)}</b></td><td>${e.result ? md(e.result) : ''}</td><td>${e.type}</td></tr>`)
  .join('');
const upcoming = EXAMS.filter((e) => e.verified && (e.result || e.date) >= BUILT).sort((a, b) => a.date.localeCompare(b.date));
const nextBox = upcoming.map((nextExam) => `<h2>제${nextExam.round}회 (${md(nextExam.date)}${nextExam.date < BUILT ? ', 시험 종료' : ''})</h2>
<div class="card" style="padding:4px 16px"><table><tbody>
<tr><th scope="row">원서 접수</th><td>${esc(nextExam.apply)}</td></tr>
${nextExam.extra ? `<tr><th scope="row">취소 좌석 접수</th><td>${esc(nextExam.extra)} (잔여 좌석 한정)</td></tr>` : ''}
${nextExam.ticket ? `<tr><th scope="row">수험표 출력</th><td>${esc(nextExam.ticket)}</td></tr>` : ''}
<tr><th scope="row">시험일</th><td><b>${md(nextExam.date)}</b> (${nextExam.type})</td></tr>
${nextExam.result ? `<tr><th scope="row">성적 발표</th><td>${md(nextExam.result)} — 공식 홈페이지에서 조회·인증서 출력(정부24 출력 가능)</td></tr>` : ''}
${nextExam.refund ? `<tr><th scope="row">응시료 환불</th><td>${esc(nextExam.refund)}</td></tr>` : ''}
</tbody></table></div>`).join('\n');
const examSrc = [...new Set(EXAMS.filter((e) => e.verified).map((e) => e.source))].join(', ');
write(
  'schedule/index.html',
  page({
    title: '2026 한능검 시험일정 — 81회 접수 11/3, 성적 발표일, 2027 공무원 한국사 대체 | 한능',
    desc: '2026 한국사능력검정시험(한능검) 시험일정 77~81회 전체. 81회 원서접수 11월 3일~10일, 시험 11월 28일, 성적 발표일, 수험표 출력, 환불 기간과 2027년 9급 공무원 한국사 한능검 3급 대체를 공식 일정 기준으로 정리.',
    path: '/schedule/',
    remind: true,
    events: true,
    body: `<h1>2026 한능검 시험일정 정리</h1>
<p class="lead">일정은 국사편찬위원회 공식 사이트에서 확인한 회차만 적습니다. 접수 기간과 다음 회차는 반드시 <a href="${SITE.officialExam}" target="_blank" rel="noopener">공식 사이트</a>에서 다시 확인하세요.</p>
${nextBox}
<h2>2026년 전체 시험 일정</h2>
<div class="card" style="padding:6px 16px"><table><thead><tr><th>회차</th><th>원서 접수</th><th>시험일</th><th>성적 발표</th><th>종류</th></tr></thead><tbody>${examRows}</tbody></table></div>
<p class="src">확인 출처: ${esc(examSrc)}. 2026년 남은 회차는 심화만 시행합니다. 성적은 발표일에 공식 홈페이지에서 조회하고 인증서를 출력합니다.</p>
<h2>급수 기준 (심화)</h2>
<ul><li>1급: 80점 이상</li><li>2급: 70점 이상 80점 미만</li><li>3급: 60점 이상 70점 미만</li></ul>
<p>심화 시험은 50문항, 100점 만점이며 문항마다 배점이 다릅니다. 기본 시험(4~6급)은 별도입니다.</p>
<h2>2027년부터 9급 공무원 시험 한국사는 한능검으로</h2>
<ul>
<li>2027년 국가·지방직 9급 공채부터 필기시험에서 한국사 과목이 빠지고 <b>한국사능력검정시험 3급 이상</b>으로 대체됩니다.</li>
<li>국어·영어·전문 과목은 과목당 20문항에서 25문항으로 늘어나고, 총 100문항·110분은 그대로입니다.</li>
<li>5·7급 공채는 기존처럼 2급 이상을 요구합니다.</li>
</ul>
<p class="src">출처: 인사혁신처 발표 보도(연합뉴스, 2025-07-02), 공공포털 「한능검으로 바뀌는 9급 공채」. 응시 자격·인정 기준의 세부 사항은 인사혁신처와 각 시행 기관 공고를 확인하세요.</p>
<p class="cta"><a class="btn primary lg" href="/#/mock">실전 모의고사로 3급 수준 확인</a></p>`,
  })
);

// 시험 직전 핵심 정리
{
  const toc = SUMMARY.map((s) => `<a href="#${s.era}">${s.title}</a>`).join(' · ');
  const secs = SUMMARY.map(
    (s) => `<h2 id="${s.era}">${s.title}</h2>
<div class="card" style="padding:4px 16px"><table><tbody>${s.rows.map(([k, v]) => `<tr><th scope="row" style="white-space:nowrap">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
<p class="hint"><a href="/era/${s.era}/">${s.title} 문제와 해설 보기 →</a> · <a href="/#/era/${s.era}">바로 풀기</a></p>`
  ).join('\n');
  write(
    'summary/index.html',
    page({
      title: '한능검 시험 직전 핵심 정리 — 시대별 빈출 키워드 한 장 요약 | 한능',
      desc: '한국사능력검정시험 심화 시험 직전에 보는 시대별 핵심 정리. 왕별 업적 순서, 헷갈리는 제도 비교, 사건 연표를 표로 정리했습니다.',
      path: '/summary/',
      remind: true,
      body: `<h1>한능검 시험 직전 핵심 정리</h1>
<p class="lead">시험장 가기 전에 한 번 훑어보는 시대별 빈출 키워드입니다. 왕별 업적과 사건은 일어난 순서(→)대로 적었어요. 정리를 본 뒤에는 시대별 문제로 바로 확인해 보세요.</p>
<p class="hint">${toc}</p>
${secs}
<p class="cta"><a class="btn primary lg" href="/#/daily">오늘의 10문제로 확인</a><a class="btn lg" href="/#/mock">실전 모의고사 50문항</a></p>
<p class="src">한능이 직접 정리한 요약입니다. 연도와 세부 사항은 교과서나 공식 자료로 한 번 더 확인하세요. 오류는 <a href="${SITE.contact}" target="_blank" rel="noopener">제보 게시판</a>으로 알려 주세요.</p>`,
    })
  );
}

// 헷갈리는 짝 비교 페이지 (/vs/a-b/) — 단서 그래프에서 생성
const bareName = (n) => n.replace(/\([^)]*\)/g, '').trim();
for (const [ai, bi] of PAIRS) {
  const a = ENT.get(ai);
  const b = ENT.get(bi);
  const set = SET.get(a.set);
  const others = PAIRS.filter(([x, y]) => ENT.get(x).set === a.set && !(x === ai && y === bi))
    .map(([x, y]) => `<a href="${vsPath(x, y)}">${esc(ENT.get(x).name)} vs ${esc(ENT.get(y).name)}</a>`)
    .join(' · ');
  const col = (e) => `<td><ul>${e.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></td>`;
  const body = `<h1>${esc(a.name)} ${esc(b.name)} 차이</h1>
<p class="lead">한능검에서 자주 섞여 나오는 ${set.name} 짝입니다. 지문에 아래 <b>단서</b>가 보이면 누구인지 바로 가려낼 수 있어요. 선지에는 상대의 업적이 오답으로 섞여 나옵니다.</p>
<div class="card cmp"><table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>
<tr><th scope="row">단서</th><td>${a.clues.map(esc).join(', ')}</td><td>${b.clues.map(esc).join(', ')}</td></tr>
<tr><th scope="row">${set.noun === '왕' ? '업적' : '내용'}</th>${col(a)}${col(b)}</tr>
</tbody></table></div>
<h2>이런 자료가 나오면</h2>
<div class="card" style="padding:14px 18px"><p><b>${esc(a.name)}</b> — ${esc(a.passage)}</p><p><b>${esc(b.name)}</b> — ${esc(b.passage)}</p></div>
<p class="cta"><a class="btn primary lg" href="/pair/#/pair/${ai}.${bi}">이 둘만 6문제 풀기</a><a class="btn lg" href="/era/${a.era}/">${esc(ERAS.find((e) => e.id === a.era).name)} 문제</a></p>
${others ? `<h2>같이 헷갈리는 짝</h2><p class="hint">${others}</p>` : ''}
<p class="src">한능이 직접 정리한 비교입니다. 오류는 <a href="${SITE.contact}" target="_blank" rel="noopener">제보 게시판</a>으로 알려 주세요.</p>`;
  write(
    `vs/${ai}-${bi}/index.html`,
    page({
      title: `${bareName(a.name)} ${bareName(b.name)} 차이 — 한능검 헷갈리는 ${set.name} 비교 | 한능`,
      desc: `${josa(bareName(a.name), '과/와')} ${bareName(b.name)}, 한능검에서 헷갈리는 둘의 차이를 단서·업적 비교표로 정리했습니다. ${a.clues.slice(0, 2).join('·')} vs ${b.clues.slice(0, 2).join('·')}. 둘만 골라 6문제로 바로 확인.`,
      path: `/vs/${ai}-${bi}/`,
      body,
      remind: true,
    })
  );
}

// 블로그 재료(/kit/): 사장님 전용 — 썸네일 저장·제목/본문/태그 복사. 검색 제외(noindex + X-Robots-Tag), 메뉴·sitemap 없음
{
  const kitDir = join(root, 'tools', 'blog', 'posts');
  const posts = JSON.parse(readFileSync(join(kitDir, 'posts.json'), 'utf8'));
  const part = (txt, name) => (txt.split(`[${name}]`)[1] || '').split(/\n\[(제목|본문|태그)\]/)[0].trim();
  const cards = posts
    .map((p) => {
      const txt = readFileSync(join(kitDir, `${p.id}.txt`), 'utf8').replace(/\r\n/g, '\n');
      cpSync(join(kitDir, `${p.id}.png`), join(out, 'kit', `${p.id}.png`));
      const note = txt.startsWith('※') ? txt.split('\n')[0] : '';
      const field = (k, label, rows) => `<div class="kit-f"><div class="kit-h"><b>${label}</b><button type="button" class="btn sm primary" data-copy="${p.id}-${k}">${label} 복사</button></div><textarea id="${p.id}-${k}" rows="${rows}" readonly>${esc(part(txt, label))}</textarea></div>`;
      return `<section class="card kit${p.posted ? ' done' : ''}">
<h2>${esc(p.title)}${p.posted ? ' <span class="tag ok">올림</span>' : ''}</h2>
<p class="hint">올릴 때: <b>${esc(p.when)}</b>${note ? ` · ${esc(note.replace(/^※\s*/, ''))}` : ''}</p>
<img src="/kit/${p.id}.png" alt="${esc(p.title)} 썸네일" width="540" height="540" loading="lazy">
<p class="kit-img"><a class="btn sm" href="/kit/${p.id}.png" download="hanneung-${p.id}.png">이미지 저장</a><span class="hint">휴대폰은 이미지를 길게 눌러 저장해도 돼요</span></p>
${field('t', '제목', 2)}${field('b', '본문', 10)}${field('g', '태그', 2)}
</section>`;
    })
    .join('\n');
  write(
    'kit/index.html',
    page({
      title: '블로그 재료 | 한능',
      desc: '한능 블로그 글 재료(내부용)',
      path: '/kit/',
      noindex: true,
      body: `<h1>블로그 재료</h1>
<p class="lead">썸네일을 저장하고 제목·본문·태그를 각각 복사해 네이버 블로그에 붙여 넣으세요. 순서: 썸네일 → 제목 → 본문 → 태그 → 발행.</p>
${cards}
<script type="module" src="/assets/kit.js"></script>`,
    })
  );
}

// 소개·개인정보
write(
  'about/index.html',
  page({
    title: '한능 소개 · 문항 제작 원칙 · 개인정보 안내',
    desc: '한능의 문항 제작 원칙, 기출문제 저작권 안내, 개인정보 처리, 광고 고지, 오류 제보 방법.',
    path: '/about/',
    body: `<h1>한능 소개</h1>
<p class="lead">한능은 한국사능력검정시험 심화 3급 이상을 목표로 하는 수험생을 위한 무료 문제풀이 사이트입니다.</p>
<h2>문항 제작 원칙</h2>
<ul>
<li>모든 문항과 해설은 한능이 직접 썼습니다. 출제 범위와 자주 나오는 주제를 참고했지만 기출문제의 문장이나 자료를 옮기거나 변형하지 않았습니다.</li>
<li>국사편찬위원회가 공개한 기출문제는 공공누리 제4유형(출처 표시, 상업적 이용 금지, 변경 금지)이라 광고가 있는 이 사이트에 싣지 않습니다. 공식 기출문제는 <a href="${SITE.officialExam}" target="_blank" rel="noopener">한국사능력검정시험 홈페이지</a>와 <a href="${SITE.officialData}" target="_blank" rel="noopener">공공데이터포털</a>에서 받을 수 있어요.</li>
<li>문항에 오류가 있으면 각 문항의 「문항 오류 제보」나 <a href="${SITE.contact}" target="_blank" rel="noopener">제보 게시판</a>으로 알려 주세요. 확인 후 고칩니다.</li>
<li>모의고사 급수는 한능 문항 기준의 참고값이며 실제 시험 결과를 보장하지 않습니다.</li>
</ul>
<h2 id="privacy">개인정보 안내</h2>
<ul>
<li>회원가입이 없습니다. 푼 문제, 오답노트, 연속 학습일은 이 브라우저의 로컬 저장소(localStorage)에만 저장되며 서버로 보내지 않습니다. 브라우저의 사이트 데이터를 지우면 함께 지워집니다.</li>
<li>사이트는 Cloudflare에서 제공되며, Cloudflare는 보안과 운영을 위해 접속 기록을 처리할 수 있습니다.</li>
<li>방문 통계로 Cloudflare Web Analytics를 사용합니다. 쿠키를 쓰지 않고 페이지 조회 수, 유입 경로, 기기 종류 같은 집계 정보만 수집하며, 푼 문제나 답안은 보내지 않습니다.</li>
${ADS.client ? `<li>광고는 Google 애드센스로 게재합니다. Google을 비롯한 제3자 광고 사업자는 쿠키를 사용해 이 사이트와 다른 사이트 방문 기록을 바탕으로 광고를 보여 줄 수 있습니다. 맞춤 광고는 <a href="https://adssettings.google.com/" target="_blank" rel="noopener">Google 광고 설정</a>에서 끌 수 있으며, 자세한 내용은 <a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener">Google 광고 정책</a>에서 볼 수 있습니다. 푼 문제나 답안은 광고 사업자에게 보내지 않습니다.</li>` : '<li>광고를 사용하게 되면 이 안내를 먼저 갱신합니다. 현재는 광고를 게재하지 않습니다.</li>'}
</ul>
<h2>광고 고지</h2>
<p>한능은 무료로 운영하기 위해 앞으로 광고를 게재할 수 있습니다. 광고는 문제 화면을 가리지 않는 위치에만 두고, 광고 영역에는 "광고"라고 표시합니다.</p>`,
  })
);

write(
  '404.html',
  page({ title: '페이지를 찾을 수 없어요 | 한능', desc: '요청한 페이지가 없습니다.', path: '/404', noindex: true, body: `<h1>페이지를 찾을 수 없어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지입니다.</p><p class="cta"><a class="btn primary lg" href="/#/daily">오늘의 10문제 풀기</a><a class="btn lg" href="/">처음으로</a></p>` })
);

const urls = ['/', '/summary/', '/schedule/', '/result/', '/apply/', '/about/', ...ERAS.map((e) => `/era/${e.id}/`), ...PAIRS.map(([a, b]) => vsPath(a, b))];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${BASE}${u}</loc><lastmod>${BUILT}</lastmod></url>`).join('\n')}\n</urlset>\n`);
if (PUB) write('ads.txt', `google.com, ${PUB}, DIRECT, f08c47fec0942fa0
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
write(
  '_headers',
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*.js\n  Cache-Control: public, max-age=3600\n/assets/*.css\n  Cache-Control: public, max-age=3600\n/cal/*\n  Content-Type: text/calendar; charset=utf-8\n  Cache-Control: public, max-age=3600\n/sw.js\n  Cache-Control: no-cache\n/kit/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n  Cache-Control: public, max-age=3600\n`
);
console.log('built', readdirSync(out).join(', '));

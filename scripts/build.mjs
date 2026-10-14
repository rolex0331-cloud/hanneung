// dist/ 생성: 앱(index), 시대별 문제·해설 페이지, 일정, 소개, 404, sitemap, robots, _headers
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, ERAS } from '../assets/questions.js';
import { EXAMS, SITE } from '../assets/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const BASE = 'https://hanneung.com';
const BUILT = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LOGO = readFileSync(join(root, 'assets', 'logo-inline.svg'), 'utf8').trim();

const HEADER = `<header class="site-header"><div class="wrap header-in">
  <a class="logo" href="/" aria-label="한능 홈">${LOGO}</a>
  <nav class="nav" aria-label="주요 메뉴"><a href="/#/daily">오늘의 문제</a><a href="/#/mock">모의고사</a><a href="/schedule/">시험 일정</a></nav>
</div></header>`;
const FOOTER = `<footer class="site-footer"><div class="wrap">
  <p>한능의 모든 문항은 직접 제작했으며 국사편찬위원회 기출문제를 옮기지 않았습니다. 공식 기출문제는 <a href="${SITE.officialExam}" target="_blank" rel="noopener">한국사능력검정시험 홈페이지</a>에서 볼 수 있어요.</p>
  <p class="foot-links"><a href="/era/pre/">시대별 문제</a><a href="/schedule/">시험 일정·개편</a><a href="/about/">소개·개인정보</a><a href="${SITE.contact}" target="_blank" rel="noopener">오류 제보</a></p>
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

function page({ title, desc, path, body, noindex = false }) {
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
<link rel="icon" href="/assets/symbol.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/pretendard-subset.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
${HEADER}
<main class="wrap doc">
${body}
</main>
${FOOTER}
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
write('index.html', readFileSync(join(root, 'scripts', 'index.template.html'), 'utf8').replace('{{HEADER}}', HEADER).replace('{{FOOTER}}', FOOTER));

// 시대별 페이지
const eraNav = (cur) => `<p class="hint">${ERAS.map((e) => (e.id === cur ? `<b>${e.name}</b>` : `<a href="/era/${e.id}/">${e.name}</a>`)).join(' · ')}</p>`;
for (const er of ERAS) {
  const qs = QUESTIONS.filter((q) => q.era === er.id);
  const items = qs
    .map((q, i) => `<li class="card"><p class="rv-q">${i + 1}. ${esc(q.q)}</p><ol>${q.o.map((o) => `<li>${esc(o)}</li>`).join('')}</ol><details><summary>정답과 해설</summary><p class="rv-a">정답: ${'①②③④⑤'[q.a]} ${esc(q.o[q.a])}</p><p class="rv-e">${esc(q.e)}</p></details></li>`)
    .join('');
  const body = `<h1>${er.name} 한능검 문제와 해설</h1>
<p class="lead">${ERA_INTRO[er.id]}</p>
<p class="cta"><a class="btn primary lg" href="/#/era/${er.id}">${er.name} ${qs.length}문항 풀어 보기</a><a class="btn lg" href="/#/daily">오늘의 10문제</a></p>
${eraNav(er.id)}
<h2>${er.name} 연습 문제 ${qs.length}개</h2>
<ol class="qlist">${items}</ol>
<p class="src">이 페이지의 문항은 한능이 직접 만든 연습 문제입니다. 실제 기출문제는 국사편찬위원회 홈페이지에서 확인하세요.</p>`;
  write(`era/${er.id}/index.html`, page({ title: `${er.name} 한능검 문제 ${qs.length}개와 해설 | 한능`, desc: `한국사능력검정시험 심화 대비 ${er.name} 연습 문제 ${qs.length}개와 해설. ${ERA_INTRO[er.id].slice(0, 70)}…`, path: `/era/${er.id}/`, body }));
}

// 일정·개편
const examRows = EXAMS.filter((e) => e.verified)
  .map((e) => `<tr><td>제${e.round}회</td><td>${e.date}</td><td>${e.type}</td><td class="src">${esc(e.source)}</td></tr>`)
  .join('');
write(
  'schedule/index.html',
  page({
    title: '한능검 시험 일정과 2027 공무원 시험 한국사 대체 정리 | 한능',
    desc: '한국사능력검정시험 일정(공식 확인분)과 2027년 9급 공무원 시험 한국사 과목의 한능검 3급 대체, 급수 기준을 출처와 함께 정리했습니다.',
    path: '/schedule/',
    body: `<h1>한능검 시험 일정과 2027 개편 정리</h1>
<p class="lead">일정은 국사편찬위원회 공식 사이트에서 확인한 회차만 적습니다. 접수 기간과 다음 회차는 반드시 <a href="${SITE.officialExam}" target="_blank" rel="noopener">공식 사이트</a>에서 다시 확인하세요.</p>
<h2>확인된 시험 일정</h2>
<div class="card" style="padding:6px 16px"><table><thead><tr><th>회차</th><th>시험일</th><th>종류</th><th>확인 출처</th></tr></thead><tbody>${examRows}</tbody></table></div>
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
<li>사이트는 Cloudflare Pages에서 제공되며, Cloudflare는 보안과 운영을 위해 접속 기록을 처리할 수 있습니다.</li>
<li>방문 통계로 Cloudflare Web Analytics를 사용합니다. 쿠키를 쓰지 않고 페이지 조회 수, 유입 경로, 기기 종류 같은 집계 정보만 수집하며, 푼 문제나 답안은 보내지 않습니다.</li>
<li>광고를 사용하게 되면 이 안내를 먼저 갱신합니다. 현재는 광고를 게재하지 않습니다.</li>
</ul>
<h2>광고 고지</h2>
<p>한능은 무료로 운영하기 위해 앞으로 광고를 게재할 수 있습니다. 광고는 문제 화면을 가리지 않는 위치에만 두고, 광고 영역에는 "광고"라고 표시합니다.</p>`,
  })
);

write(
  '404.html',
  page({ title: '페이지를 찾을 수 없어요 | 한능', desc: '요청한 페이지가 없습니다.', path: '/404', noindex: true, body: `<h1>페이지를 찾을 수 없어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지입니다.</p><p class="cta"><a class="btn primary lg" href="/#/daily">오늘의 10문제 풀기</a><a class="btn lg" href="/">처음으로</a></p>` })
);

const urls = ['/', '/schedule/', '/about/', ...ERAS.map((e) => `/era/${e.id}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${BASE}${u}</loc><lastmod>${BUILT}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
write(
  '_headers',
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*.js\n  Cache-Control: public, max-age=3600\n/assets/*.css\n  Cache-Control: public, max-age=3600\n`
);
console.log('built', readdirSync(out).join(', '));

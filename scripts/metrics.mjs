// 운영 지표: Cloudflare Web Analytics(쿠키 없음)에서 hanneung.com 실제 방문만 집계한다.
// 사용: node scripts/metrics.mjs [시작일 YYYY-MM-DD] [종료일]  (기본: 최근 7일)
// 인증: 이 PC의 wrangler 로그인(OAuth) 토큰을 읽어 쓴다. 토큰은 출력·저장하지 않는다.
// 제외: 헤드리스 브라우저(우리 E2E·운영 점검), 사람 아닌 트래픽 추정치(미국발 데스크톱 첫 화면 단발 방문은 크롤러일 가능성 — 별도 표시만)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT = '5c490ad7ebb2719834b13da79cd08392';
const cfg = join(process.env.APPDATA || join(process.env.HOME || '', '.config'), 'xdg.config', '.wrangler', 'config', 'default.toml');
const token = readFileSync(cfg, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
if (!token) throw new Error('wrangler 로그인 필요: npx wrangler login');

const kst = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const end = process.argv[3] || kst(new Date());
const start = process.argv[2] || kst(new Date(Date.now() - 6 * 864e5));

const query = `{ viewer { accounts(filter:{accountTag:"${ACCOUNT}"}) {
  rows: rumPageloadEventsAdaptiveGroups(limit:5000, filter:{date_geq:"${start}", date_leq:"${end}", requestHost_like:"%hanneung.com"}) {
    count sum { visits } dimensions { date requestPath refererHost userAgentBrowser deviceType countryName }
  } } } }`;
const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
const j = await res.json();
if (j.errors) throw new Error(JSON.stringify(j.errors));
const all = j.data.viewer.accounts[0].rows;
const real = all.filter((r) => !/headless/i.test(r.dimensions.userAgentBrowser));
const kr = real.filter((r) => r.dimensions.countryName === 'KR');

const sum = (rows, f = (r) => r.count) => rows.reduce((a, r) => a + f(r), 0);
const group = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = key(r.dimensions);
    const v = m.get(k) || { pv: 0, visits: 0 };
    v.pv += r.count;
    v.visits += r.sum.visits;
    m.set(k, v);
  }
  return [...m].sort((a, b) => b[1].pv - a[1].pv);
};
const table = (title, rows) => {
  console.log(`\n## ${title}`);
  for (const [k, v] of rows) console.log(`${String(v.pv).padStart(5)} pv  ${String(v.visits).padStart(4)} 방문  ${k}`);
};

console.log(`# hanneung.com 지표 ${start} ~ ${end} (KST)`);
console.log(`전체 페이지뷰 ${sum(all)} · 헤드리스 제외 ${sum(real)} · 그중 한국 ${sum(kr)}`);
console.log(`외부 유입 방문(visits, 한국) ${sum(kr, (r) => r.sum.visits)}`);
console.log(`★ 알림 재방문(/today/ 페이지뷰, 한국) ${sum(kr.filter((r) => r.dimensions.requestPath.startsWith('/today')))}`);
const path = (p) => kr.filter((r) => r.dimensions.requestPath.startsWith(p));
const ext = (rows) => rows.filter((r) => r.dimensions.refererHost && !r.dimensions.refererHost.endsWith('hanneung.com'));
console.log(`★ 쌍 집중 퀴즈 진입(/pair/ 페이지뷰, 한국) ${sum(path('/pair'))}`);
console.log(`★ 비교 페이지(/vs/*) 페이지뷰 ${sum(path('/vs/'))} · 그중 외부 유입 ${sum(ext(path('/vs/')))} (비교: /summary/ 외부 유입 ${sum(ext(path('/summary')))})`);
table('날짜별 (한국, 헤드리스 제외)', group(kr, (d) => d.date).sort((a, b) => a[0].localeCompare(b[0])));
table('페이지별 (한국)', group(kr, (d) => d.requestPath));
table('유입 경로 (한국, 외부)', group(kr.filter((r) => r.dimensions.refererHost && !r.dimensions.refererHost.endsWith('hanneung.com')), (d) => d.refererHost));
table('기기 (한국)', group(kr, (d) => `${d.deviceType} / ${d.userAgentBrowser}`));

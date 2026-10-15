import { QUESTIONS, ERAS } from './questions.js';
import { dailyIds, buildQuiz, randomIds, summarize, streak, daysUntil } from './engine.js';
import { SITE, EXAMS, ADS, ANALYTICS } from './config.js';
import { graphItem, dailyGraphIds, pairItems, updateConfusion, topPairs, vsPath, ENT } from './graph-engine.js';
import { PAIRS } from './graph.js';

const $ = (id) => document.getElementById(id);
const KEY = 'hanneung:v1';
const eraName = (id) => (ERAS.find((e) => e.id === id) || {}).name || '';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- 저장소 (막혀 있어도 동작)
const blank = () => ({ stats: {}, wrong: [], daily: {}, confuse: {} });
let db = blank();
try {
  db = { ...blank(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) };
} catch {
  db = blank();
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* 사생활 보호 모드 등 */
  }
}
function record(id, ok) {
  const s = (db.stats[id] ||= { n: 0, c: 0 });
  s.n++;
  if (ok) s.c++;
  if (ok) db.wrong = db.wrong.filter((w) => w !== id);
  else if (!db.wrong.includes(id)) db.wrong.unshift(id);
}

// 고정 문항(QUESTIONS)과 그래프 문항(g:…)을 id 순서대로 섞어 만든다
function buildItems(ids, seed) {
  const fixed = new Map(buildQuiz(QUESTIONS, ids.filter((id) => !id.startsWith('g:')), seed).map((it) => [it.id, it]));
  return ids.map((id) => (id.startsWith('g:') ? graphItem(id, db.confuse) : fixed.get(id))).filter(Boolean);
}

// ---- 측정 (설정된 경우만, 개인정보·답안 미전송)
if (ANALYTICS.cfBeaconToken) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS.cfBeaconToken });
  document.head.appendChild(s);
}
function adSlot(el, slot) {
  if (!ADS.client || !slot || !el || el.dataset.filled) return;
  el.dataset.filled = '1';
  if (!document.querySelector('script[data-ads]')) {
    const s = document.createElement('script');
    s.async = true;
    s.dataset.ads = '1';
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.client}`;
    document.head.appendChild(s);
  }
  el.hidden = false;
  el.innerHTML = `<p class="ad-label">광고</p><ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    /* 광고 차단 등 */
  }
}

// ---- 화면 전환
const views = ['home', 'quiz', 'result', 'wrong'];
function show(name) {
  for (const v of views) $(`view-${v}`).hidden = v !== name;
  window.scrollTo(0, 0);
}

// ---- 홈
function renderHome() {
  const t = today();
  const doneDates = Object.keys(db.daily);
  const st = streak(doneDates, t);
  $('stat-streak').textContent = `${st}일`;
  $('stat-today').textContent = db.daily[t] ? `오늘 ${db.daily[t].correct}/${db.daily[t].total} 완료` : '오늘의 문제를 풀면 하루가 쌓여요';
  $('cta-daily').textContent = db.daily[t] ? '오늘의 10문제 다시 풀기' : '오늘의 10문제 풀기';
  const vals = Object.values(db.stats);
  const n = vals.reduce((a, s) => a + s.n, 0);
  const c = vals.reduce((a, s) => a + s.c, 0);
  $('stat-solved').textContent = n.toLocaleString();
  $('stat-acc').textContent = n ? `정답률 ${Math.round((c / n) * 100)}%` : '정답률 —';
  $('stat-wrong').textContent = db.wrong.length;
  const next = EXAMS.filter((e) => e.verified && e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) {
    const d = daysUntil(next.date, t);
    $('exam-dday').textContent = d === 0 ? 'D-DAY' : `D-${d}`;
    $('exam-info').innerHTML = `제${next.round}회 (${next.type}) ${Number(next.date.slice(5, 7))}월 ${Number(next.date.slice(8))}일${next.result ? ` · 발표 ${Number(next.result.slice(5, 7))}/${Number(next.result.slice(8))}` : ''}`;
  } else {
    $('exam-dday').textContent = '공고 확인';
    $('exam-info').innerHTML = `<a href="${SITE.officialExam}" target="_blank" rel="noopener">공식 일정 보기 ↗</a>`;
  }
  const mine = topPairs(db.confuse, 3);
  $('home-pairs').innerHTML = mine.length
    ? `<p class="hint">내가 가장 많이 헷갈린 짝</p><ul class="confuse card">${confuseList(mine)}</ul>`
    : `<div class="chips">${PAIRS.slice(0, 12).map(([a, b]) => `<a class="chip" href="${pairLink(a, b)}">${esc(ENT.get(a).name)} ↔ ${esc(ENT.get(b).name)}</a>`).join('')}</div>`;
  $('era-list').innerHTML = ERAS.map((er) => {
    const ids = QUESTIONS.filter((q) => q.era === er.id).map((q) => q.id);
    const tried = ids.filter((id) => db.stats[id]);
    const acc = tried.length ? Math.round((tried.reduce((a, id) => a + db.stats[id].c, 0) / tried.reduce((a, id) => a + db.stats[id].n, 0)) * 100) : null;
    return `<a class="era" href="#/era/${er.id}"><span class="era-name">${er.name}</span><span class="era-meta">${ids.length}문항 · ${acc === null ? '아직 안 풂' : `정답률 ${acc}%`}</span><span class="era-bar"><i style="width:${Math.round((tried.length / ids.length) * 100)}%"></i></span></a>`;
  }).join('');
}

// ---- 퀴즈
let S = null; // 진행 중인 세션
let timerId = null;

function start(kind) {
  const t = today();
  let ids;
  let title;
  let mode = 'study';
  let limit = 0;
  let items = null;
  if (kind === 'daily') {
    // 고정 7 + 단서 그래프 3(3·6·9번째)
    ids = dailyIds(QUESTIONS, t, 7);
    dailyGraphIds(t, 3).forEach((g, i) => ids.splice(2 + i * 3, 0, g));
    title = `오늘의 10문제 · ${Number(t.slice(5, 7))}월 ${Number(t.slice(8))}일`;
  } else if (kind === 'mock') {
    ids = randomIds(QUESTIONS, 50, `mock:${Date.now()}`);
    title = '실전 모의고사 50문항';
    mode = 'exam';
    limit = 80 * 60;
  } else if (kind === 'wrong') {
    ids = db.wrong.slice(0, 30);
    title = '오답 다시 풀기';
  } else if (kind.startsWith('pair:')) {
    const [a, b] = kind.slice(5).split('.');
    items = pairItems(a, b, Date.now());
    if (!items.length) return false;
    ids = items.map((it) => it.id);
    title = `${ENT.get(a).name} vs ${ENT.get(b).name} 집중 6문제`;
  } else if (kind.startsWith('era:')) {
    const er = kind.slice(4);
    ids = randomIds(QUESTIONS, 200, `era:${er}:${Date.now()}`, (q) => q.era === er);
    title = `${eraName(er)} 전체`;
  } else return false;
  if (!ids.length) return false;
  items ||= buildItems(ids, kind === 'daily' ? `daily-opts:${t}` : `${kind}:${Date.now()}`);
  S = { kind, title, items, answers: Array(items.length).fill(null), revealed: Array(items.length).fill(false), idx: 0, mode, limit, startedAt: Date.now() };
  show('quiz');
  $('quiz-title').textContent = title;
  clearInterval(timerId);
  $('quiz-timer').hidden = !limit;
  if (limit) {
    timerId = setInterval(tick, 1000);
    tick();
  }
  renderQ();
  return true;
}

function tick() {
  if (!S || !S.limit) return;
  const left = S.limit - Math.floor((Date.now() - S.startedAt) / 1000);
  if (left <= 0) {
    clearInterval(timerId);
    finish();
    return;
  }
  $('quiz-timer').textContent = `남은 시간 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function renderQ() {
  const it = S.items[S.idx];
  const ans = S.answers[S.idx];
  const shown = S.revealed[S.idx];
  $('quiz-count').textContent = `${S.idx + 1} / ${S.items.length}`;
  $('quiz-bar').style.width = `${((S.idx + 1) / S.items.length) * 100}%`;
  $('q-era').textContent = eraName(it.era);
  $('q-text').textContent = it.q;
  $('q-opts').innerHTML = it.options
    .map((o, i) => {
      let cls = '';
      if (shown) cls = i === it.answer ? 'right' : i === ans ? 'wrong' : 'dim';
      else if (i === ans) cls = 'picked';
      return `<li><button type="button" class="opt ${cls}" data-i="${i}" ${shown ? 'disabled' : ''} aria-pressed="${i === ans}"><span class="num">${'①②③④⑤'[i]}</span><span>${esc(o)}</span></button></li>`;
    })
    .join('');
  const fb = $('q-feedback');
  fb.hidden = !shown;
  if (shown) {
    const ok = ans === it.answer;
    $('q-verdict').textContent = ok ? '정답이에요' : `오답 · 정답은 ${'①②③④⑤'[it.answer]}`;
    $('q-verdict').className = `verdict ${ok ? 'ok' : 'no'}`;
    $('q-exp').textContent = it.e;
    $('q-report').href = `${SITE.contact}/new?title=${encodeURIComponent(`문항 오류 제보: ${it.id}`)}&body=${encodeURIComponent(`문항: ${it.q}\n\n오류 내용:\n`)}`;
  }
  $('q-prev').hidden = S.idx === 0;
  const last = S.idx === S.items.length - 1;
  const next = $('q-next');
  if (S.mode === 'exam') {
    next.textContent = last ? '제출하고 채점' : '다음';
    next.disabled = false;
  } else {
    next.textContent = last ? '결과 보기' : '다음';
    next.disabled = !shown;
  }
}

function pick(i) {
  if (!S) return;
  if (S.mode === 'study') {
    if (S.revealed[S.idx]) return;
    S.answers[S.idx] = i;
    S.revealed[S.idx] = true;
    const it = S.items[S.idx];
    record(it.id, i === it.answer);
    updateConfusion(db.confuse, it, i);
    save();
  } else {
    S.answers[S.idx] = i;
  }
  renderQ();
}

function nextQ() {
  if (!S) return;
  if (S.idx < S.items.length - 1) {
    S.idx++;
    renderQ();
    $('qcard').scrollIntoView({ block: 'start', behavior: 'smooth' });
  } else finish();
}

function finish() {
  clearInterval(timerId);
  if (!S) return;
  if (S.mode === 'exam') {
    const unanswered = S.answers.filter((a) => a === null).length;
    S.items.forEach((it, i) => {
      record(it.id, S.answers[i] === it.answer);
      if (S.answers[i] !== null) updateConfusion(db.confuse, it, S.answers[i]);
    });
    S.unanswered = unanswered;
  }
  const sum = summarize(S.items, S.answers, ERAS);
  if (S.kind === 'daily') db.daily[today()] = { correct: sum.correct, total: sum.total };
  save();
  S.summary = sum;
  if (location.hash === '#/result') renderResult();
  else location.hash = '#/result';
}

function renderResult() {
  const sum = S.summary;
  show('result');
  $('r-kind').textContent = S.title;
  $('r-score').innerHTML = `<b>${sum.correct}</b> / ${sum.total} 정답 <span>(${sum.score100}점)</span>`;
  const isMock = S.kind === 'mock';
  $('r-grade').textContent = isMock || sum.total >= 10 ? (sum.pass ? `심화 기준 ${sum.grade} 수준` : '아직 3급(60점) 기준 미달') : '';
  $('r-grade').className = `r-grade ${sum.pass ? 'ok' : 'no'}`;
  const notes = [];
  if (S.unanswered) notes.push(`안 푼 문항 ${S.unanswered}개`);
  if (sum.weakest) notes.push(`가장 약한 시대: ${sum.weakest.name} (${sum.weakest.correct}/${sum.weakest.total})`);
  notes.push('급수는 이 사이트 문항 기준의 참고값이며 실제 시험 결과와 다를 수 있어요.');
  $('r-note').textContent = notes.join(' · ');
  $('r-byera').innerHTML = sum.byEra.map((b) => `<li><span>${b.name}</span><span class="bar"><i style="width:${Math.round((b.correct / b.total) * 100)}%"></i></span><b>${b.correct}/${b.total}</b> <a href="#/era/${b.id}">이 시대 풀기</a></li>`).join('');
  $('r-review').innerHTML = S.items
    .map((it, i) => {
      const a = S.answers[i];
      const ok = a === it.answer;
      return `<li class="card rv ${ok ? 'ok' : 'no'}"><p class="rv-q"><span class="tag ${ok ? 'ok' : 'no'}">${ok ? '정답' : a === null ? '미응답' : '오답'}</span>${esc(it.q)}</p><p class="rv-a">정답 ${'①②③④⑤'[it.answer]} ${esc(it.options[it.answer])}${!ok && a !== null ? `<br><span class="mine">내 답 ${'①②③④⑤'[a]} ${esc(it.options[a])}</span>` : ''}</p><p class="rv-e">${esc(it.e)}</p></li>`;
    })
    .join('');
  renderConfuse();
  adSlot($('ad-result'), ADS.slots.result);
}

// ---- 헷갈림 지도: 고른 오답의 출처 대상으로 찾은 '헷갈리는 짝'
const pairLink = (a, b) => `/pair/#/pair/${a}.${b}`;
function confuseList(pairs) {
  return pairs
    .map((p) => {
      const vs = vsPath(p.a.id, p.b.id);
      return `<li><span class="pair"><b>${esc(p.a.name)}</b> ↔ <b>${esc(p.b.name)}</b></span><span class="cnt">${p.n}번</span><span class="acts"><a class="btn sm primary" href="${pairLink(p.a.id, p.b.id)}">이 둘만 6문제</a>${vs ? `<a class="btn sm" href="${vs}">차이표</a>` : ''}</span></li>`;
    })
    .join('');
}
function renderConfuse() {
  const top = topPairs(db.confuse, 3);
  $('r-confuse').hidden = !top.length;
  $('r-confuse-list').innerHTML = confuseList(top);
  const cmp = $('r-compare');
  if (S.kind.startsWith('pair:')) {
    const [a, b] = S.kind.slice(5).split('.').map((id) => ENT.get(id));
    cmp.hidden = false;
    cmp.innerHTML = `<div class="sec-head"><h2>${esc(a.name)} vs ${esc(b.name)} 한눈에</h2></div><div class="card cmp"><table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody><tr><th scope="row">단서</th><td>${a.clues.map(esc).join(', ')}</td><td>${b.clues.map(esc).join(', ')}</td></tr><tr><th scope="row">${a.set.endsWith('king') ? '업적' : '내용'}</th><td><ul>${a.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></td><td><ul>${b.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></td></tr></tbody></table></div>`;
  } else cmp.hidden = true;
}

// ---- 오답노트
function renderWrong() {
  show('wrong');
  const list = db.wrong
    .map((id) => {
      if (!id.startsWith('g:')) return QUESTIONS.find((q) => q.id === id);
      const g = graphItem(id);
      return g && { era: g.era, q: g.q, o: g.options, a: g.answer, e: g.e };
    })
    .filter(Boolean);
  $('wrong-empty').hidden = list.length > 0;
  $('wrong-body').hidden = list.length === 0;
  $('wrong-list').innerHTML = list
    .map((q) => `<li class="card"><p class="q-era">${eraName(q.era)}</p><p class="rv-q">${esc(q.q)}</p><details><summary>정답과 해설</summary><p class="rv-a">${esc(q.o[q.a])}</p><p class="rv-e">${esc(q.e)}</p></details></li>`)
    .join('');
}

// ---- 공유
async function share() {
  const sum = S?.summary;
  if (!sum) return;
  const st = streak(Object.keys(db.daily), today());
  const text = `${S.title} ${sum.correct}/${sum.total} 정답${S.kind === 'mock' ? ` · ${sum.score100}점 ${sum.grade}` : ''}${st > 1 ? ` · ${st}일 연속` : ''}\n한능검 하루 10문제, 한능`;
  const url = S.kind === 'daily' ? `${SITE.url}#/daily` : SITE.url;
  try {
    if (navigator.share) {
      await navigator.share({ title: '한능', text, url });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  let ok = false;
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    ok = true;
  } catch {
    ok = false;
  }
  const t = $('toast');
  t.hidden = false;
  t.textContent = ok ? '결과를 복사했어요. 친구에게 붙여 넣어 보세요.' : '복사에 실패했어요. 주소창의 링크를 직접 복사해 주세요.';
}

// ---- 라우팅
function route() {
  const h = location.hash || '#/';
  if (h === '#/' || h === '') {
    S = null;
    clearInterval(timerId);
    show('home');
    renderHome();
  } else if (h === '#/daily') start('daily');
  else if (h === '#/mock') start('mock');
  else if (h === '#/wrong') renderWrong();
  else if (h === '#/wrong-quiz') {
    if (!start('wrong')) location.hash = '#/wrong';
  } else if (h.startsWith('#/pair/')) {
    if (!start(`pair:${h.slice(7)}`)) location.hash = '#/';
  } else if (h.startsWith('#/era/')) {
    if (!start(`era:${h.slice(6)}`)) location.hash = '#/';
  } else if (h === '#/result') {
    if (S?.summary) renderResult();
    else location.hash = '#/';
  } else location.hash = '#/';
}

$('q-opts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) pick(Number(b.dataset.i));
});
$('q-next').addEventListener('click', nextQ);
$('q-prev').addEventListener('click', () => {
  if (S && S.idx > 0) {
    S.idx--;
    renderQ();
  }
});
$('r-share').addEventListener('click', share);
$('wrong-clear').addEventListener('click', () => {
  db.wrong = [];
  save();
  renderWrong();
});
document.addEventListener('keydown', (e) => {
  if ($('view-quiz').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (/^[1-5]$/.test(e.key)) pick(Number(e.key) - 1);
  else if (e.key === 'Enter' && !$('q-next').disabled) nextQ();
});
window.addEventListener('hashchange', route);
// 알림 링크(/today/)로 들어오면 바로 오늘의 문제
if (location.pathname.startsWith('/today') && (!location.hash || location.hash === '#/')) location.replace('#/daily');
else route();

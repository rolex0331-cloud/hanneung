// 단서 그래프 시제품: 고려 전기 5개 대상만으로 문항 생성·혼동 진단이 되는지 확인 (사이트에 쓰지 않음)
// 실행: node tools/proto/clue-graph-proto.mjs
import { rng, hashSeed, shuffle } from '../../assets/engine.js';

// 대상(entity) — 단서(시험 지문에 나오는 결정적 표현) — 사실(선지로 쓰이는 문장)
// fact.only: 이 대상에게만 해당하는가(true여야 다른 대상의 오답 선지로 쓸 수 있음)
const G = {
  taejo: { name: '태조(왕건)', kind: '고려 왕', clues: ['훈요 10조', '사심관', '기인 제도', '흑창', '정계·계백료서'],
    facts: [{ t: '호족과 혼인 정책을 펼쳤다.', only: true }, { t: '사심관 제도를 실시하였다.', only: true }, { t: '흑창을 설치하였다.', only: true }, { t: '북진 정책으로 서경을 중시하였다.', only: true }] },
  gwangjong: { name: '광종', kind: '고려 왕', clues: ['쌍기', '노비안검법', '광덕·준풍', '백관의 공복'],
    facts: [{ t: '노비안검법을 실시하였다.', only: true }, { t: '쌍기의 건의로 과거제를 실시하였다.', only: true }, { t: '광덕·준풍이라는 연호를 사용하였다.', only: true }, { t: '백관의 공복을 제정하였다.', only: true }] },
  seongjong: { name: '성종(고려)', kind: '고려 왕', clues: ['최승로', '시무 28조', '12목', '국자감'],
    facts: [{ t: '최승로의 시무 28조를 받아들였다.', only: true }, { t: '12목에 지방관을 파견하였다.', only: true }, { t: '국자감을 설치하였다.', only: true }, { t: '건원중보를 주조하였다.', only: true }] },
  hyeonjong: { name: '현종', kind: '고려 왕', clues: ['나주 피란', '초조대장경', '귀주 대첩', '5도 양계'],
    facts: [{ t: '거란의 2차 침입 때 나주로 피란하였다.', only: true }, { t: '초조대장경 조판을 시작하였다.', only: true }, { t: '5도 양계의 지방 제도를 정비하였다.', only: false }] },
  sukjong: { name: '숙종(고려)', kind: '고려 왕', clues: ['주전도감', '활구(은병)', '별무반', '해동통보'],
    facts: [{ t: '주전도감을 설치하고 해동통보를 만들었다.', only: true }, { t: '윤관의 건의로 별무반을 조직하였다.', only: true }] },
};
// 혼동 쌍(사전): 같은 종류·비슷한 정책 영역. 사용자 오답으로 가중치가 오른다
const PAIRS = [['gwangjong', 'seongjong'], ['taejo', 'gwangjong'], ['seongjong', 'hyeonjong'], ['hyeonjong', 'sukjong']];

// 유형 A: 단서 2개 → 대상 맞히기 (시험의 '(가) 왕' 판별 단계)
function clueToEntity(id, r) {
  const e = G[id];
  const clues = shuffle([...e.clues], r).slice(0, 2);
  const others = shuffle(Object.keys(G).filter((k) => k !== id && G[k].kind === e.kind), r).slice(0, 4);
  return { type: 'A', q: `다음 단서가 가리키는 왕은? 「${clues.join('」 「')}」`, answer: e.name, options: shuffle([id, ...others], r).map((k) => G[k].name), distractorOf: Object.fromEntries(others.map((k) => [G[k].name, k])) };
}
// 유형 B: 단서 → 그 대상의 업적 고르기 (선지 판단 단계). 오답 선지는 '혼동 상대'의 고유 사실
function clueToFact(id, r, weights) {
  const e = G[id];
  const clue = shuffle([...e.clues], r)[0];
  const right = shuffle(e.facts.filter((f) => f.only), r)[0];
  const rivals = Object.keys(G).filter((k) => k !== id).sort((a, b) => (weights[pairKey(id, b)] || 0) - (weights[pairKey(id, a)] || 0) || r() - 0.5);
  const wrong = [];
  for (const k of rivals) for (const f of shuffle(G[k].facts.filter((x) => x.only), r)) if (wrong.length < 4 && !wrong.some((w) => w.k === k)) wrong.push({ t: f.t, k });
  const opts = shuffle([{ t: right.t, k: id }, ...wrong], r);
  return { type: 'B', q: `「${clue}」(와)과 관련된 왕의 업적으로 옳은 것은?`, answer: right.t, options: opts.map((o) => o.t), distractorOf: Object.fromEntries(wrong.map((w) => [w.t, w.k])) };
}
const pairKey = (a, b) => [a, b].sort().join('|');

// 검증 1: 오답 선지가 정답 대상에게도 해당하는 경우가 없는가(only=false 사실은 선지에서 제외되는지)
// 검증 2: 생성 가능한 서로 다른 문항 수
const seen = new Set();
let bad = 0;
for (let s = 0; s < 3000; s++) {
  const r = rng(hashSeed(`p${s}`));
  for (const id of Object.keys(G)) {
    const a = clueToEntity(id, r), b = clueToFact(id, r, {});
    seen.add(a.q + [...a.options].sort().join()); seen.add(b.q + [...b.options].sort().join());
    if (b.options.filter((o) => G[id].facts.some((f) => f.t === o)).length !== 1) bad++;
    if (b.options.some((o) => G[id].facts.some((f) => f.t === o && !f.only))) bad++;
  }
}
console.log(`대상 5개·단서 ${Object.values(G).reduce((a, e) => a + e.clues.length, 0)}개·사실 ${Object.values(G).reduce((a, e) => a + e.facts.length, 0)}개 → 서로 다른 문항 ${seen.size}개, 선지 오류 ${bad}건`);

// 혼동 진단 시뮬레이션: 사용자가 광종 문제에서 성종 사실을 고름 → 다음 문항은 성종 사실이 오답 선지로 먼저 나온다
const weights = {};
const r = rng(1);
const q1 = clueToFact('gwangjong', r, weights);
const picked = q1.options.find((o) => q1.distractorOf[o] === 'seongjong') || q1.options.find((o) => o !== q1.answer);
const conf = q1.distractorOf[picked];
weights[pairKey('gwangjong', conf)] = (weights[pairKey('gwangjong', conf)] || 0) + 1;
console.log('\n[문항]', q1.q); q1.options.forEach((o, i) => console.log(` ${i + 1}. ${o}${o === q1.answer ? '  ← 정답' : `  (${G[q1.distractorOf[o]].name})`}`));
console.log(`[사용자 선택] ${picked}\n[진단] "${G.gwangjong.name}"을 "${G[conf].name}"와 헷갈림 → 쌍 가중치 ${JSON.stringify(weights)}`);
const q2 = clueToFact('gwangjong', rng(2), weights);
console.log('[다음 문항 오답 선지 출처]', q2.options.filter((o) => o !== q2.answer).map((o) => G[q2.distractorOf[o]].name).join(', '));
const qa = clueToEntity('seongjong', rng(3));
console.log('\n[단서형]', qa.q, '\n ', qa.options.join(' / '), '→ 정답', qa.answer);

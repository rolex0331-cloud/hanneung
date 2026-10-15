// 단서 그래프 출제기: 문항 id만 있으면 같은 문항을 다시 만들 수 있다(오답노트 재출제).
// id 형식: g:<유형>:<대상id>:<시드>  유형 A=단서→대상, B=단서→사실, C=자료→사실
// 모든 문항에 options별 출처 대상(src)을 붙여, 오답을 고르면 어떤 대상과 헷갈렸는지 바로 안다.
import { SETS, ENTITIES, PAIRS } from './graph.js';
import { rng, hashSeed, shuffle } from './engine.js';

export const ENT = new Map(ENTITIES.map((e) => [e.id, e]));
export const SET = new Map(SETS.map((s) => [s.id, s]));
export const pairKey = (a, b) => [a, b].sort().join('.');
const PRIOR = new Set(PAIRS.map(([a, b]) => pairKey(a, b)));

// 받침 판별(조사 선택). 괄호·따옴표·공백은 건너뛰고, 숫자는 읽는 소리 기준
const DIGIT_BATCHIM = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
export function hasBatchim(word) {
  const s = String(word).replace(/\([^)]*\)/g, '').replace(/[\s」』"'.,·~\-]+$/u, '');
  const ch = s.at(-1) || '';
  if (/\d/.test(ch)) return DIGIT_BATCHIM[ch];
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return false;
}
export const josa = (word, pair) => {
  const [a, b] = pair.split('/'); // 받침 있을 때 / 없을 때 : '과/와', '은/는', '을/를', '이/가'
  return word + (hasBatchim(word) ? a : b);
};

const members = (setId) => ENTITIES.filter((e) => e.set === setId);

// 오답 선지로 쓸 상대 대상: 혼동 가중치 → 사전 혼동 쌍 → 무작위 순으로 4개
function rivalsFor(e, rand, weights = {}, force = null) {
  const pool = shuffle(members(e.set).filter((x) => x.id !== e.id), rand);
  const score = (x) => (x.id === force ? 1e6 : 0) + (weights[pairKey(e.id, x.id)] || 0) * 10 + (PRIOR.has(pairKey(e.id, x.id)) ? 1 : 0);
  return pool.map((x, i) => ({ x, s: score(x), i })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 4).map((o) => o.x);
}

function explain(e, picked, rivals) {
  const others = rivals.map((r) => r.name).join('·');
  return `정답은 ${e.name}입니다. 핵심 단서: ${e.clues.slice(0, 3).join(', ')}. ${picked}${others ? ` 나머지 선지는 각각 ${others}에 해당하는 내용이에요.` : ''}`;
}

// 문항 생성. weights: { 'a.b': 혼동 횟수 }, force: 반드시 오답 선지에 넣을 상대(쌍 집중 퀴즈)
export function graphItem(id, weights = {}, force = null) {
  const [, type, eid, ...rest] = id.split(':');
  const e = ENT.get(eid);
  if (!e || !'ABC'.includes(type)) return null;
  const set = SET.get(e.set);
  const r = rng(hashSeed(`${id}|${rest.join(':')}`));
  const rivals = rivalsFor(e, r, weights, force);
  let q;
  let opts; // [{ t, src }]
  if (type === 'A') {
    const clues = shuffle([...e.clues], r).slice(0, 2);
    q = `다음 단서와 관련된 ${set.ask}? 「${clues.join('」 「')}」`;
    opts = [{ t: e.name, src: e.id }, ...rivals.map((x) => ({ t: x.name, src: x.id }))];
  } else {
    const right = shuffle([...e.facts], r)[0];
    opts = [{ t: right, src: e.id }, ...rivals.map((x) => ({ t: shuffle([...x.facts], r)[0], src: x.id }))];
    if (type === 'B') {
      const clue = shuffle([...e.clues], r)[0];
      q = `「${clue}」${hasBatchim(clue) ? '과' : '와'} 관련된 ${set.noun}에 대한 설명으로 옳은 것은?`;
    } else q = `다음 자료와 관련된 ${set.noun}에 대한 설명으로 옳은 것은?\n\n${e.passage}`;
  }
  const order = shuffle(opts.map((_, i) => i), r);
  const options = order.map((i) => opts[i].t);
  const src = order.map((i) => opts[i].src);
  const answer = src.indexOf(e.id);
  const e2 = explain(e, type === 'A' ? '' : `옳은 설명: ${opts[0].t}`, rivals);
  return { id, era: e.era, q, options, answer, e: e2, src, entity: e.id, graph: true };
}

// 오늘의 문제에 섞을 그래프 문항 id (날짜별 고정, 묶음이 겹치지 않게)
export function dailyGraphIds(dateISO, count = 3) {
  const r = rng(hashSeed(`gdaily:${dateISO}`));
  const sets = shuffle(SETS.map((s) => s.id), r).slice(0, count);
  const types = ['B', 'C', 'A'];
  return sets.map((sid, i) => `g:${types[i % 3]}:${shuffle(members(sid), r)[0].id}:${dateISO}`);
}

// 쌍 집중 퀴즈: 두 대상을 번갈아 정답으로, 상대를 반드시 오답 선지에
export function pairItems(a, b, seed, n = 6) {
  if (!ENT.get(a) || !ENT.get(b) || ENT.get(a).set !== ENT.get(b).set) return [];
  const types = ['B', 'C', 'A', 'B', 'C', 'B'];
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = i % 2 ? [b, a] : [a, b];
    return graphItem(`g:${types[i % types.length]}:${x}:pair-${seed}-${i}`, {}, y);
  });
}

// 고정 문항 선지 → 대상: 정확한 이름 또는 괄호를 뗀 이름이 하나뿐일 때만
const NAME = new Map();
{
  const bareCount = new Map();
  for (const e of ENTITIES) {
    const b = e.name.replace(/\([^)]*\)/g, '').trim();
    bareCount.set(b, (bareCount.get(b) || 0) + 1);
  }
  for (const e of ENTITIES) {
    NAME.set(e.name, e.id);
    const b = e.name.replace(/\([^)]*\)/g, '').trim();
    if (bareCount.get(b) === 1) NAME.set(b, e.id);
  }
  for (const [b, n] of bareCount) if (n > 1) NAME.delete(b);
}

// 혼동 기록 갱신: 오답이면 (정답 대상, 고른 선지 대상) 쌍 +1, 정답이면 함께 나온 상대와의 쌍 −0.34
// 그래프 문항은 출처(src)로, 고정 문항은 선지 이름으로 대상을 찾는다(같은 묶음끼리만)
export function updateConfusion(conf, item, picked) {
  if (!item?.options) return conf;
  const src = item.graph ? item.src : item.options.map((o) => NAME.get(o) || null);
  const me = item.graph ? item.entity : src[item.answer];
  if (!me) return conf;
  const same = (id) => id && id !== me && ENT.get(id).set === ENT.get(me).set;
  item = { ...item, src };
  if (picked !== item.answer) {
    const other = item.src[picked];
    if (same(other)) {
      const k = pairKey(me, other);
      conf[k] = Math.round(((conf[k] || 0) + 1) * 100) / 100;
    }
  } else {
    for (const other of item.src) {
      const k = pairKey(me, other);
      if (same(other) && conf[k]) {
        conf[k] = Math.max(0, Math.round((conf[k] - 0.34) * 100) / 100);
        if (!conf[k]) delete conf[k];
      }
    }
  }
  return conf;
}

export function topPairs(conf, n = 3) {
  return Object.entries(conf || {})
    .filter(([k, v]) => v >= 1 && k.split('.').every((id) => ENT.has(id)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => {
      const [a, b] = k.split('.');
      return { a: ENT.get(a), b: ENT.get(b), n: Math.round(v), key: k };
    });
}

// 비교 페이지 경로 (PAIRS 순서대로 고정)
export const vsPath = (a, b) => {
  const p = PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return p ? `/vs/${p[0]}-${p[1]}/` : null;
};

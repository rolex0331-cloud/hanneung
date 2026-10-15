import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETS, ENTITIES, PAIRS } from '../assets/graph.js';
import { graphItem, dailyGraphIds, pairItems, updateConfusion, topPairs, hasBatchim, josa, pairKey, vsPath, ENT } from '../assets/graph-engine.js';
import { ERAS } from '../assets/questions.js';

const bare = (n) => n.replace(/\([^)]*\)/g, '').replace(/ 정부$/, '').trim();

test('그래프 데이터: 형식·묶음 크기·중복 없음', () => {
  const ids = new Set();
  for (const e of ENTITIES) {
    assert.ok(!ids.has(e.id), `중복 id ${e.id}`);
    ids.add(e.id);
    assert.ok(SETS.some((s) => s.id === e.set), `${e.id} 묶음`);
    assert.ok(ERAS.some((x) => x.id === e.era), `${e.id} 시대`);
    assert.ok(e.clues.length >= 3, `${e.id} 단서 3개 이상`);
    assert.ok(e.facts.length >= 2, `${e.id} 사실 2개 이상`);
    assert.ok(e.passage.length >= 40, `${e.id} 자료`);
    for (const f of e.facts) assert.match(f, /[다]\.$|이다\.$/, `${e.id} 사실 문장 끝: ${f}`);
  }
  for (const s of SETS) assert.ok(ENTITIES.filter((e) => e.set === s.id).length >= 5, `${s.id}는 5개 이상이어야 5지선다`);
  const facts = ENTITIES.flatMap((e) => e.facts);
  assert.equal(new Set(facts).size, facts.length, '사실 문장 중복');
});

test('모호함 검사: 같은 묶음 안에서 단서는 한 대상에만, 자료에 정답 이름 없음', () => {
  const problems = [];
  for (const e of ENTITIES) {
    const peers = ENTITIES.filter((x) => x.set === e.set && x.id !== e.id);
    for (const c of e.clues) {
      for (const p of peers) {
        if (p.clues.includes(c)) problems.push(`단서 "${c}"가 ${e.id}·${p.id} 둘 다`);
        if (p.facts.some((f) => f.includes(c))) problems.push(`단서 "${c}"(${e.id})가 ${p.id}의 사실에 등장`);
        if (p.passage.includes(c)) problems.push(`단서 "${c}"(${e.id})가 ${p.id}의 자료에 등장`);
      }
    }
    if (e.passage.includes(bare(e.name))) problems.push(`${e.id} 자료에 이름 노출`);
    for (const c of e.clues) if (c.includes(bare(e.name))) problems.push(`${e.id} 단서 "${c}"에 이름 노출`);
  }
  assert.deepEqual(problems, []);
});

test('혼동 쌍: 같은 묶음, 실제 대상', () => {
  for (const [a, b] of PAIRS) {
    assert.ok(ENT.get(a) && ENT.get(b), `${a}-${b}`);
    assert.equal(ENT.get(a).set, ENT.get(b).set, `${a}-${b} 묶음`);
  }
  assert.equal(new Set(PAIRS.map(([a, b]) => pairKey(a, b))).size, PAIRS.length);
});

test('출제: 모든 대상×유형×시드 — 정답 1개, 선지 5개·중복 없음, 출처 일치, 같은 id면 같은 문항', () => {
  for (const e of ENTITIES)
    for (const t of 'ABC')
      for (let s = 0; s < 120; s++) {
        const id = `g:${t}:${e.id}:s${s}`;
        const it = graphItem(id);
        assert.equal(it.options.length, 5, id);
        assert.equal(new Set(it.options).size, 5, `${id} 선지 중복`);
        assert.equal(it.src.filter((x) => x === e.id).length, 1, `${id} 정답 출처 1개`);
        assert.equal(it.src[it.answer], e.id);
        if (t === 'A') assert.equal(it.options[it.answer], e.name);
        else assert.ok(e.facts.includes(it.options[it.answer]), `${id} 정답이 그 대상의 사실`);
        it.src.forEach((src, i) => {
          if (i === it.answer) return;
          const o = ENT.get(src);
          assert.equal(o.set, e.set, `${id} 오답은 같은 묶음`);
          assert.ok(t === 'A' ? it.options[i] === o.name : o.facts.includes(it.options[i]), `${id} 오답 출처 일치`);
          assert.ok(t === 'A' || !e.facts.includes(it.options[i]), `${id} 오답이 정답 대상에게도 해당`);
        });
        assert.deepEqual(graphItem(id), it, `${id} 재현`);
      }
  assert.equal(graphItem('g:Z:gwangjong:1'), null);
  assert.equal(graphItem('g:A:없음:1'), null);
});

test('조사: 받침에 따라 와/과', () => {
  assert.equal(hasBatchim('쌍기'), false);
  assert.equal(hasBatchim('노비안검법'), true);
  assert.equal(hasBatchim('활구(은병)'), false);
  assert.equal(hasBatchim('3·15 부정 선거'), false);
  assert.equal(hasBatchim('1915년 대구'), false);
  assert.equal(hasBatchim('한미 FTA 체결'), true);
  assert.equal(hasBatchim('6·15'), false);
  assert.equal(hasBatchim('7'), true);
  assert.equal(josa('신간회', '과/와'), '신간회와');
  assert.equal(josa('대동법', '과/와'), '대동법과');
  const it = graphItem('g:B:gwangjong:x');
  assert.match(it.q, /「[^」]+」(와|과) 관련된 왕/);
});

test('오늘의 그래프 문항: 날짜별 고정, 서로 다른 묶음 3개', () => {
  const a = dailyGraphIds('2026-10-16');
  assert.deepEqual(a, dailyGraphIds('2026-10-16'));
  assert.notDeepEqual(a, dailyGraphIds('2026-10-17'));
  assert.equal(new Set(a.map((id) => ENT.get(id.split(':')[2]).set)).size, 3);
  for (const id of a) assert.ok(graphItem(id));
});

test('쌍 집중: 두 대상이 번갈아 정답, 상대는 항상 오답 선지', () => {
  const items = pairItems('gwangjong', 'seongjong-g', 'x');
  assert.equal(items.length, 6);
  items.forEach((it, i) => {
    const [me, other] = i % 2 ? ['seongjong-g', 'gwangjong'] : ['gwangjong', 'seongjong-g'];
    assert.equal(it.entity, me);
    assert.ok(it.src.includes(other), `${i}번에 상대 선지`);
  });
  assert.deepEqual(pairItems('gwangjong', 'sejong', 'x'), [], '다른 묶음은 거부');
});

test('혼동 기록: 오답 +1(고른 선지의 출처), 정답이면 감소, 상위 쌍', () => {
  const it = graphItem('g:B:gwangjong:conf', {}, 'seongjong-g');
  const wrongIdx = it.src.indexOf('seongjong-g');
  const c = updateConfusion({}, it, wrongIdx);
  assert.deepEqual(c, { 'gwangjong.seongjong-g': 1 });
  updateConfusion(c, it, wrongIdx);
  assert.equal(c['gwangjong.seongjong-g'], 2);
  updateConfusion(c, it, it.answer);
  assert.equal(c['gwangjong.seongjong-g'], 1.66);
  assert.deepEqual(topPairs(c).map((p) => [p.a.id, p.b.id, p.n]), [['gwangjong', 'seongjong-g', 2]]);
  assert.deepEqual(updateConfusion({}, { id: 'x' }, 0), {}, '고정 문항은 기록 안 함');
  // 가중치가 높은 상대가 오답 선지에 먼저 들어간다
  const w = graphItem('g:B:sukjong-g:w', { 'gongmin.sukjong-g': 5 });
  assert.ok(w.src.includes('gongmin'));
});

test('비교 페이지 경로', () => {
  assert.equal(vsPath('seongjong-g', 'gwangjong'), '/vs/gwangjong-seongjong-g/');
  assert.equal(vsPath('gwangjong', 'sejong'), null);
});

test('고정 문항도 선지가 대상 이름이면 혼동 기록 (예: 대한 자강회 문제에서 신민회 선택)', () => {
  const it = { id: 'modern-28', options: ['보안회', '대한 자강회', '신민회', '독립 협회', '대한 광복회'], answer: 1 };
  assert.deepEqual(updateConfusion({}, it, 2), { 'jagang.sinmin': 1 });
  assert.deepEqual(updateConfusion({}, it, 4), {}, '다른 묶음(대한 광복회)은 기록 안 함');
  assert.deepEqual(updateConfusion({}, { id: 'x', options: ['가', '나'], answer: 0 }, 1), {}, '이름이 아니면 무시');
  // 괄호 없는 '성종'은 고려·조선 둘 다라 모호 → 기록 안 함, '광종'은 유일
  assert.deepEqual(updateConfusion({}, { id: 'y', options: ['광종', '성종', '태조'], answer: 0 }, 1), {});
});

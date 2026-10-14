import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, ERAS } from '../assets/questions.js';
import { dailyIds, buildQuiz, randomIds, summarize, gradeFor, streak, daysUntil, presentQuestion, rng } from '../assets/engine.js';

test('오늘의 문제: 같은 날짜면 같은 문항·순서, 날짜가 다르면 다름, 10문항·중복 없음', () => {
  const a = dailyIds(QUESTIONS, '2026-10-14');
  assert.deepEqual(a, dailyIds(QUESTIONS, '2026-10-14'));
  assert.notDeepEqual(a, dailyIds(QUESTIONS, '2026-10-15'));
  assert.equal(a.length, 10);
  assert.equal(new Set(a).size, 10);
  const eras = new Set(a.map((id) => QUESTIONS.find((q) => q.id === id).era));
  assert.equal(eras.size, 9, '9개 시대가 모두 들어간다');
  assert.deepEqual(buildQuiz(QUESTIONS, a, 'daily-opts:2026-10-14'), buildQuiz(QUESTIONS, a, 'daily-opts:2026-10-14'));
});

test('선택지를 섞어도 정답 문장이 그대로 정답 (전 문항 × 시드 50개)', () => {
  for (let s = 0; s < 50; s++) {
    const r = rng(s + 1);
    for (const q of QUESTIONS) {
      const p = presentQuestion(q, r);
      assert.equal(p.options[p.answer], q.o[q.a], q.id);
      assert.deepEqual([...p.options].sort(), [...q.o].sort());
    }
  }
});

test('섞은 뒤 정답 위치가 한쪽에 몰리지 않는다', () => {
  const counts = [0, 0, 0, 0, 0];
  for (let s = 0; s < 40; s++) for (const it of buildQuiz(QUESTIONS, QUESTIONS.map((q) => q.id), `x${s}`)) counts[it.answer]++;
  const total = counts.reduce((a, b) => a + b, 0);
  for (const c of counts) assert.ok(c / total > 0.15 && c / total < 0.25, counts.join(','));
});

test('모의고사 50문항 무작위·중복 없음, 시대 필터', () => {
  const ids = randomIds(QUESTIONS, 50, 'mock:1');
  assert.equal(ids.length, 50);
  assert.equal(new Set(ids).size, 50);
  assert.ok(randomIds(QUESTIONS, 999, 'e', (q) => q.era === 'goryeo').every((id) => id.startsWith('goryeo-')));
});

test('급수: 심화 1급 80, 2급 70, 3급 60점 이상', () => {
  assert.deepEqual(gradeFor(80), { grade: '1급', pass: true });
  assert.deepEqual(gradeFor(79), { grade: '2급', pass: true });
  assert.deepEqual(gradeFor(70), { grade: '2급', pass: true });
  assert.deepEqual(gradeFor(69), { grade: '3급', pass: true });
  assert.deepEqual(gradeFor(60), { grade: '3급', pass: true });
  assert.deepEqual(gradeFor(59), { grade: '불합격', pass: false });
});

test('채점 요약: 점수·시대별·가장 약한 시대, 미응답은 오답', () => {
  const items = buildQuiz(QUESTIONS, ['pre-01', 'pre-02', 'goryeo-01', 'goryeo-02'], 's');
  const answers = [items[0].answer, items[1].answer, (items[2].answer + 1) % 5, null];
  const s = summarize(items, answers, ERAS);
  assert.equal(s.correct, 2);
  assert.equal(s.score100, 50);
  assert.equal(s.weakest.id, 'goryeo');
  assert.equal(s.byEra.length, 2);
});

test('연속 학습일과 D-day', () => {
  assert.equal(streak(['2026-10-12', '2026-10-13', '2026-10-14'], '2026-10-14'), 3);
  assert.equal(streak(['2026-10-12', '2026-10-13'], '2026-10-14'), 2, '오늘 아직 안 풀어도 어제까지 연속 유지');
  assert.equal(streak(['2026-10-10'], '2026-10-14'), 0);
  assert.equal(daysUntil('2026-10-17', '2026-10-14'), 3);
});

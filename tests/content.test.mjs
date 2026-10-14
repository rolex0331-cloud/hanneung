import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, ERAS } from '../assets/questions.js';

test('문항 형식: 선택지 5개, 정답 범위, 해설, 시대 코드', () => {
  const eraIds = new Set(ERAS.map((e) => e.id));
  for (const q of QUESTIONS) {
    assert.ok(/^[a-z0-9]+-\d{2}$/.test(q.id), q.id);
    assert.ok(eraIds.has(q.era), `${q.id} era`);
    assert.ok(q.id.startsWith(q.era + '-'), `${q.id} 접두사와 시대 일치`);
    assert.equal(q.o.length, 5, `${q.id} 선택지 5개`);
    assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < 5, `${q.id} 정답`);
    assert.ok(q.q.length >= 10 && q.e.length >= 20, `${q.id} 문제·해설 길이`);
    assert.equal(new Set(q.o).size, 5, `${q.id} 선택지 중복 없음`);
    for (const o of q.o) assert.ok(o.trim().length > 0, `${q.id} 빈 선택지`);
  }
});

test('ID·문제 중복 없음, 시대별 10문항 이상', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  assert.equal(new Set(QUESTIONS.map((q) => q.q)).size, QUESTIONS.length);
  for (const e of ERAS) assert.ok(QUESTIONS.filter((q) => q.era === e.id).length >= 10, e.id);
  assert.ok(QUESTIONS.length >= 100);
});

test('해설에 정답의 핵심어가 들어 있다 (해설·정답 불일치 실수 탐지)', () => {
  const strip = (w) => w.replace(/(으로|하였다|였다|했다|되었다|을|를|이|가|은|는|에|의|와|과|로|다)$/u, '');
  const miss = [];
  for (const q of QUESTIONS.filter((x) => !x.o[x.a].includes('→'))) {
    const words = q.o[q.a].replace(/[().,·"~]/g, ' ').split(/\s+/).map(strip).filter((w) => w.length >= 2);
    if (!words.some((w) => q.e.includes(w))) miss.push(q.id);
  }
  assert.deepEqual(miss, [], `해설에 정답 근거가 없는 문항: ${miss.join(', ')}`);
});

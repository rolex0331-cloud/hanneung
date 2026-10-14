// 출제·채점 엔진 (DOM 없음, Node 테스트 가능)

// 문자열 → 32비트 시드
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 의사난수
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 문항 하나를 선택지 순서를 섞은 출제용 객체로 변환. 순서형 문항(→ 포함)도 섞되 정답 추적.
export function presentQuestion(q, rand) {
  const order = shuffle([0, 1, 2, 3, 4].slice(0, q.o.length), rand);
  return { id: q.id, era: q.era, q: q.q, e: q.e, options: order.map((i) => q.o[i]), answer: order.indexOf(q.a) };
}

// 오늘의 문제: 같은 날짜면 누구에게나 같은 문항·같은 선택지 순서. 시대가 고르게 섞이도록 시대별로 돌아가며 뽑는다.
export function dailyIds(questions, dateISO, count = 10) {
  const rand = rng(hashSeed(`daily:${dateISO}`));
  const byEra = new Map();
  for (const q of questions) {
    if (!byEra.has(q.era)) byEra.set(q.era, []);
    byEra.get(q.era).push(q.id);
  }
  const eras = shuffle([...byEra.keys()], rand);
  const pools = new Map(eras.map((e) => [e, shuffle(byEra.get(e), rand)]));
  const out = [];
  while (out.length < count && [...pools.values()].some((p) => p.length)) {
    for (const e of eras) {
      const p = pools.get(e);
      if (p.length && out.length < count) out.push(p.shift());
    }
  }
  return out;
}

export function buildQuiz(questions, ids, seedStr) {
  const map = new Map(questions.map((q) => [q.id, q]));
  const rand = rng(hashSeed(seedStr));
  return ids.map((id) => map.get(id)).filter(Boolean).map((q) => presentQuestion(q, rand));
}

export function randomIds(questions, count, seedStr, filter = () => true) {
  const pool = questions.filter(filter).map((q) => q.id);
  return shuffle(pool, rng(hashSeed(seedStr))).slice(0, count);
}

// 한국사능력검정시험 심화 급수 기준: 1급 80점 이상, 2급 70~79점, 3급 60~69점 (100점 만점)
export function gradeFor(score100) {
  if (score100 >= 80) return { grade: '1급', pass: true };
  if (score100 >= 70) return { grade: '2급', pass: true };
  if (score100 >= 60) return { grade: '3급', pass: true };
  return { grade: '불합격', pass: false };
}

export function summarize(items, answers, eras) {
  const total = items.length;
  const correct = items.filter((it, i) => answers[i] === it.answer).length;
  const byEra = eras
    .map((er) => {
      const idx = items.map((it, i) => (it.era === er.id ? i : -1)).filter((i) => i >= 0);
      const ok = idx.filter((i) => answers[i] === items[i].answer).length;
      return { id: er.id, name: er.name, total: idx.length, correct: ok };
    })
    .filter((x) => x.total > 0);
  const weakest = byEra.filter((x) => x.correct < x.total).sort((a, b) => a.correct / a.total - b.correct / b.total)[0] || null;
  const score100 = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, score100, byEra, weakest, ...gradeFor(score100) };
}

// 연속 학습일: 오늘의 문제를 끝낸 날짜 목록으로 계산
export function streak(doneDates, todayISO) {
  const set = new Set(doneDates);
  const day = (iso, d) => {
    const t = new Date(`${iso}T00:00:00Z`).getTime() + d * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  };
  let cur = set.has(todayISO) ? todayISO : day(todayISO, -1);
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur = day(cur, -1);
  }
  return n;
}

export function daysUntil(targetISO, todayISO) {
  return Math.round((new Date(`${targetISO}T00:00:00Z`) - new Date(`${todayISO}T00:00:00Z`)) / 86400000);
}

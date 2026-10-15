import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderPlan, googleCalUrl, icsText, TODAY_URL, platformOf, icsPath } from '../assets/remind.js';

const EX = [
  { round: 80, date: '2026-10-17', verified: true },
  { round: 81, date: '2026-11-28', verified: true },
  { round: 99, date: '2026-11-01', verified: false },
];
const at = (kst) => new Date(`${kst}+09:00`);

test('알림 기간: 그 시각 전이면 오늘부터, 지났으면 내일부터, 다음 시험 전날까지 (KST 기준)', () => {
  // 60일 안에 80·81회가 모두 있으면 더 먼 81회 전날까지
  let p = reminderPlan(at('2026-10-15T20:00:00'), '21:00', EX);
  assert.deepEqual([p.start, p.last, p.round, p.days], ['2026-10-15', '2026-11-27', 81, 44]);
  p = reminderPlan(at('2026-10-15T21:30:00'), '21:00', EX);
  assert.deepEqual([p.start, p.round], ['2026-10-16', 81]);
  // 60일 안에 시험이 하나뿐이면 그 회차
  p = reminderPlan(at('2026-10-15T20:00:00'), '21:00', [EX[0], { round: 82, date: '2027-02-20', verified: true }]);
  assert.deepEqual([p.last, p.round], ['2026-10-16', 80]);
  // 시험 당일 이후에는 다음 회차, 미확인 회차(99)는 건너뜀
  p = reminderPlan(at('2026-10-17T08:00:00'), '07:00', EX);
  assert.deepEqual([p.start, p.last, p.round, p.days], ['2026-10-18', '2026-11-27', 81, 41]);
  // 기기 시간대가 달라도 KST로 계산: UTC 15:30 = KST 다음날 00:30
  p = reminderPlan(new Date('2026-10-15T15:30:00Z'), '07:00', EX);
  assert.equal(p.start, '2026-10-16');
  // 예정된 시험이 없으면 30일
  p = reminderPlan(at('2026-12-01T10:00:00'), '21:00', EX);
  assert.deepEqual([p.round, p.days], [null, 30]);
});

test('구글 캘린더 링크: 매일 반복·KST·종료일·/today/ 링크', () => {
  const p = reminderPlan(at('2026-10-18T08:00:00'), '22:30', EX);
  const u = new URL(googleCalUrl(p));
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('dates'), '20261018T223000/20261018T224500');
  assert.equal(u.searchParams.get('ctz'), 'Asia/Seoul');
  assert.equal(u.searchParams.get('recur'), 'RRULE:FREQ=DAILY;UNTIL=20261127T145959Z');
  assert.match(u.searchParams.get('details'), /https:\/\/hanneung\.com\/today\//);
  assert.equal(TODAY_URL, 'https://hanneung.com/today/');
});

test('.ics: CRLF, 필수 항목, 알람, 시간대', () => {
  const p = reminderPlan(at('2026-10-18T06:00:00'), '07:00', EX);
  const t = icsText(p, new Date('2026-10-18T00:00:00Z'));
  assert.ok(t.includes('\r\n') && !/[^\r]\n/.test(t), 'CRLF 줄바꿈');
  for (const line of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'TZID:Asia/Seoul', 'DTSTART;TZID=Asia/Seoul:20261018T070000', 'RRULE:FREQ=DAILY;UNTIL=20261127T145959Z', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'URL:https://hanneung.com/today/', 'DTSTAMP:20261018T000000Z', 'END:VCALENDAR'])
    assert.ok(t.split('\r\n').includes(line), line);
  assert.match(t, /SUMMARY:한능 오늘의 10문제 \(81회까지\)/);
});

test('기기 구분과 .ics 경로', () => {
  assert.equal(platformOf('Mozilla/5.0 (Linux; Android 14) ... NAVER(inapp)'), 'android');
  assert.equal(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'ios', 'iPadOS 데스크톱 모드');
  assert.equal(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'desktop');
  assert.equal(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(icsPath('21:00'), '/cal/2100.ics');
});

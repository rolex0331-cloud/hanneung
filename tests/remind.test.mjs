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

import { examEvents, googleEventUrl, icsEvent, eventIcsPath } from '../assets/remind.js';
test('시험 일정 알림: 성적 발표·접수 시작, 지난 일정 제외, 링크·.ics 내용', () => {
  const EX2 = [
    { round: 80, date: '2026-10-17', result: '2026-10-30', verified: true },
    { round: 81, date: '2026-11-28', applyOpen: '2026-11-03T10:00', result: '2026-12-11', verified: true },
    { round: 99, date: '2026-11-01', result: '2026-11-10', verified: false },
  ];
  let ev = examEvents(at('2026-10-16T12:00:00'), EX2);
  assert.deepEqual(ev.map((e) => [e.key, e.date, e.time]), [['result-80', '2026-10-30', '09:00'], ['apply-81', '2026-11-03', '10:00'], ['result-81', '2026-12-11', '09:00']]);
  ev = examEvents(at('2026-10-31T08:00:00'), EX2);
  assert.deepEqual(ev.map((e) => e.key), ['apply-81', 'result-81'], '지난 발표일 제외');
  const ap = examEvents(at('2026-10-16T12:00:00'), EX2)[1];
  const u = new URL(googleEventUrl(ap));
  assert.equal(u.searchParams.get('dates'), '20261103T100000/20261103T103000');
  assert.equal(u.searchParams.get('ctz'), 'Asia/Seoul');
  assert.match(u.searchParams.get('details'), /https:\/\/hanneung\.com\/apply\//);
  const t = icsEvent(ap, new Date('2026-10-16T00:00:00Z')).split('\r\n');
  for (const l of ['DTSTART;TZID=Asia/Seoul:20261103T100000', 'TRIGGER:-PT10M', 'UID:apply-81@hanneung.com', 'URL:https://hanneung.com/apply/']) assert.ok(t.includes(l), l);
  assert.ok(!t.some((l) => l.startsWith('RRULE')), '한 번만');
  assert.equal(eventIcsPath(ap), '/cal/apply-81.ics');
});

test('앱 안 브라우저 구분과 바깥 브라우저 링크', async () => {
  const { inappKind, externalUrl } = await import('../assets/pwa.js');
  const NA = 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile NAVER(inapp; search; 2000; 12.8.1)';
  assert.equal(inappKind(NA), 'naver');
  assert.equal(inappKind('Mozilla/5.0 (iPhone) KAKAOTALK 10.8.0'), 'kakao');
  assert.equal(inappKind('Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36'), null);
  assert.equal(externalUrl('https://hanneung.com/vs/a-b/?x=1#/q', NA), 'intent://hanneung.com/vs/a-b/?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fhanneung.com%2Fvs%2Fa-b%2F%3Fx%3D1%23%2Fq;end');
  assert.equal(externalUrl('https://hanneung.com/', 'Mozilla/5.0 (iPhone) KAKAOTALK 10.8.0'), 'kakaotalk://web/openExternal?url=https%3A%2F%2Fhanneung.com%2F');
  assert.equal(externalUrl('https://hanneung.com/', 'Mozilla/5.0 (iPhone) NAVER(inapp; search)'), null, '아이폰 네이버 앱은 안내만');
  assert.equal(externalUrl('https://hanneung.com/', 'Mozilla/5.0 (Windows NT 10.0) Chrome/129'), null);
});

// 매일 학습 알림: 다음 시험 전날까지 매일 같은 시각에 울리는 캘린더 일정을 만든다.
// 서버·로그인 없이 구글 캘린더 링크와 .ics 파일(휴대폰 기본 캘린더)로 제공한다.
// 알림 속 링크는 /today/ 로 들어오게 해, 그 페이지 조회 수로 알림 재방문을 측정한다.
import { EXAMS, SITE } from './config.js';

export const TODAY_URL = new URL('/today/', SITE.url).href;
export const TIMES = ['07:00', '12:30', '19:00', '21:00', '22:30'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const compact = (iso) => iso.replace(/-/g, '');

// 한국 시간 기준 날짜 계산 (기기 시간대와 무관하게 KST로 고정)
function kstNow(now) {
  const k = new Date(now.getTime() + 9 * 3600e3);
  return { iso: `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`, hm: `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}` };
}
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 첫 알림 날짜(오늘 그 시각이 지났으면 내일)와 마지막 날짜(목표 시험 전날). 시험 정보가 없으면 30일.
export function reminderPlan(now = new Date(), hhmm = '21:00', exams = EXAMS) {
  const k = kstNow(now);
  const start = k.hm < hhmm ? k.iso : addDays(k.iso, 1);
  // 60일 안의 확인된 시험 중 가장 먼 회차까지(코앞 시험만 보고 끝나지 않게), 없으면 가장 가까운 회차
  const ahead = exams.filter((e) => e.verified && e.date > start).sort((a, b) => a.date.localeCompare(b.date));
  const exam = ahead.filter((e) => e.date <= addDays(start, 60)).pop() || ahead[0];
  const last = exam ? addDays(exam.date, -1) : addDays(start, 29);
  return { start, last, hhmm, round: exam?.round ?? null, examDate: exam?.date ?? null, days: Math.round((new Date(last) - new Date(start)) / 864e5) + 1 };
}

// RRULE UNTIL는 UTC로: 마지막 날 23:59:59 KST = 같은 날 14:59:59Z
const untilUTC = (plan) => `${compact(plan.last)}T145959Z`;
const startLocal = (plan) => `${compact(plan.start)}T${plan.hhmm.replace(':', '')}00`;
const endLocal = (plan) => {
  const [h, m] = plan.hhmm.split(':').map(Number);
  const t = h * 60 + m + 15;
  return `${compact(plan.start)}T${pad(Math.floor(t / 60) % 24)}${pad(t % 60)}00`;
};
const title = (plan) => (plan.round ? `한능 오늘의 10문제 (${plan.round}회까지)` : '한능 오늘의 10문제');
const details = () => `오늘의 10문제 풀기: ${TODAY_URL}\n틀린 문제는 오답노트에 자동으로 모여요.`;

export function googleCalUrl(plan) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: title(plan),
    details: details(),
    location: TODAY_URL,
    dates: `${startLocal(plan)}/${endLocal(plan)}`,
    ctz: 'Asia/Seoul',
    recur: `RRULE:FREQ=DAILY;UNTIL=${untilUTC(plan)}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function icsText(plan, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//hanneung.com//daily reminder//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:daily-${compact(plan.start)}-${plan.hhmm.replace(':', '')}@hanneung.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Seoul:${startLocal(plan)}`,
    'DURATION:PT15M',
    `RRULE:FREQ=DAILY;UNTIL=${untilUTC(plan)}`,
    `SUMMARY:${esc(title(plan))}`,
    `DESCRIPTION:${esc(details())}`,
    `URL:${TODAY_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${esc('오늘의 10문제 풀 시간이에요')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

const KEY = 'hanneung:remind';

// 안드로이드: 구글 캘린더 앱이 .ics를 가져오지 못하고 인앱 브라우저는 파일 받기를 막는 경우가 많아 구글 캘린더만.
// iOS: 서버의 .ics 주소(text/calendar)를 열면 바로 '캘린더에 추가' 창. 데스크톱: 둘 다.
export function platformOf(ua = '', touchPoints = 0) {
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return 'ios';
  return 'desktop';
}
export const icsPath = (hhmm) => `/cal/${hhmm.replace(':', '')}.ics`;
const md = (iso) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일`;

// [data-remind] 요소에 알림 카드를 그린다
export function mountRemind(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    /* 저장소 차단 */
  }
  const sel = TIMES.includes(saved?.hhmm) ? saved.hhmm : '21:00';
  const os = platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);
  el.classList.add('card', 'remind');
  el.dataset.os = os;
  el.innerHTML = `<p class="label">매일 알림</p>
<h3 class="remind-h"></h3>
<p class="hint remind-sub"></p>
<div class="remind-row">
  <label class="remind-time">알림 시각 <select aria-label="알림 시각">${TIMES.map((t) => `<option${t === sel ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
  ${os === 'ios' ? '<a class="btn primary" data-r="ics">아이폰 캘린더에 추가</a><a class="btn" data-r="google" target="_blank" rel="noopener">구글 캘린더에 추가</a>' : `<a class="btn primary" data-r="google" target="_blank" rel="noopener">구글 캘린더에 추가</a>${os === 'desktop' ? '<a class="btn" data-r="ics" download="hanneung-daily.ics">캘린더 파일(.ics) 받기</a>' : ''}`}
</div>
<p class="hint remind-done" hidden></p>`;
  const s = el.querySelector('select');
  const g = el.querySelector('[data-r="google"]');
  const f = el.querySelector('[data-r="ics"]');
  const done = el.querySelector('.remind-done');
  const update = () => {
    const plan = reminderPlan(new Date(), s.value);
    el.querySelector('.remind-h').textContent = plan.round ? `${plan.round}회(${md(plan.examDate)}) 시험 전날까지, 매일 ${s.value}에 10문제` : `매일 ${s.value}에 10문제`;
    el.querySelector('.remind-sub').textContent = `${md(plan.start)}부터 ${md(plan.last)}까지 ${plan.days}일 동안 캘린더 알림이 울려요. 알림을 누르면 바로 오늘의 문제로 들어옵니다. 로그인·개인정보 입력 없음, 캘린더에서 언제든 지울 수 있어요.`;
    g.href = googleCalUrl(plan);
    if (f) f.href = icsPath(s.value);
  };
  const mark = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ hhmm: s.value, at: new Date().toISOString() }));
    } catch {
      /* 무시 */
    }
    done.hidden = false;
    done.textContent = os === 'ios' ? '열린 창에서 "추가"를 눌러야 등록돼요.' : '구글 캘린더 화면에서 "저장"을 눌러야 등록돼요. 구글 로그인이 필요해요.';
  };
  s.addEventListener('change', update);
  g.addEventListener('click', mark);
  f?.addEventListener('click', mark);
  update();
  if (saved?.at) {
    done.hidden = false;
    done.textContent = `${md(kstNow(new Date(saved.at)).iso)}에 알림 추가를 눌렀어요. 시각을 바꾸려면 캘린더에서 이전 일정을 지우고 다시 추가하세요.`;
  }
}

// ---- 시험 일정 알림(한 번): 성적 발표일, 다음 회차 원서 접수 시작. 알림 링크는 /result/·/apply/ 안내 페이지
export const RESULT_URL = new URL('/result/', SITE.url).href;
export const APPLY_URL = new URL('/apply/', SITE.url).href;
export function examEvents(now = new Date(), exams = EXAMS) {
  const k = kstNow(now);
  const out = [];
  for (const e of exams.filter((x) => x.verified)) {
    if (e.result && e.result >= k.iso && e.date <= addDays(k.iso, 60))
      out.push({ key: `result-${e.round}`, round: e.round, kind: 'result', date: e.result, time: '09:00', alarm: 0, title: `한능검 ${e.round}회 성적 발표일`, label: `${e.round}회 성적 발표`, url: RESULT_URL,
        note: `오늘 ${e.round}회 성적이 발표돼요. 한능에서 조회 방법과 다음 시험 일정을 확인하세요.` });
    if (e.applyOpen && e.applyOpen.slice(0, 10) >= k.iso)
      out.push({ key: `apply-${e.round}`, round: e.round, kind: 'apply', date: e.applyOpen.slice(0, 10), time: e.applyOpen.slice(11, 16), alarm: 10, title: `한능검 ${e.round}회 원서 접수 시작 (${e.applyOpen.slice(11, 16)})`, label: `${e.round}회 접수 시작`, url: APPLY_URL,
        note: `${e.round}회 원서 접수가 ${e.applyOpen.slice(11, 16)}에 시작돼요. 원하는 시험장은 일찍 마감될 수 있어요.` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const evStart = (ev) => `${compact(ev.date)}T${ev.time.replace(':', '')}00`;
const evEnd = (ev) => {
  const [h, m] = ev.time.split(':').map(Number);
  const t = h * 60 + m + 30;
  return `${compact(ev.date)}T${pad(Math.floor(t / 60) % 24)}${pad(t % 60)}00`;
};
export function googleEventUrl(ev) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, details: `${ev.note}\n${ev.url}`, location: ev.url, dates: `${evStart(ev)}/${evEnd(ev)}`, ctz: 'Asia/Seoul' });
  return `https://calendar.google.com/calendar/render?${q}`;
}
export function icsEvent(ev, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hanneung.com//exam event//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${ev.key}@hanneung.com`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Seoul:${evStart(ev)}`, `DTEND;TZID=Asia/Seoul:${evEnd(ev)}`,
    `SUMMARY:${esc(ev.title)}`, `DESCRIPTION:${esc(`${ev.note}\n${ev.url}`)}`, `URL:${ev.url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${ev.alarm ? `-PT${ev.alarm}M` : 'PT0M'}`, `DESCRIPTION:${esc(ev.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
export const eventIcsPath = (ev) => `/cal/${ev.key}.ics`;

// [data-events] 요소에 시험 일정 알림 버튼을 그린다
export function mountEvents(el) {
  if (!el || el.dataset.mounted) return;
  const evs = examEvents();
  if (!evs.length) return;
  el.dataset.mounted = '1';
  const os = platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);
  el.dataset.os = os;
  el.classList.add('card', 'remind', 'events');
  const btn = (ev) =>
    os === 'ios'
      ? `<a class="btn primary sm" data-ev="${ev.key}" href="${eventIcsPath(ev)}">캘린더에 추가</a>`
      : `<a class="btn primary sm" data-ev="${ev.key}" href="${googleEventUrl(ev)}" target="_blank" rel="noopener">구글 캘린더에 추가</a>${os === 'desktop' ? `<a class="btn sm" href="${eventIcsPath(ev)}" download="${ev.key}.ics">.ics</a>` : ''}`;
  el.innerHTML = `<p class="label">시험 일정 알림</p>
<h3 class="remind-h">놓치면 안 되는 날, 그날 아침에 알려 드려요</h3>
<ul class="ev-list">${evs.map((ev) => `<li><span class="ev-when"><b>${md(ev.date)}</b> ${ev.time}</span><span class="ev-what">${ev.label}</span><span class="acts">${btn(ev)}</span></li>`).join('')}</ul>
<p class="hint">로그인·개인정보 입력 없음. 캘린더 화면에서 "저장"을 눌러야 등록돼요.</p>`;
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-remind]').forEach(mountRemind);
  document.querySelectorAll('[data-events]').forEach(mountEvents);
}

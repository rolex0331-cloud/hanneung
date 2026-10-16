// 운영 설정. 비밀값 없음.
export const SITE = {
  name: '한능',
  url: 'https://hanneung.com/',
  contact: 'https://github.com/rolex0331-cloud/hanneung/issues',
  officialExam: 'https://www.historyexam.go.kr/',
  officialData: 'https://www.data.go.kr/data/15119618/fileData.do',
};

// 시험 일정: 공식 사이트에서 직접 확인한 값만 넣는다. verified=false 항목은 화면에 표시하지 않는다.
export const EXAMS = [
  { round: 77, date: '2026-02-07', type: '심화·기본', apply: '1/6 ~ 1/13', result: '2026-02-20', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
  { round: 78, date: '2026-05-23', type: '심화', apply: '4/21 ~ 4/28', result: '2026-06-05', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
  { round: 79, date: '2026-08-09', type: '심화·기본', apply: '7/7 ~ 7/14', result: '2026-08-21', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
  { round: 80, date: '2026-10-17', type: '심화', apply: '9/15 ~ 9/22 (마감)', result: '2026-10-30', ticket: '10/13(화) 10:00부터', refund: '100% 9/15~10/2 · 50% 10/3~10/9', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
  { round: 81, date: '2026-11-28', type: '심화', apply: '11/3(화) 10:00 ~ 11/10(화) 17:00', applyOpen: '2026-11-03T10:00', extra: '11/11(수) 13:00 ~ 11/13(금) 17:00', result: '2026-12-11', ticket: '11/24(화) 10:00부터', refund: '100% 11/3~11/17 · 50% 11/18~11/20', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
];

// 애드센스 승인 후 게시자 ID(ca-pub-…)를 넣으면 광고 영역이 켜진다. 비어 있으면 광고 요청 없음.
export const ADS = { client: 'ca-pub-7795759079027323', slots: { result: '', inline: '' } };

// Cloudflare Web Analytics 토큰(쿠키 없음). 비어 있으면 측정 요청 없음.
export const ANALYTICS = { cfBeaconToken: '' };

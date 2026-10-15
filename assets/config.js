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
  { round: 80, date: '2026-10-17', type: '심화', apply: '9/15 ~ 9/22 (마감)', result: '2026-10-30', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
  { round: 81, date: '2026-11-28', type: '심화', apply: '11/3(화) 10:00 ~ 11/10(화) 17:00', result: '2026-12-11', verified: true, source: 'historyexam.go.kr 시험 일정 (2026-10-15 확인)' },
];

// 애드센스 승인 후 게시자 ID(ca-pub-…)를 넣으면 광고 영역이 켜진다. 비어 있으면 광고 요청 없음.
export const ADS = { client: 'ca-pub-7795759079027323', slots: { result: '', inline: '' } };

// Cloudflare Web Analytics 토큰(쿠키 없음). 비어 있으면 측정 요청 없음.
export const ANALYTICS = { cfBeaconToken: '' };

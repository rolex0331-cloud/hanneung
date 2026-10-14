# 한능 (hanneung.com)

한국사능력검정시험 심화 대비 무료 문제풀이. 오늘의 10문제, 시대별 학습, 오답노트, 50문항 실전 모의고사(급수 판정). 회원가입 없음.

- 운영: https://hanneung.com
- 문항: `assets/questions.js` (전부 자체 제작)
- 엔진: `assets/engine.js` (날짜별 출제, 선택지 섞기, 채점·급수, 연속 학습일)
- 화면: `scripts/index.template.html`, `assets/app.js`, `assets/style.css`
- 정적 페이지: `scripts/build.mjs` → `dist/`

```
npm ci
npm test            # 단위·문항·사이트
npm run test:e2e    # 브라우저 E2E (Chrome, BASE_URL 지정 시 운영 대상)
npm run serve       # dist 로컬 서버
npm run deploy      # 빌드 → 테스트 → Cloudflare 배포
```

상태와 결정 사항: [PROJECT_STATE.md](PROJECT_STATE.md)

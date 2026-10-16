// 홈 화면 설치(PWA): 서비스 워커 등록 + [data-install] 카드.
// 안드로이드 크롬·삼성 인터넷: 설치 버튼(beforeinstallprompt) / 아이폰 사파리: 공유→홈 화면에 추가 안내 /
// 네이버·카카오 앱 안: 다른 브라우저로 열기 안내 / 이미 설치(standalone)·닫음(14일)이면 숨김
const KEY = 'hanneung:install';
const get = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};
const set = (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...get(), ...v }));
  } catch {
    /* 저장소 차단 */
  }
};

export function installMode(ua = '', touchPoints = 0, standalone = false) {
  if (standalone) return 'installed';
  if (/NAVER\(inapp|KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios';
  return 'prompt'; // beforeinstallprompt를 기다린다(오지 않으면 카드 숨김)
}

if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)))
    navigator.serviceWorker.register('/sw.js').catch(() => {});

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const mode = installMode(navigator.userAgent, navigator.maxTouchPoints || 0, standalone);
  const st = get();
  const hidden = mode === 'installed' || st.installed || (st.closedAt && Date.now() - st.closedAt < 14 * 864e5);
  let deferred = null;

  const render = (el) => {
    if (hidden || el.dataset.mounted) return;
    const how = {
      ios: '사파리 아래쪽 <b>공유 버튼(□↑)</b> → <b>"홈 화면에 추가"</b>를 누르세요.',
      'ios-other': '아이폰은 <b>사파리</b>에서 열어야 홈 화면에 추가할 수 있어요. 사파리에서 hanneung.com을 연 뒤 공유 → "홈 화면에 추가".',
      inapp: '지금은 앱 안 브라우저라 설치가 안 돼요. 오른쪽 위·아래 <b>메뉴(⋮ 또는 ⋯)</b> → <b>"다른 브라우저로 열기"</b>를 누른 뒤 크롬에서 설치하세요.',
    }[mode];
    if (mode === 'prompt' && !deferred) return; // 설치 가능할 때만
    el.dataset.mounted = '1';
    el.hidden = false;
    el.classList.add('card', 'remind', 'install');
    el.innerHTML = `<p class="label">앱처럼 쓰기</p>
<h3 class="remind-h">홈 화면에 한능 추가</h3>
<p class="hint remind-sub">아이콘 한 번에 바로 오늘의 문제. 전체 화면으로 열리고, 인터넷이 끊겨도 문제를 풀 수 있어요. 설치 파일·로그인 없음.</p>
${how ? `<p class="install-how">${how}</p>` : '<div class="remind-row"><button type="button" class="btn primary" data-act="install">홈 화면에 추가</button></div>'}
<button type="button" class="install-close" data-act="close" aria-label="닫기">닫기</button>`;
    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') {
        set({ closedAt: Date.now() });
        el.hidden = true;
      } else if (act === 'install' && deferred) {
        deferred.prompt();
        const r = await deferred.userChoice.catch(() => null);
        deferred = null;
        if (r?.outcome === 'accepted') {
          set({ installed: true });
          el.hidden = true;
        }
      }
    });
  };
  const mountAll = () => document.querySelectorAll('[data-install]').forEach(render);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    mountAll();
  });
  window.addEventListener('appinstalled', () => {
    set({ installed: true });
    document.querySelectorAll('[data-install]').forEach((el) => (el.hidden = true));
  });
  mountAll();
}

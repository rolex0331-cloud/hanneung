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

// 앱 안 브라우저(네이버·카카오 등): 캘린더(구글 로그인)·설치가 막힌다 → 바깥 브라우저로 여는 링크
export function inappKind(ua = '') {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  if (/DaumApps|Instagram|FBAN|FBAV|Line\/|everytimeApp|BAND\//i.test(ua)) return 'other';
  return null;
}
export function externalUrl(href, ua = '') {
  const kind = inappKind(ua);
  if (!kind) return null;
  if (kind === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  if (!/Android/i.test(ua)) return null; // 아이폰 네이버 앱 등은 강제로 사파리를 열 방법이 없어 안내만
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

// 공유할 주소: 앱 화면(/app/·/today/)은 첫 화면, 짝 퀴즈는 그 짝 그대로, 나머지는 그 페이지의 대표 주소(canonical)
export function shareUrl(loc, canonical) {
  const origin = 'https://hanneung.com';
  if (loc.pathname.startsWith('/pair/') && loc.hash.startsWith('#/pair/')) return `${origin}/pair/${loc.hash}`;
  if (/^\/(app|today)\//.test(loc.pathname)) return `${origin}/`;
  return canonical || `${origin}${loc.pathname}`;
}

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
  // 설치를 눌러도 기기 보안 기능 등으로 실제 설치가 안 될 수 있어 '설치함'은 3일만 숨긴다(아이콘으로 열면 standalone이라 계속 숨김)
  const hidden = mode === 'installed' || (st.installedAt && Date.now() - st.installedAt < 3 * 864e5) || (st.closedAt && Date.now() - st.closedAt < 14 * 864e5);
  let deferred = null;

  const render = (el) => {
    if (hidden || el.dataset.mounted) return;
    const how = {
      ios: '사파리 아래쪽 <b>공유 버튼(□↑)</b> → <b>"홈 화면에 추가"</b>를 누르세요.',
      'ios-other': '아이폰은 <b>사파리</b>에서 열어야 홈 화면에 추가할 수 있어요. 사파리에서 hanneung.com을 연 뒤 공유 → "홈 화면에 추가".',
      inapp: externalUrl(location.href, navigator.userAgent)
        ? `지금은 앱 안 화면이라 설치가 안 돼요. <a class="btn sm primary" href="${externalUrl(location.href, navigator.userAgent)}">크롬에서 열기</a> 를 누른 뒤 설치하세요.`
        : '지금은 앱 안 화면이라 설치가 안 돼요. 오른쪽 위·아래 <b>메뉴(⋮ 또는 ⋯)</b> → <b>"다른 브라우저로 열기"</b>를 누른 뒤 설치하세요.',
    }[mode];
    if (mode === 'prompt' && !deferred) return; // 설치 가능할 때만
    el.dataset.mounted = '1';
    el.hidden = false;
    el.classList.add('card', 'remind', 'install');
    el.innerHTML = `<p class="label">앱처럼 쓰기</p>
<h3 class="remind-h">홈 화면에 한능 추가</h3>
<p class="hint remind-sub">아이콘 한 번에 바로 오늘의 문제. 전체 화면으로 열리고, 인터넷이 끊겨도 문제를 풀 수 있어요. 설치 파일·로그인 없음.</p>
${how ? `<p class="install-how">${how}</p>` : '<div class="remind-row"><button type="button" class="btn primary" data-act="install">홈 화면에 추가</button></div><p class="hint install-alt">설치했는데 아이콘이 안 보이면(휴대폰 보안 설정이 막는 경우): 크롬 오른쪽 위 <b>⋮</b> → <b>"홈 화면에 추가"</b> → <b>"바로가기 만들기"</b>를 고르세요.</p>'}
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
          set({ installedAt: Date.now() });
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
    set({ installedAt: Date.now() });
    document.querySelectorAll('[data-install]').forEach((el) => (el.hidden = true));
  });
  mountAll();

  // 공유 버튼: 주소창이 없는 앱 화면에서도 링크를 보낼 수 있게
  const toast = (msg) => {
    const t = document.createElement('div');
    t.className = 'share-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-share]')) return;
    const url = shareUrl(location, document.querySelector('link[rel="canonical"]')?.href);
    const title = document.title.replace(/\s*\|\s*한능$/, '');
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — 한능`, url });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('링크를 복사했어요. 카톡이나 문자에 붙여 넣으세요.');
    } catch {
      prompt('이 주소를 복사하세요', url);
    }
  });

  // 앱 안 브라우저 안내 바 (닫으면 하루 동안 숨김)
  const kind = inappKind(navigator.userAgent);
  if (kind && !(st.inappClosedAt && Date.now() - st.inappClosedAt < 864e5)) {
    const ext = externalUrl(location.href, navigator.userAgent);
    const bar = document.createElement('div');
    bar.className = 'inapp-bar';
    bar.setAttribute('role', 'note');
    bar.innerHTML = ext
      ? `<span>앱 안 화면에서는 캘린더 알림·홈 화면 추가가 막혀요.</span><a class="btn sm primary" href="${ext}">${kind === 'kakao' ? '기본 브라우저로 열기' : '크롬에서 열기'}</a><button type="button" aria-label="닫기">닫기</button>`
      : `<span>앱 안 화면에서는 캘린더 알림·홈 화면 추가가 막혀요. 오른쪽 아래 <b>⋯</b> → <b>"다른 브라우저로 열기"</b>(사파리)를 눌러 주세요.</span><button type="button" aria-label="닫기">닫기</button>`;
    bar.querySelector('button').addEventListener('click', () => {
      set({ inappClosedAt: Date.now() });
      bar.remove();
    });
    document.body.prepend(bar);
  }
}

// 블로그 재료 페이지(/kit/): 복사 버튼. 클립보드 API가 막힌 브라우저는 선택 후 execCommand로
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const src = document.getElementById(b.dataset.copy);
  const ok = await copy(src.value ?? src.textContent);
  const old = b.dataset.label || (b.dataset.label = b.textContent);
  b.textContent = ok ? '복사됨 ✓' : '길게 눌러 직접 복사';
  if (!ok) { src.focus(); src.select?.(); }
  setTimeout(() => (b.textContent = old), 1800);
});

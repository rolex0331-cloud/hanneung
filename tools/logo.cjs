const opentype = require('opentype.js');
const fs = require('fs');
const black = opentype.loadSync(__dirname + '/fonts-src/Pretendard-Black.otf');
function glyphPath(font, text, size, x, y) {
  const p = font.getPath(text, 0, 0, size);
  const bb = p.getBoundingBox();
  const w = bb.x2 - bb.x1, h = bb.y2 - bb.y1;
  return { d: font.getPath(text, x - bb.x1, y - bb.y1, size).toPathData(2), w, h };
}
// 낙관(도장) 심볼: 붉은 사각 + 안쪽 테두리 + 흰 '한'
const g = glyphPath(black, '한', 40, 0, 0);
const gx = (64 - g.w) / 2, gy = (64 - g.h) / 2;
const seal = `<rect x="2" y="2" width="60" height="60" rx="12" fill="#C92A2A"/><rect x="7" y="7" width="50" height="50" rx="8" fill="none" stroke="#FFF4EC" stroke-width="2" opacity="0.85"/><path fill="#FFF4EC" d="${glyphPath(black, '한', 40, gx, gy).d}"/>`;
fs.writeFileSync(__dirname + '/../assets/symbol.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${seal}</svg>`);
// 워드마크: 심볼 + '한능'
const wm = glyphPath(black, '한능', 100, 0, 0);
const k = 38 / wm.h;
const wmPath = glyphPath(black, '한능', 100, 0, 0).d;
const W = 64 + 14 + wm.w * k;
const logo = `<svg xmlns="http://www.w3.org/2000/svg" class="logo-svg" viewBox="0 0 ${W.toFixed(1)} 64" role="img" aria-label="한능">${seal}<path transform="translate(78 13) scale(${k.toFixed(4)})" fill="currentColor" d="${wmPath}"/></svg>`;
fs.writeFileSync(__dirname + '/../assets/logo-inline.svg', logo);
fs.writeFileSync(__dirname + '/logo-preview.html', `<!doctype html><meta charset=utf-8><body style="margin:0;padding:24px;background:#F7F3EA;color:#1C2230;display:flex;gap:28px;align-items:center"><div style="height:44px">${logo.replace('class="logo-svg"','style="height:44px;width:auto"')}</div><div style="height:120px">${logo.replace('class="logo-svg"','style="height:120px;width:auto"')}</div><img src="../assets/symbol.svg" width="64"><img src="../assets/symbol.svg" width="32"><img src="../assets/symbol.svg" width="16"><div style="background:#1C2230;color:#fff;padding:12px;border-radius:12px;height:44px">${logo.replace('class="logo-svg"','style="height:44px;width:auto"')}</div></body>`);
console.log('ok', W.toFixed(1));

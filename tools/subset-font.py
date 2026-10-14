# 사이트에 쓰이는 글자만 남긴 Pretendard Variable 서브셋 (개발용)
# 사용: python tools/subset-font.py   (원본: tools/fonts-src/PretendardVariable.woff2, SIL OFL 1.1)
import pathlib
from fontTools import subset
root = pathlib.Path(__file__).resolve().parent.parent
chars = set()
for p in list((root / 'assets').glob('*.js')) + list((root / 'scripts').glob('*')) :
    if p.is_file():
        chars |= set(p.read_text(encoding='utf-8'))
chars |= set(r'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,:;!?()[]{}<>/\-_+=*&%#@~·…→←×−’‘“”"|①②③④⑤')
text = ''.join(sorted(c for c in chars if ord(c) >= 32))
out = root / 'assets' / 'fonts' / 'pretendard-subset.woff2'
o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['kern', 'tnum', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']; o.name_IDs = ['*']
f = subset.load_font(str(root / 'tools' / 'fonts-src' / 'PretendardVariable.woff2'), o)
s = subset.Subsetter(o); s.populate(text=text); s.subset(f); subset.save_font(f, str(out), o)
print(out.stat().st_size, 'bytes', len(text), 'chars')

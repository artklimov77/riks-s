"""Импорт фотобазы из альбомов ВК (vk.com/rikss12) в сайт.

Источник: файлы riks_<albumId>_NNN.jpg + riks_<albumId>_meta.json, скачанные из браузера в «Загрузки».
Результат:
  _vk_raw/<albumId>/...           — оригиналы (в .gitignore)
  img/vk/<slug>/NNN.jpg           — для сайта, до 1200 px
  img/vk/<slug>/t/NNN.jpg         — превью 480 px
  data/vk-albums.json             — альбомы: название, описание, фото, подписи
"""
import json, os, re, shutil, sys, glob, html
from PIL import Image, ImageOps

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '_vk_raw'); OUT = os.path.join(ROOT, 'img', 'vk')

TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','c','ch','sh','sch','','y','','e','yu','ya']))
def slug(s, aid):
    s = s.lower(); s = ''.join(TR.get(c, c) for c in s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return (s[:40].strip('-') or 'album') + '-' + aid[-4:]

def parse_desc(head, title):
    lines = [l.strip() for l in head.split('\n')]
    out, take = [], False
    for l in lines:
        if re.match(r'^\d+\s+фотограф', l): break
        if take: out.append(l)
        if l == title: take = True
    return '\n'.join(out).strip()

albums = []
BAD = []
for mf in sorted(glob.glob(os.path.join(SRC, 'riks_*_meta.json'))):
    m = json.load(open(mf, encoding='utf-8'))
    aid = str(m['aid']); title = re.sub(r'\s+–\s+\d+\s+фотограф.*$', '', m['title']).strip()
    desc = parse_desc(m.get('head', ''), title)
    sl = slug(title, aid)
    os.makedirs(os.path.join(RAW, aid), exist_ok=True)
    os.makedirs(os.path.join(OUT, sl, 't'), exist_ok=True)
    photos = []
    for p in m['photos']:
        src = os.path.join(SRC, p['file'])
        raw = os.path.join(RAW, aid, p['file'])
        if os.path.exists(src): shutil.move(src, raw)
        if not os.path.exists(raw): continue
        try: Image.open(raw).verify()
        except Exception:
            BAD.append(p['file']); continue
        n = p['file'].rsplit('_', 1)[1].replace('.jpg', '.webp')  # NNN.webp
        big, th = os.path.join(OUT, sl, n), os.path.join(OUT, sl, 't', n)
        if not os.path.exists(big) or not os.path.exists(th):
            im = ImageOps.exif_transpose(Image.open(raw)).convert('RGB')
            b = im.copy(); b.thumbnail((1100, 1100)); b.save(big, 'WEBP', quality=74, method=5)
            t = im.copy(); t.thumbnail((460, 460)); t.save(th, 'WEBP', quality=66, method=5)
            w, h = b.size
        else:
            w, h = Image.open(big).size
        photos.append({'src': f'img/vk/{sl}/{n}', 'th': f'img/vk/{sl}/t/{n}', 'w': w, 'h': h, 'desc': p.get('desc', '').strip()})
    shutil.move(mf, os.path.join(RAW, aid, os.path.basename(mf)))
    albums.append({'id': aid, 'slug': sl, 'title': title, 'desc': desc, 'count': len(photos), 'photos': photos})
    print(f'{aid} {sl}: {len(photos)}')

# дополняем существующий каталог (импорт можно делать частями)
dst = os.path.join(ROOT, 'data', 'vk-albums.json')
old = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else []
byid = {a['id']: a for a in old}
for a in albums: byid[a['id']] = a
def clean(t):
    t = html.unescape(html.unescape(t or ''))
    return re.sub(r'\s*Показать\s*(полностью)?…?\s*$', '', t).strip()
for a in byid.values():
    a['title'] = clean(a['title']); a['desc'] = clean(a['desc'])
    for ph in a['photos']: ph['desc'] = clean(ph['desc'])
json.dump(list(byid.values()), open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(BAD, open(os.path.join(RAW, 'bad.json'), 'w'), indent=0)
print('bad files:', len(BAD))
print('albums total:', len(byid), 'photos:', sum(a['count'] for a in byid.values()))

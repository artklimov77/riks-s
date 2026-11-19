# Фото товаров UDS → свои файлы img/uds/ (сервер картинок UDS бывает недоступен).
# Запуск: python tools/self_host_uds.py  → скачивает фото, меняет ссылки в data/uds-catalog.json
#         и пишет tools/uds-photo-map.json (старая ссылка → новый путь) для обновления базы CRM.
import json, os, hashlib, urllib.request, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'data', 'uds-catalog.json')
OUT = os.path.join(ROOT, 'img', 'uds')
os.makedirs(OUT, exist_ok=True)
data = json.load(open(CAT, encoding='utf-8'))
mp, bad = {}, []
for r in data:
    u = r.get('photo') or ''
    if not u.startswith('http'):
        continue
    if u not in mp:
        ext = '.png' if '.png' in u.lower() else '.webp' if '.webp' in u.lower() else '.jpg'
        fn = hashlib.md5(u.encode()).hexdigest()[:12] + ext
        p = os.path.join(OUT, fn)
        if not os.path.exists(p):
            try:
                b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
                open(p, 'wb').write(b)
            except Exception as e:
                bad.append(u); continue
        mp[u] = 'img/uds/' + fn
    r['photo'] = mp[u]
json.dump(data, open(CAT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(mp, open(os.path.join(ROOT, 'tools', 'uds-photo-map.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('photos:', len(mp), 'failed:', len(bad))
if bad: sys.exit(1)

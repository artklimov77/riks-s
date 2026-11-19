# Шрифты Google → свои файлы в assets/fonts/ (152-ФЗ: посетитель не передаёт IP в Google).
# Запуск: python tools/self_host_fonts.py  (идемпотентно; меняет <link> во всех HTML и tools/site_build.py)
import re, os, glob, hashlib, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
KEEP = ('cyrillic', 'latin')  # подмножества символов, которые нужны сайту (без cyrillic-ext/latin-ext/vietnamese/greek)
SETS = {
    'site.css': 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800;900&family=Roboto+Condensed:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500;600&family=Comfortaa:wght@700&display=swap',
    'admin.css': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap',
}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()

os.makedirs(OUT, exist_ok=True)
for name, url in SETS.items():
    css = get(url).decode('utf-8')
    blocks = re.findall(r'/\* ([a-z-]+) \*/\s*(@font-face \{[^}]+\})', css)
    out = []
    for subset, block in blocks:
        if subset not in KEEP:
            continue
        src = re.search(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', block).group(1)
        fam = re.search(r"font-family: '([^']+)'", block).group(1)
        fn = re.sub(r'[^a-z0-9]+', '-', fam.lower()).strip('-') + '-' + subset + '-' + hashlib.md5(src.encode()).hexdigest()[:8] + '.woff2'
        path = os.path.join(OUT, fn)
        if not os.path.exists(path):
            open(path, 'wb').write(get(src))
        out.append('/* ' + subset + ' */\n' + block.replace(src, fn))
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write('/* Шрифты хранятся на нашем сервере (tools/self_host_fonts.py) */\n' + '\n'.join(out) + '\n')
    print(name, len(out), 'faces')

PRE = re.compile(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\n?')
LINK = re.compile(r'<link href="https://fonts\.googleapis\.com/css2\?([^"]+)" rel="stylesheet">')
def fix(s):
    s = PRE.sub('', s)
    return LINK.sub(lambda m: '<link href="assets/fonts/' + ('admin.css' if 'Open+Sans' in m.group(1) else 'site.css') + '" rel="stylesheet">', s)

n = 0
for f in glob.glob(os.path.join(ROOT, '*.html')):
    s = open(f, encoding='utf-8').read(); t = fix(s)
    if t != s: open(f, 'w', encoding='utf-8', newline='').write(t); n += 1
sb = os.path.join(ROOT, 'tools', 'site_build.py')
s = open(sb, encoding='utf-8').read()
t = s.replace("'<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\\n'\n", '')
t = re.sub(r"'<link href=\"https://fonts\.googleapis\.com/css2\?[^']+\" rel=\"stylesheet\">\\n'", lambda m: "'<link href=\"assets/fonts/site.css\" rel=\"stylesheet\">\\n'", t)
if t != s: open(sb, 'w', encoding='utf-8', newline='').write(t)
print('html changed:', n, '| site_build updated:', t != s)

# -*- coding: utf-8 -*-
"""Каталог полиграфии (страница poligrafiya.html, блок #katalog).

Что делает:
  1) assets/print-data.js — позиции, варианты отделки, тиражи и цены (розничные цены — из UDS, как в прайсе заказчика);
  2) shablony/*.pdf + *.svg — шаблоны макетов (вылеты 1 мм, безопасная зона 4 мм, линии сгиба);
  3) вставляет/обновляет блок #katalog в poligrafiya.html (вместо старого блока «Цены»).

Цены меняются здесь, в PRODUCTS (t = [[тираж, цена], ...]). Позиции без цены — «по запросу» (t пустой).
Запуск: python tools/print_catalog.py   (после site_build.py / site_pains.py / site_nav.py)
"""
import os, json, re, subprocess, shutil, html

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = html.escape

# формат: (ширина, высота мм в развороте/под обрез готового изделия), сгибы — x-координаты линий (мм от левого края)
FMT = {
    'viz':    dict(w=90, h=50, t='Визитка 90×50 мм'),
    'evroviz': dict(w=85, h=55, t='Евровизитка 85×55 мм'),
    'a7':     dict(w=74, h=105, t='А7 74×105 мм'),
    'a6':     dict(w=105, h=148, t='А6 105×148 мм'),
    'a5':     dict(w=148, h=210, t='А5 148×210 мм'),
    'a4':     dict(w=210, h=297, t='А4 210×297 мм'),
    'a3':     dict(w=297, h=420, t='А3 297×420 мм'),
    'evro':   dict(w=99, h=210, t='Еврофлаер 99×210 мм'),
    'mini':   dict(w=90, h=150, t='Минифлаер 90×150 мм'),
    'b-a6a7': dict(w=148, h=105, f=[74], t='Буклет А6→А7: 148×105 мм, 1 сгиб'),
    'b-a5a6': dict(w=210, h=148, f=[105], t='Буклет А5→А6: 210×148 мм, 1 сгиб'),
    'b-a4a5': dict(w=297, h=210, f=[148.5], t='Буклет А4→А5: 297×210 мм, 1 сгиб'),
    'b-evro': dict(w=297, h=210, f=[99, 198], t='Евробуклет, лифлет А4: 297×210 мм, 2 сгиба'),
    'otk-evro': dict(w=210, h=99, f=[], t='Открытка 210×99 мм'),
    'otk-a5': dict(w=210, h=148, f=[105], t='Открытка 210×148 мм, 1 сгиб'),
    'kupon':  dict(w=99, h=210, t='Купон, сертификат 1/3 А4: 99×210 мм'),
    'st30':   dict(w=30, h=30, c=True, t='Наклейка: круг 30 мм'),
    'st40':   dict(w=40, h=40, c=True, t='Наклейка: круг 40 мм'),
    'st50':   dict(w=50, h=50, c=True, t='Наклейка: круг 50 мм'),
    'st4055': dict(w=40, h=55, t='Наклейка 40×55 мм'),
    'st5090': dict(w=50, h=90, t='Наклейка 50×90 мм'),
}

T5 = lambda *p: [[q, v] for q, v in zip([1000, 2000, 3000, 4000, 5000], p)]
T3 = lambda *p: [[q, v] for q, v in zip([1000, 2500, 5000], p)]

# cat, id, название, формат, коротко, бумага/печать, 2 стороны без доплаты?, варианты [(название, тиражи)]
PRODUCTS = [
    # ---- визитки ----
    ('Визитки', 'viz', 'Визитки', 'viz', '90×50 мм', 'мелованный картон 300 г/м², 4+4', True, [
        ('Без отделки', T5(4000, 6000, 7500, 8700, 10000)),
        ('Ламинация', T5(4700, 7000, 9500, 11500, 14500)),
        ('Скругление углов', T5(5000, 6600, 8700, 10300, 12700)),
        ('Отверстие 5 мм', T5(5000, 6550, 8700, 10500, 12700)),
        ('Ламинация + скругление', [[1000, 5600]]),
    ]),
    ('Визитки', 'evroviz', 'Евровизитки', 'evroviz', '85×55 мм', 'мелованный картон 300 г/м², 4+4', True, [
        ('Без отделки', T5(4500, 6300, 8200, 10100, 11800)),
    ]),
    ('Визитки', 'viz-econom', 'Эконом-визитки', 'viz', '90×50 мм', 'бюджетный вариант, 4+4', True, []),
    ('Визитки', 'viz-double', 'Двойные визитки', 'viz', 'со сгибом, вертикальные и горизонтальные', '4+4', True, []),
    # ---- листовки ----
    ('Листовки и флаеры', 'a7', 'Листовка А7', 'a7', '74×105 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(2500, 4100, 5200))]),
    ('Листовки и флаеры', 'a6', 'Листовка А6', 'a6', '105×148 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(3900, 5700, 7100))]),
    ('Листовки и флаеры', 'a5', 'Листовка А5', 'a5', '148×210 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(4500, 8800, 12000))]),
    ('Листовки и флаеры', 'a4', 'Листовка А4', 'a4', '210×297 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(8800, 16200, 21000))]),
    ('Листовки и флаеры', 'evro', 'Еврофлаер', 'evro', '99×210 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(4100, 5700, 7600))]),
    ('Листовки и флаеры', 'mini', 'Минифлаер', 'mini', '90×150 мм', 'мелованная бумага, 4+4', True, [('Стандарт', T3(3600, 5000, 5700))]),
    ('Листовки и флаеры', 'a4-bw', 'Листовка А4 чёрно-белая', 'a4', '210×297 мм', 'офисная бумага 80 г/м²', False, [
        ('Только текст', [[400, 2100]]), ('С картинками и заливками', [[400, 3000]])]),
    # ---- буклеты ----
    ('Буклеты и лифлеты', 'b-a6a7', 'Буклет А6 → А7', 'b-a6a7', '1 сгиб', 'мелованная бумага, 4+4', True, [('Стандарт', T3(4800, 6400, 7700))]),
    ('Буклеты и лифлеты', 'b-a5a6', 'Буклет А5 → А6', 'b-a5a6', '1 сгиб', 'мелованная бумага, 4+4', True, [('Стандарт', T3(6200, 9200, 12500))]),
    ('Буклеты и лифлеты', 'b-a4a5', 'Буклет А4 → А5', 'b-a4a5', '1 сгиб', 'мелованная бумага, 4+4', True, [('Стандарт', [[1000, 8600]])]),
    ('Буклеты и лифлеты', 'b-evro', 'Евробуклет', 'b-evro', 'А4, 2 сгиба', 'мелованная бумага, 4+4', True, [('Стандарт', T3(6800, 11900, 17200))]),
    ('Буклеты и лифлеты', 'b-mini', 'Минибуклет', 'mini', '150×90 мм в сложении', 'мелованная бумага, 4+4', True, [('Стандарт', T3(5500, 7900, 12400))]),
    ('Буклеты и лифлеты', 'l-garm', 'Лифлет А4 «гармошка»', 'b-evro', 'А4, 2 сгиба', 'мелованная бумага, 4+4', True, [('Стандарт', T3(9700, 18000, 22600))]),
    ('Буклеты и лифлеты', 'l-nak', 'Лифлет А4 «накидка»', 'b-evro', 'А4, 2 сгиба', 'мелованная бумага, 4+4', True, [('Стандарт', T3(8700, 15600, 20600))]),
    ('Буклеты и лифлеты', 'b-a3a4', 'Буклет А3 → А4 и лифлеты А3', 'a3', 'А3, 1–2 сгиба', 'мелованная бумага, 4+4', True, []),
    # ---- открытки, купоны, сертификаты ----
    ('Открытки и купоны', 'otk-evro', 'Еврооткрытка', 'otk-evro', '99×210 мм', 'картон, 4+4', True, [('Стандарт', [[1000, 8800]])]),
    ('Открытки и купоны', 'otk-a5', 'Открытка 210×148', 'otk-a5', 'со сгибом', 'картон, 4+4', True, [('Стандарт', [[1000, 11700]])]),
    ('Открытки и купоны', 'kupon-hit', 'Купон 1/3 А4 «Хит»', 'kupon', '99×210 мм', 'двусторонний 4+4', True, [('Стандарт', [[500, 12000], [1000, 13000], [2000, 20400]])]),
    ('Открытки и купоны', 'kupon', 'Купон 1/3 А4 с ламинацией', 'kupon', '99×210 мм', 'односторонний 4+0', False, [
        ('Minimal, глянец', [[100, 3030], [200, 6000], [500, 14170]]),
        ('Minimal, мат', [[100, 3770], [200, 7480], [500, 17220]]),
        ('Standart, глянец', [[100, 3310], [200, 6570], [500, 15580]]),
        ('Standart, мат', [[100, 4050], [200, 8050], [500, 18650]]),
    ]),
    ('Открытки и купоны', 'sert', 'Подарочный сертификат', 'kupon', '1/3 А4 или А5', 'Premium, 4+0', False, [
        ('1/3 А4 (99×210)', [[100, 6000], [200, 11000]]),
        ('А5 (148×210)', [[100, 9000], [200, 15000]]),
    ]),
    # ---- наклейки ----
    ('Наклейки', 'st-round', 'Фигурные наклейки — круг', 'st40', '30, 40 или 50 мм', 'самоклеящаяся бумага, вырубка', False, [
        ('Круг 30 мм', [[200, 900], [500, 1500], [1000, 2600]]),
        ('Круг 40 мм', [[200, 1100], [500, 2400], [1000, 4000]]),
        ('Круг 50 мм', [[200, 1200], [500, 3000], [1000, 5500]]),
    ]),
    ('Наклейки', 'st-rect', 'Фигурные наклейки — прямоугольник', 'st4055', '40×55 или 50×90 мм', 'самоклеящаяся бумага, вырубка', False, [
        ('40×55 мм', [[100, 1150], [200, 1800], [500, 3300], [1000, 5500]]),
        ('50×90 мм', [[200, 2400]]),
    ]),
    ('Наклейки', 'stickerpack', 'Стикерпак А5', 'a5', 'плоттерная резка', 'самоклеящаяся плёнка', False, [('Стандарт', [[1, 150]])]),
    # ---- по запросу (позиции типографии-партнёра) ----
    ('Блокноты и календари', 'bloknot', 'Блокноты', 'a5', 'А5, А6, на пружине или клею', 'обложка — картон', False, []),
    ('Блокноты и календари', 'bloki', 'Блоки для записей', 'a7', 'кубарики и стикеры', 'офсетная бумага', False, []),
    ('Блокноты и календари', 'kal-karm', 'Карманные календари', 'viz', '70×100 мм, скругление углов', 'картон, 4+4', True, []),
    ('Блокноты и календари', 'kal-kv', 'Квартальные календари', 'a3', 'три блока, бегунок', 'под ключ', False, []),
    ('Блокноты и календари', 'kal-dom', 'Календари-домики', 'b-a5a6', 'настольные', 'картон', False, []),
    ('Блокноты и календари', 'kal-wall', 'Настенные перекидные календари', 'a3', 'на пружине', 'мелованная бумага', False, []),
    ('Плакаты и упаковка', 'plakat', 'Плакаты А3, А2, B2', 'a3', 'офсет и цифра', 'мелованная бумага', False, []),
    ('Плакаты и упаковка', 'konvert', 'Конверты с логотипом', 'otk-evro', 'Евро, С5, С4, крафт', 'офсет', False, []),
    ('Плакаты и упаковка', 'paket', 'Пакеты с логотипом', 'a4', 'бумажные, крафт, ПВД', 'печать и шелкография', False, []),
    ('Плакаты и упаковка', 'papka', 'Папки с логотипом', 'a4', 'для документов и презентаций', 'картон, 4+0', False, []),
    ('Плакаты и упаковка', 'stakan', 'Бумажные стаканы с логотипом', 'st50', 'брендированные', '', False, []),
    ('Плакаты и упаковка', 'heng', 'Хенгеры, отрывная реклама, флажки', 'a6', 'высечка по форме', 'картон', False, []),
    ('Плакаты и упаковка', 'pcard', 'Пластиковые карты', 'evroviz', 'клубные и дисконтные', 'ПВХ', True, []),
]

CATS = []
for p in PRODUCTS:
    if p[0] not in CATS:
        CATS.append(p[0])


def data_js():
    items = []
    for cat, pid, name, fmt, size, paper, both, vars_ in PRODUCTS:
        items.append(dict(id=pid, c=cat, n=name, f=fmt, s=size, p=paper, b=both,
                          v=[dict(n=vn, t=t) for vn, t in vars_], tpl=fmt if fmt in TPL_FILES else ''))
    fm = {k: dict(w=v['w'], h=v['h'], f=v.get('f', []), c=v.get('c', False)) for k, v in FMT.items()}
    return ('/* Каталог полиграфии — сгенерировано tools/print_catalog.py, руками не править */\n'
            'window.RIKS_PRINT = ' + json.dumps(dict(cats=CATS, fmt=fm, items=items), ensure_ascii=False, separators=(',', ':')) + ';\n')


# ---------- шаблоны ----------
TPL_FILES = ['viz', 'evroviz', 'a7', 'a6', 'a5', 'a4', 'evro', 'mini', 'b-a6a7', 'b-a5a6', 'b-a4a5', 'b-evro',
             'otk-evro', 'otk-a5', 'kupon', 'st30', 'st40', 'st50', 'st4055', 'st5090']
BLEED, SAFE = 1, 4


def tpl_svg(key):
    f = FMT[key]; w, h = f['w'], f['h']; W, H = w + 2 * BLEED, h + 2 * BLEED
    b = BLEED
    fs = max(1.6, min(w, h) / 22)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
             f'<title>Шаблон: {E(f["t"])}. Вылеты {BLEED} мм, безопасная зона {SAFE} мм</title>',
             '<g id="RAZMETKA_udalit_pered_otpravkoy" fill="none" stroke-width="0.2">',
             f'<rect x="0.1" y="0.1" width="{W-0.2}" height="{H-0.2}" stroke="#E3241B"/>']
    if f.get('c'):
        parts.append(f'<circle cx="{W/2}" cy="{H/2}" r="{w/2}" stroke="#111" stroke-dasharray="1 0.6"/>')
        parts.append(f'<circle cx="{W/2}" cy="{H/2}" r="{max(w/2-SAFE/2,1)}" stroke="#16a34a" stroke-dasharray="0.8 0.8"/>')
    else:
        parts.append(f'<rect x="{b}" y="{b}" width="{w}" height="{h}" stroke="#111" stroke-dasharray="1 0.6"/>')
        parts.append(f'<rect x="{b+SAFE}" y="{b+SAFE}" width="{w-2*SAFE}" height="{h-2*SAFE}" stroke="#16a34a" stroke-dasharray="0.8 0.8"/>')
    for x in f.get('f', []):
        parts.append(f'<line x1="{b+x}" y1="0" x2="{b+x}" y2="{H}" stroke="#d946ef" stroke-dasharray="2 1"/>')
    lines = [f['t'], f'файл с вылетами: {W:g}×{H:g} мм', 'красная — край файла (вылеты 1 мм)',
             'чёрная — линия реза', 'зелёная — текст и логотипы только внутри', 'розовая — линия сгиба',
             'УДАЛИТЕ РАЗМЕТКУ ПЕРЕД ОТПРАВКОЙ']
    if not f.get('f'):
        lines.remove('розовая — линия сгиба')
    if min(w, h) < 45:
        lines = [f['t'], 'удалите разметку']
    y0 = H / 2 - (len(lines) - 1) * fs * 0.75
    parts.append(f'<g fill="#9a8f88" stroke="none" font-family="Arial, sans-serif" font-size="{fs:.2f}" text-anchor="middle">')
    for i, t in enumerate(lines):
        parts.append(f'<text x="{W/2}" y="{y0 + i*fs*1.5:.2f}">{E(t)}</text>')
    parts.append('</g></g></svg>')
    return '\n'.join(parts)


def build_templates():
    out = os.path.join(R, 'shablony'); os.makedirs(out, exist_ok=True)
    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    for k in TPL_FILES:
        svg = tpl_svg(k)
        open(os.path.join(out, k + '.svg'), 'w', encoding='utf-8').write(svg)
        f = FMT[k]; W, H = f['w'] + 2 * BLEED, f['h'] + 2 * BLEED
        page = (f'<!doctype html><meta charset="utf-8"><style>@page{{size:{W}mm {H}mm;margin:0}}html,body{{margin:0}}'
                f'svg{{display:block;width:{W}mm;height:{H}mm}}</style>{svg}')
        tmp = os.path.join(out, '_tmp.html'); open(tmp, 'w', encoding='utf-8').write(page)
        if os.path.exists(chrome):
            subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                            '--print-to-pdf=' + os.path.join(out, k + '.pdf'), 'file:///' + tmp.replace(os.sep, '/')],
                           capture_output=True, timeout=120)
        os.remove(tmp)
    print('templates:', len(TPL_FILES))


# ---------- блок на странице ----------
SECTION = '''<!-- KATALOG -->
<section class="sec white" id="katalog">
  <div class="wrap">
    <div class="sec-head">
      <div><span class="label reveal"><i class="sq"></i>Каталог и цены</span><h2 class="h2 reveal d1">Выберите — и сразу<br>видно цену</h2></div>
      <p class="lead reveal d2" style="max-width:440px">Цены за тираж, печать с двух сторон — без доплаты. Чем больше тираж, тем дешевле штука: часто 2000 стоят чуть дороже 1000. Срок — 6–8 рабочих дней.</p>
    </div>
    <div class="pc-cats reveal" id="pcCats" role="tablist" aria-label="Разделы каталога"></div>
    <div class="pc-grid" id="pcGrid"></div>
    <div class="pc-help reveal">
      <div class="pc-help-i"><span class="pc-help-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 15l2 2 4-4"/></svg></span><div><b>Проверим макет до оплаты</b><span>Не подходит по требованиям — подскажем, что исправить.</span></div></div>
      <div class="pc-help-i"><span class="pc-help-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg></span><div><b>Самовывоз или доставка</b><span>Комсомольская, 134, по Йошкар-Оле и по России транспортной компанией.</span></div></div>
      <div class="pc-help-i"><span class="pc-help-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/></svg></span><div><b>Не знаете, где раздать?</b><span>Позвоните — подскажем, с кем посотрудничать и где ваша аудитория.</span></div></div>
    </div>
  </div>
</section>
<div class="pc-modal" id="pcModal" role="dialog" aria-modal="true" aria-labelledby="pcmTitle" hidden></div>

'''


def page():
    p = os.path.join(R, 'poligrafiya.html'); s = open(p, encoding='utf-8').read()
    s = re.sub(r'<!-- KATALOG -->.*?<div class="pc-modal"[^>]*></div>\n\n', '', s, flags=re.S)
    s = re.sub(r'<!-- PRICES -->\n<section class="sec white" id="prices">.*?</section>\n\n', '', s, flags=re.S)
    s = s.replace('href="#prices" class="s-card', 'href="#katalog" class="s-card')
    k = s.index('<!-- РАБОТЫ')
    s = s[:k] + SECTION + s[k:]
    for js in ('assets/print-data.js', 'assets/print.js'):
        if js not in s:
            s = s.replace('</body>', f'<script src="{js}" defer></script>\n</body>')
    open(p, 'w', encoding='utf-8', newline='').write(s)
    print('page: ok')


if __name__ == '__main__':
    build_templates()
    open(os.path.join(R, 'assets', 'print-data.js'), 'w', encoding='utf-8', newline='').write(data_js())
    page()

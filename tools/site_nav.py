# -*- coding: utf-8 -*-
"""Шапка: выпадающее меню «Услуги» со всеми страницами услуг (десктоп — панель, мобильный — раскрывающийся список).
Идемпотентно: повторный запуск заменяет старый блок. Запускать после tools/site_build.py."""
import os, re, glob

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'admin.html', 'leads.html', 'index-red.html'}

GROUPS = [
    ('Наружная реклама', [
        ('vyveski.html', 'Вывески и согласование', 'буквы, короба, паспорт ИК'),
        ('neon.html', 'Неоновые вывески', 'гибкий неон по эскизу'),
        ('transport.html', 'Реклама на транспорте', 'оклейка авто и троллейбусов'),
        ('logotip.html', 'Логотип и товарный знак', 'разработка и регистрация'),
    ]),
    ('Печать', [
        ('poligrafiya.html', 'Полиграфия', 'визитки, листовки, буклеты'),
        ('poligrafiya.html#pechat', 'Широкоформатная печать', 'баннеры, плёнка, УФ-печать'),
        ('poligrafiya.html#suveniry', 'Сувениры и мерч', 'кружки, футболки, ручки'),
    ]),
    ('Оформление помещений', [
        ('stendy.html', 'Информационные стенды', 'уголок потребителя, ПБ, ГО и ЧС'),
        ('tablichki-brajlya.html', 'Таблички Брайля и знаки', 'доступная среда, эвакуация'),
        ('oformlenie-shkol.html', 'Школы и детские сады', 'стенды, навигация, декор'),
        ('penoplast.html', 'Изделия из пенопласта', 'объёмные буквы и декор'),
    ]),
    ('Мобильные конструкции', [
        ('mobilnye-stojki.html', 'Мобильные стойки', 'паук, ролл ап, виндер'),
        ('shtendery.html', 'Штендеры', 'выносные конструкции'),
        ('rostovye-figury.html', 'Ростовые фигуры', 'печать на ПВХ'),
    ]),
]

CHEV = '<svg class="dd-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
ARR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def mega(services_href):
    cols = ''
    for g, items in GROUPS:
        li = ''.join(f'<a class="mg-i" href="{h}"><b>{t}</b><small>{d}</small></a>' for h, t, d in items)
        cols += f'<div class="mg-col"><span class="mg-h">{g}</span>{li}</div>'
    return ('<!--dd--><div class="nav-dd" id="navDd">'
            f'<button class="nav-dd-btn" type="button" aria-expanded="false" aria-controls="mega">Услуги{CHEV}</button>'
            f'<div class="mega" id="mega"><div class="mg-grid">{cols}</div>'
            '<div class="mg-ft"><span>Не нашли нужное? Опишите задачу — подскажем, что подойдёт и сколько стоит.</span>'
            f'<a href="{services_href}">Все услуги {ARR}</a><a href="ceny.html">Цены {ARR}</a></div></div></div><!--/dd-->')


def mobile():
    out = ''
    for g, items in GROUPS:
        out += f'<span class="mn-h">{g}</span>' + ''.join(f'<a href="{h}">{t}</a>' for h, t, _ in items)
    return f'<details class="mn-dd"><summary>Услуги{CHEV}</summary><div class="mn-list">{out}</div></details>'


def run():
    n = 0
    for p in sorted(glob.glob(os.path.join(R, '*.html'))):
        f = os.path.basename(p)
        if f in SKIP or f.startswith('_'):
            continue
        s = open(p, encoding='utf-8').read()
        o = s
        # десктоп
        a = s.find('<nav class="nav">'); b = s.find('</nav>', a)
        if a < 0:
            continue
        nav = s[a:b]
        nav = re.sub(r'<!--dd-->.*?<!--/dd-->', '@@DD@@', nav, flags=re.S)
        m = re.search(r'<a href="([^"]*#services)">Услуги</a>', nav)
        href = m.group(1) if m else 'index.html#services'
        nav = re.sub(r'<a href="[^"]*#services">Услуги</a>', '@@DD@@', nav)
        nav = re.sub(r'\s*<a href="mobilnye-stojki\.html">Стойки</a>', '', nav)
        nav = nav.replace('@@DD@@', mega(href))
        s = s[:a] + nav + s[b:]
        # мобильное меню
        a = s.find('<nav class="mnav" id="mnav">'); b = s.find('</nav>', a)
        if a >= 0:
            mn = s[a:b]
            mn = re.sub(r'<details class="mn-dd">.*?</details>', '@@MN@@', mn, flags=re.S)
            mn = re.sub(r'<a href="[^"]*#services">Услуги</a>', '@@MN@@', mn)
            mn = mn.replace('<a href="mobilnye-stojki.html">Стойки</a>', '')
            mn = mn.replace('@@MN@@', mobile())
            s = s[:a] + mn + s[b:]
        if s != o:
            open(p, 'w', encoding='utf-8', newline='').write(s); n += 1
        assert s.count('id="navDd"') == 1 and s.count('class="mn-dd"') <= 1, f
    print('nav: updated', n)


if __name__ == '__main__':
    run()

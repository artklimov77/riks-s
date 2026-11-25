# -*- coding: utf-8 -*-
"""Блок «Видео» на страницах услуг: ролики из группы ВК rikss12 (vkvideo.ru/@rikss12).
Плеер ВК грузится только по нажатию (обложка в стиле сайта) — страница не тормозит.
Добавить ролик: id из адреса vkvideo.ru/video-52849648_<ID> → в VIDEOS нужной страницы.
Запуск: python tools/site_videos.py (идемпотентно, после site_build / site_pains / site_nav / print_catalog)."""
import os, re, html

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = html.escape
OID = '-52849648'

# страница → (заголовок, подзаголовок, [(id, название, подпись)])
VIDEOS = {
    'vyveski.html': ('Видео', 'Паспорт вывески и наши работы', [
        ('456239072', 'Паспорт информационной конструкции', 'Что это и зачем он нужен'),
        ('456239036', 'Световая вывеска для стоматологии «АС»', 'Наша работа'),
        ('456239035', 'Вывеска для стоматологии', 'Готовая работа'),
    ]),
    'mobilnye-stojki.html': ('Видео', 'Как это устроено', [
        ('456239130', 'Что такое стенд Roll-up', 'Коротко о мобильном стенде'),
        ('456239077', 'Как собрать баннерную стойку «Паук»', 'Пошаговая сборка'),
    ]),
    'tablichki-brajlya.html': ('Видео', 'Таблички Брайля', [
        ('456239074', 'Таблички Брайля', 'О табличках для доступной среды'),
    ]),
    'transport.html': ('Видео', 'Оклейка своими руками', [
        ('456239073', 'Как клеить номера на лодки', 'Короткая инструкция'),
    ]),
    'poligrafiya.html': ('Видео', 'Печать в деле', [
        ('xp:poligrafiya', 'Как подготовить макет к печати', 'Короткий ролик: вылеты, безопасная зона, цвет и шрифты'),
        ('456239158', 'Баннерное панно «Лесная сказка»', 'Изготовление и монтаж широкоформатного баннера'),
        ('456239156', 'Сколько «раздаток» вам на самом деле нужно', 'Считаем сроки и тираж — и сокращаем расходы'),
    ]),
    'neon.html': ('Видео', 'Как появляется неон', [
        ('xp:neon', 'Как мы делаем неоновую вывеску', 'От эскиза до монтажа — за минуту'),
    ]),
    'stendy.html': ('Видео', 'Что должно висеть', [
        ('xp:stendy', 'Какие стенды нужны организации', 'Коротко об обязательных стендах'),
    ]),
    'oformlenie-shkol.html': ('Видео', 'Наша работа', [
        ('456239132', 'Входная группа школы №4, Медведево', 'Оформление входной группы под ключ'),
    ]),
}

PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'


def section(title, sub, items):
    def card(vid, t, d):
        if vid.startswith('xp:'):  # свой обучающий ролик (assets/explainer.js)
            return f'<article class="vd-card wide reveal"><div class="xp" data-xp="{vid[3:]}"></div><div class="vd-meta"><span>{E(d)}</span></div></article>'
        return (f'<article class="vd-card reveal"><button type="button" class="vd-play" data-vk="{OID}_{vid}" aria-label="Смотреть: {E(t)}">'
                f'<span class="vd-poster"><span class="vd-tag">ВКонтакте · видео</span><span class="vd-btn">{PLAY}</span><span class="vd-t">{E(t)}</span></span></button>'
                f'<div class="vd-meta"><span>{E(d)}</span></div></article>')
    cards = ''.join(card(*x) for x in items)
    vk = any(not x[0].startswith('xp:') for x in items)
    nvk = sum(1 for x in items if not x[0].startswith('xp:'))
    many = ' many' if len(items) > 1 else ''
    return (f'<!-- VIDEO -->\n<section class="sec" id="video">\n  <div class="wrap">\n'
            f'    <div class="sec-head"><div><span class="label reveal"><i class="sq"></i>{E(title)}</span><h2 class="h2 reveal d1">{E(sub)}</h2></div>' +
            (f'<p class="lead reveal d2" style="max-width:420px">Больше роликов — в нашей группе <a href="https://vkvideo.ru/@rikss12" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">ВКонтакте</a>.</p>' if vk else '<p class="lead reveal d2" style="max-width:420px">Короткий ролик — можно смотреть без звука.</p>') + '</div>\n' +
            f'    <div class="vd-grid{many} n{nvk or 1}">{cards}</div>\n  </div>\n</section>\n\n')


def run():
    for page, (title, sub, items) in VIDEOS.items():
        p = os.path.join(R, page); s = open(p, encoding='utf-8').read()
        s = re.sub(r'<!-- VIDEO -->\n<section class="sec[^"]*" id="video">.*?</section>\n\n', '', s, flags=re.S)
        k = s.index('<!-- LEAD')
        # фон: чередуем с соседними секциями
        prev = s.rfind('<section class="', 0, k)
        white = 'white' in s[prev:prev + 40]
        sec = section(title, sub, items).replace('<section class="sec" id="video">', '<section class="sec' + ('' if white else ' white') + '" id="video">')
        s = s[:k] + sec + s[k:]
        if any(x[0].startswith('xp:') for x in items) and 'assets/explainer.js' not in s:
            s = s.replace('</body>', '<script src="assets/explainer.js" defer></script>\n</body>')
        open(p, 'w', encoding='utf-8', newline='').write(s)
    print('videos:', len(VIDEOS), 'pages')


if __name__ == '__main__':
    run()

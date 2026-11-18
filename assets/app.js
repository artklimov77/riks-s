/* Рикс+С — общий скрипт для всех страниц.
   Каждый блок защищён проверкой наличия элементов,
   поэтому один файл безопасно подключается на любой странице. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  /* ---------- юридическое: выбор по cookie (152-ФЗ, ст. 9) ---------- */
  // Необходимые (сессия, выбор по cookie) — без согласия. Аналитические (источник визита, Яндекс Метрика) — только после «Принять все».
  const Legal = window.RiksLegal = (() => {
    const K = 'riks_cookie', ver = '2026-11-18';
    const get = () => { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } };
    return {
      ver,
      choice: () => (get() || {}).v || '',
      analytics: () => (get() || {}).v === 'all',
      set(v) { try { localStorage.setItem(K, JSON.stringify({ v, ver, at: new Date().toISOString() })); } catch (e) {} if (v !== 'all') { try { localStorage.removeItem('riks_src'); } catch (e) {} } }
    };
  })();

  /* ---------- источник трафика (UTM / реферал): в памяти; в localStorage — только с согласия на аналитику ---------- */
  const SRC = window.RiksSRC = (() => {
    try {
      const q = new URLSearchParams(location.search), utm = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => { if (q.get(k)) utm[k] = q.get(k); });
      let saved = {}; if (Legal.analytics()) { try { saved = JSON.parse(localStorage.getItem('riks_src') || '{}'); } catch (e) {} }
      if (Object.keys(utm).length) saved = { utm, ref: document.referrer || '', first: saved.first || location.pathname };
      else if (!saved.utm && document.referrer && !document.referrer.includes(location.host)) saved = { ref: document.referrer, first: saved.first || location.pathname };
      if (Legal.analytics()) { try { localStorage.setItem('riks_src', JSON.stringify(saved)); } catch (e) {} }
      return saved;
    } catch (e) { return {}; }
  })();
  // Яндекс Метрика: подключается только после согласия. Номер счётчика — в <body data-metrika="…"> или window.RIKS_METRIKA_ID.
  const loadAnalytics = () => {
    const id = document.body.dataset.metrika || window.RIKS_METRIKA_ID; if (!id || window.ym) return;
    (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(+id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  };
  if (Legal.analytics()) loadAnalytics();
  const cookieBar = () => {
    if ($('.ck')) return;
    const el = document.createElement('div'); el.className = 'ck'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Согласие на cookie');
    el.innerHTML = '<div class="ck-t"><b>Мы используем cookie</b><p>Необходимые — чтобы сайт работал. Аналитические — чтобы понимать, откуда к нам приходят (Яндекс Метрика), только с вашего согласия. Подробнее — в <a href="cookies.html">Политике cookie</a> и <a href="privacy.html">Политике обработки персональных данных</a>.</p></div>' +
      '<div class="ck-b"><button type="button" class="btn btn-line" data-ck="necessary">Только необходимые</button><button type="button" class="btn btn-ink" data-ck="all">Принять все</button></div>';
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    $$('[data-ck]', el).forEach(b => b.onclick = () => {
      Legal.set(b.dataset.ck);
      if (b.dataset.ck === 'all') { try { localStorage.setItem('riks_src', JSON.stringify(SRC)); } catch (e) {} loadAnalytics(); }
      el.classList.remove('on'); setTimeout(() => el.remove(), 300);
    });
  };
  if (!Legal.choice()) setTimeout(cookieBar, 900);
  $$('[data-cookie-settings]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); cookieBar(); }));
  const srcLabel = window.RiksSrcLabel = () => {
    const u = SRC.utm || {};
    if (u.utm_source) return u.utm_source + (u.utm_campaign ? ' / ' + u.utm_campaign : '');
    if (SRC.ref) { try { return 'реферал: ' + new URL(SRC.ref).hostname; } catch (e) { return 'реферал'; } }
    return 'прямой / сайт';
  };


  /* ---------- хедер + мобильное меню ---------- */
  const hdr = $('#hdr');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 10);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const burger = $('#burger'), mnav = $('#mnav');
  if (burger && mnav) {
    burger.onclick = () => mnav.classList.toggle('open');
    $$('a', mnav).forEach(a => a.onclick = () => mnav.classList.remove('open'));
  }

  /* ---------- бегущая строка ---------- */
  const tk = $('#tk'); if (tk) tk.innerHTML += tk.innerHTML;

  /* ---------- появление блоков при скролле ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------- счётчики ---------- */
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count; let t0;
    const step = t => { t0 ??= t; const p = Math.min((t - t0) / 1200, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { requestAnimationFrame(step); o.disconnect(); } }).observe(el);
  });

  /* ---------- режим работы (Йошкар-Ола = МСК, UTC+3) ---------- */
  const msk = new Date(Date.now() + (new Date().getTimezoneOffset() + 180) * 60000);
  const d = msk.getDay(), h = msk.getHours() + msk.getMinutes() / 60;
  const isOpen = d >= 1 && d <= 5 && h >= 9 && h < 17;
  const statusTxt = $('#statusTxt'), statusEl = $('#status');
  if (statusTxt) statusTxt.textContent = isOpen ? 'Сейчас работаем — ответим сразу' : 'Заявки принимаем круглосуточно';
  if (statusEl && !isOpen) statusEl.classList.add('closed');
  const on = $('#openNow');
  if (on) {
    on.className = 'open-now ' + (isOpen ? 'y' : 'n');
    on.textContent = isOpen ? '● Сейчас открыто' : '● Сейчас закрыто — оставьте заявку, ответим утром';
  }

  /* ---------- конструктор вывески ---------- */
  const stage = $('#stage'), sign = $('#sign'), txt = $('#signTxt');
  if (stage && sign && txt) {
    const st = { text: $('#tIn')?.value || 'Пекарня', type: stage.dataset.type || 'box', color: stage.dataset.color || '#1E4FA3', w: +stage.dataset.w || 160, power: true };
    const terms = { neon: 'срок 3–5 дней', box: 'срок 5–7 дней', letters: 'срок 7–10 дней', plate: 'срок 1–2 дня' };
    const lum = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); };
    const calc = () => {
      const len = Math.max(st.text.replace(/\s/g, '').length, 1), w = st.w;
      switch (st.type) {
        case 'neon': return 1500 + len * 900 * (w / 60);
        case 'box': { const area = (w / 100) * Math.max(w / 100 / 3.2, .45); return Math.max(15000, 5000 + area * 30000); }
        case 'letters': { const hg = Math.min(w / len * 1.15, 120); return 6000 + len * hg * 140; }
        case 'plate': return 2500 + Math.max(0, w - 50) * 35;
      }
    };
    let shown = 0, raf;
    const priceEl = $('#price');
    const animatePrice = to => {
      cancelAnimationFrame(raf);
      const from = shown, t0 = performance.now();
      const step = t => { const p = Math.min((t - t0) / 450, 1); shown = from + (to - from) * (1 - Math.pow(1 - p, 3)); if (priceEl) priceEl.textContent = 'от ' + fmt(Math.round(shown / 50) * 50) + ' ₽'; if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    const render = () => {
      const L = lum(st.color);
      sign.className = 'sign ' + st.type + (st.power ? '' : ' off');
      sign.style.setProperty('--c', st.color);
      sign.style.setProperty('--fg', L > .45 ? '#111214' : '#ffffff');
      sign.style.setProperty('--glow', L < .03 ? '#ffffff' : st.color);
      txt.textContent = st.text || 'Ваш текст';
      const W = stage.clientWidth, H = stage.clientHeight;
      const sw = W * (.26 + (st.w - 40) / 360 * .62);
      const maxH = H * .3;
      sign.style.width = sw + 'px';
      const fixedH = st.type === 'box' || st.type === 'plate';
      const sh = Math.min(sw * (st.type === 'plate' ? .32 : .24), maxH);
      sign.style.height = fixedH ? sh + 'px' : 'auto';
      txt.style.fontSize = '100px';
      const pad = st.type === 'letters' ? .98 : st.type === 'neon' ? .84 : .8;
      const fs = 100 * (sw * pad) / (txt.scrollWidth || 1);
      const cap = st.type === 'box' ? sh * .46 : st.type === 'plate' ? sh * .4 : maxH * .75;
      txt.style.fontSize = Math.min(fs, cap) + 'px';
      const ruler = $('#ruler'); if (ruler) ruler.style.width = sw + 'px';
      const rulerTxt = $('#rulerTxt'); if (rulerTxt) rulerTxt.textContent = st.w + ' см';
      const wOut = $('#wOut'); if (wOut) wOut.textContent = st.w + ' см';
      const wIn = $('#wIn'); if (wIn) wIn.style.setProperty('--p', ((st.w - 40) / 360 * 100) + '%');
      const term = $('#term'); if (term) term.textContent = terms[st.type];
      animatePrice(calc());
    };
    $('#tIn')?.addEventListener('input', e => { st.text = e.target.value; render(); });
    $('#wIn')?.addEventListener('input', e => { st.w = +e.target.value; render(); });
    const group = (sel, fn) => $$(sel).forEach(b => b.onclick = () => { $$(sel).forEach(x => x.classList.remove('on')); b.classList.add('on'); fn(b); });
    group('#types .type', b => { st.type = b.dataset.t; render(); });
    group('#sws .sw', b => { st.color = b.dataset.c; render(); });
    group('#dayNight button', b => stage.classList.toggle('night', b.dataset.v === 'night'));
    group('#power button', b => { st.power = b.dataset.v === 'on'; render(); });
    $$('#types .type').forEach(b => b.classList.toggle('on', b.dataset.t === st.type));
    $$('#sws .sw').forEach(b => b.classList.toggle('on', b.dataset.c === st.color));
    addEventListener('resize', render);
    document.fonts?.ready.then(render);
    render();

    $('#sendSign')?.addEventListener('click', () => {
      const names = { neon: 'неон', box: 'лайтбокс', letters: 'объёмные буквы', plate: 'табличка' };
      $$('#opts .opt').forEach(o => o.classList.toggle('on', o.textContent === 'Вывеска'));
      const dropTxt = $('#dropTxt'); if (dropTxt) dropTxt.textContent = `Проект: «${st.text}», ${names[st.type]}, ${st.w} см ✓`;
      setTimeout(() => $('#form [name=name]')?.focus({ preventScroll: true }), 700);
    });
  }

  /* ---------- прайс ---------- */
  const tabs = $('#tabs'), board = $('#board');
  if (tabs && board) {
    const P = {
      'Наружная реклама': [['Объёмные световые буквы','замер + фотопривязка + согласование','после замера'],['Панель-кронштейн','двусторонняя, d=500 мм',40000],['Паспорт ИК','оформление и согласование в УАиГ',7000],['Уличная табличка на дом','300×600 мм',2500],['Режим работы','200×300, наклейка на стекло',300],['Режим работы','200×300, УФ-наклейка на стекло',600],['Режим работы','300×400, УФ-печать на АКП',1050],['Режим работы','400×600, УФ-печать на АКП',1800],['Световой короб (лайтбокс)','для помещений, за 1 м²',35000]],
      'Неон': [['«Открыто»','520×160 мм','от 7 980 ₽'],['«Кофе с собой»','320×360 мм','от 8 530 ₽'],['Неоновые символы','«Кот», «Бургер», «Космонавт»…','от 5 750 ₽'],['Неон по вашему эскизу','12 цветов, настенный или подвесной','по эскизу']],
      'Транспорт': [['Реклама на автомобиле','изготовление, за 1 м²',3000],['Реклама на троллейбусе','изготовление; аренда — договор с парком',35000]],
      'Визитки': [['Визитки 1000 шт','300 г + выборочный лак, 2 стороны',4000],['Евровизитки 55×85','1000 шт',4500],['Визитки с ламинацией','1000 шт',4700],['Со скруглением углов','1000 шт',5000],['С отверстием','1000 шт',5000]],
      'Листовки и буклеты': [['Листовка А7','1000 шт, 115 г, 2 стороны',2500],['Листовка А6','1000 шт',3900],['Листовка А5','1000 шт',4500],['Листовка А4','1000 шт',8800],['Минифлаер 150×90','1000 шт',3600],['Еврофлаер 210×99','1000 шт',4100],['Буклет А6 в А7','1000 шт',4800],['Минибуклет 150×90','1000 шт',5500],['Буклет А5 в А6','1000 шт',6200],['Евробуклет','1000 шт',6800],['Лифлет А4 в накидку','1000 шт',8700],['Лифлет А4 гармошкой','1000 шт',9700],['Купон 1/3 А4','100 шт, ламинация',3030],['Подарочный сертификат А5','100 шт',9000]],
      'Стенды': [['Уголок потребителя','730×530 мм',3850],['Стенд «Антитеррор»','1000×800 мм',3200],['Стенд пожарной безопасности','1000×800 мм',3200],['Стенд ГО и ЧС','1000×800 мм',3200],['План эвакуации','600×400, фотолюминесцентный, дизайн включён',5750],['Стенд с символикой','1000×1480 мм',6670]],
      'Мобильные стенды': [['Стойка «Паук» 800×1800','стойка + полотно',4750],['Стойка «Паук» 950×1950','стойка + полотно',5550],['Стойка «Паук» 1100×2200','стойка + полотно',6750],['Доп. полотно на «Паук»','800×1800',2400],['Доп. полотно на «Паук»','950×1950',2800],['Ролл Ап 850×2000','с чехлом',9000],['Ролл Ап 1000×2000','',9300],['Ролл Ап 1200×2000','',13000],['Ролл Ап «Капля» 850×2000','',13200],['Виндер, сетка 1,8 м','наливное основание',11000],['Виндер, блэкаут 1,8 м','двусторонний',15500],['Пресс Волл 2×3 м','',15700],['Пресс Волл 2×3 м с усилением','',17400]],
      'Наклейки и печать': [['Фигурные наклейки 30 мм','200 шт',900],['Фигурные наклейки 40 мм','200 шт',1100],['Фигурные наклейки 50 мм','200 шт',1200],['Фигурные наклейки 40×55 мм','100 шт',1150],['Фигурные наклейки 50×90 мм','200 шт',2400],['Баннер 300 г','печать, за 1 м²',1000],['Самоклеящаяся плёнка','печать, за 1 м²',2000],['Плёнка с ламинацией','за 1 м²',3000],['Баннер 440–500 г','печать, за 1 м²',1300],['Баннер с проклейкой и люверсами','за 1 м²',1700]],
      'Сувениры': [['Карандаш трёхгранный','от 500 шт',35],['Ручка металлическая','от 500 шт',105],['Ручка Soft-touch','от 500 шт',108],['Кружка керамическая 330 мл','',350]]
    };
    const only = tabs.dataset.only;
    const keys = only ? only.split(',').map(s => s.trim()).filter(k => P[k]) : Object.keys(P);
    const cart = new Set();
    const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'позиция' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'позиции' : 'позиций';
    const showTab = k => {
      $$('.tab', tabs).forEach(t => t.classList.toggle('on', t.textContent === k));
      board.innerHTML = P[k].map(([n, s, p], i) => {
        const id = k + '|' + n, isOn = cart.has(id);
        return `<div class="prow" style="animation-delay:${i * 30}ms"><div class="nm">${n}${s ? `<small>${s}</small>` : ''}</div><div class="pr">${typeof p === 'number' ? fmt(p) + ' ₽' : p}</div><button class="add${isOn ? ' added' : ''}" data-id="${id}" aria-label="Добавить в расчёт">${isOn ? '✓' : '+'}</button></div>`;
      }).join('');
    };
    keys.forEach(k => { const b = document.createElement('button'); b.className = 'tab'; b.textContent = k; b.onclick = () => showTab(k); tabs.append(b); });
    showTab(keys[0]);
    board.addEventListener('click', e => {
      const b = e.target.closest('.add'); if (!b) return;
      const id = b.dataset.id;
      cart.has(id) ? cart.delete(id) : cart.add(id);
      b.classList.toggle('added', cart.has(id)); b.textContent = cart.has(id) ? '✓' : '+';
      const cartTxt = $('#cartTxt'); if (cartTxt) cartTxt.textContent = `В расчёте: ${cart.size} ${plural(cart.size)}`;
      const cartEl = $('#cart'); if (cartEl) cartEl.classList.toggle('show', cart.size > 0);
    });
  }

  /* ---------- карусель отзывов ---------- */
  const tr = $('#rvTrack');
  if (tr) {
    const by = dir => { const card = tr.querySelector('.rv'); if (card) tr.scrollBy({ left: dir * (card.offsetWidth + 16), behavior: 'smooth' }); };
    $('#rvPrev')?.addEventListener('click', () => by(-1));
    $('#rvNext')?.addEventListener('click', () => by(1));
  }

  /* ---------- формы заявки (на странице их может быть несколько) ---------- */
  $$('.opts .opt').forEach(o => o.onclick = () => o.classList.toggle('on'));
  const fileInp = $('#file');
  if (fileInp) fileInp.addEventListener('change', e => { const f = e.target.files[0]; const dropTxt = $('#dropTxt'); if (f && dropTxt) dropTxt.textContent = f.name; });

  const formatPhone = ph => {
    let v = ph.value.replace(/\D/g, ''); if (v.startsWith('8')) v = '7' + v.slice(1); if (!v.startsWith('7')) v = '7' + v; v = v.slice(0, 11);
    const m = v.match(/^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
    ph.value = '+7' + (m[1] ? ' (' + m[1] : '') + (m[1].length === 3 ? ') ' : '') + m[2] + (m[3] ? '-' + m[3] : '') + (m[4] ? '-' + m[4] : '');
  };
  $$('input[inputmode="tel"]').forEach(ph => ph.addEventListener('input', () => formatPhone(ph)));

  $$('form.form').forEach(form => {
    const pdIn = form.querySelector('input[name=pd]'); if (pdIn) pdIn.addEventListener('change', () => pdIn.closest('.consent')?.classList.remove('bad'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const ph = form.querySelector('input[inputmode="tel"]');
      if (ph && ph.value.replace(/\D/g, '').length < 11) { ph.style.borderColor = '#C8102E'; ph.focus(); return; }
      // согласие на обработку ПДн — отдельной галочкой (152-ФЗ, ст. 9), без неё заявку не отправляем
      const pd = form.querySelector('input[name=pd]');
      if (pd && !pd.checked) { const l = pd.closest('.consent'); if (l) { l.classList.add('bad'); l.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
      const dropTxt = $('#dropTxt')?.textContent || '';
      const data = {
        name: (form.querySelector('[name=name]')?.value || '').trim(),
        phone: ph ? ph.value : '',
        service: $$('.opt.on', form).map(o => o.textContent.trim()).join(', '),
        detail: dropTxt.includes('Проект:') ? dropTxt.replace('✓', '').trim() : '',
        page: location.pathname.replace(/^\//, '') || 'index.html',
        source: srcLabel(),
        utm: SRC.utm || {},
        ref: SRC.ref || '',
        ts: new Date().toISOString(),
        consent: { pd: true, ver: Legal.ver, at: new Date().toISOString(), page: location.pathname }
      };
      const finish = async extra => {
        Object.assign(data, extra || {});
        form.classList.add('done');
        const cartEl = $('#cart'); if (cartEl) cartEl.classList.remove('show');
        try {
          await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        } catch (err) { /* бэкенд недоступен (локально/оффлайн) — UX не блокируем */ }
      };
      // перед отправкой — короткий квиз по услуге (assets/quiz.js); квиз сам отправит заявку через finish
      if (window.RiksQuiz && !form.dataset.noquiz) { window.RiksQuiz.open({ name: data.name, phone: data.phone, service: data.service, onDone: finish, pd: true }); return; }
      finish();
    });
  });

  /* ---------- фильтр галереи ---------- */
  const galFilter = $('.gal-filter');
  if (galFilter) {
    const figs = $$('.gal figure');
    galFilter.addEventListener('click', e => {
      const b = e.target.closest('.fb'); if (!b) return;
      $$('.fb', galFilter).forEach(x => x.classList.toggle('on', x === b));
      const cat = b.dataset.cat;
      figs.forEach(f => f.classList.toggle('hide', cat !== 'all' && f.dataset.cat !== cat));
    });
  }

  /* ---------- лайтбокс для галерей ---------- */
  const galFigs = $$('.gal figure, .strip figure');
  if (galFigs.length) {
    const box = document.createElement('div');
    box.className = 'lbox';
    box.innerHTML = '<button class="x" aria-label="Закрыть">✕</button><button class="nav prev" aria-label="Назад">‹</button><img alt=""><button class="nav next" aria-label="Вперёд">›</button><div class="cap"></div>';
    document.body.appendChild(box);
    const bImg = box.querySelector('img'), bCap = box.querySelector('.cap');
    let list = [], idx = 0;
    const show = i => {
      idx = (i + list.length) % list.length;
      const fig = list[idx], im = fig.querySelector('img'), cap = fig.querySelector('figcaption');
      bImg.src = im.src; bCap.textContent = cap ? cap.textContent : (im.alt || '');
    };
    const open = fig => {
      list = $$('figure', fig.parentElement).filter(f => !f.classList.contains('hide'));
      show(list.indexOf(fig)); box.classList.add('open');
    };
    galFigs.forEach(f => f.addEventListener('click', () => open(f)));
    box.querySelector('.next').onclick = e => { e.stopPropagation(); show(idx + 1); };
    box.querySelector('.prev').onclick = e => { e.stopPropagation(); show(idx - 1); };
    box.querySelector('.x').onclick = () => box.classList.remove('open');
    box.addEventListener('click', e => { if (e.target === box) box.classList.remove('open'); });
    addEventListener('keydown', e => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') box.classList.remove('open');
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
    });
  }
})();

/* ---------- hero-сцена: тигр собирает вывеску (цикл) ---------- */
(() => {
  const sc = document.getElementById('scene'); if (!sc) return;
  const word = document.getElementById('scWord'), sparks = document.getElementById('scSparks');
  const WORDS = ['Пекарня', 'Кофейня', 'Аптека', 'Цветы', 'Ваш бизнес'];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spark = el => {
    const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('i');
      s.style.left = (r.left - b.left + r.width / 2) + 'px'; s.style.top = (r.bottom - b.top - 4) + 'px';
      s.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); s.style.setProperty('--dy', (Math.random() * 40 - 10) + 'px');
      sparks.appendChild(s); setTimeout(() => s.remove(), 650);
    }
  };
  let n = 0;
  async function loop() {
    for (;;) {
      const w = WORDS[n++ % WORDS.length];
      sc.className = sc.className.replace(/\b(lit|wave|out|measure|drilling)\b/g, '').trim();
      word.innerHTML = [...w].map(ch => '<span>' + (ch === ' ' ? '&nbsp;' : ch) + '</span>').join('');
      if (reduce) { sc.classList.add('peek', 'lit', 'wave'); return; }
      await wait(300); sc.classList.add('peek', 'measure');
      await wait(500);
      sc.classList.add('drilling');
      for (const sp of word.children) { sp.classList.add('in'); setTimeout(() => spark(sp), 320); await wait(170); }
      await wait(250); sc.classList.remove('drilling');
      await wait(500); sc.classList.add('lit');
      await wait(450); sc.classList.add('wave');
      await wait(3200); sc.classList.add('out'); sc.classList.remove('wave');
      await wait(450);
    }
  }
  // запускаем, когда сцена видна
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); loop(); } }, { threshold: .3 });
  io.observe(sc);
})();

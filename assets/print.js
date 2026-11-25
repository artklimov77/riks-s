/* Рикс+С — каталог полиграфии: карточки, расчёт тиража, заказ с макетом → заявка в CRM.
   Данные — assets/print-data.js (tools/print_catalog.py). */
(() => {
  const D = window.RIKS_PRINT, grid = document.getElementById('pcGrid'), cats = document.getElementById('pcCats'), modal = document.getElementById('pcModal');
  if (!D || !grid || !modal) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  const qty = n => n.toLocaleString('ru-RU').replace(/,/g, ' ');
  const per = (p, q) => { const v = p / q; return (v < 10 ? v.toFixed(2).replace('.', ',') : Math.round(v)) + ' ₽/шт'; };
  const ICON = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    tpl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><rect x="7.5" y="7.5" width="9" height="9" stroke-dasharray="2 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>'
  };

  /* ---------- иллюстрация формата: стопка листов в фирменном стиле ---------- */
  let uid = 0;
  function mock(item, variant) {
    const f = D.fmt[item.f] || { w: 90, h: 50, f: [] }, id = 'pg' + (++uid);
    const VW = 240, VH = 170, max = { w: 150, h: 112 };
    const k = Math.min(max.w / f.w, max.h / f.h), w = f.w * k, h = f.h * k;
    const x = (VW - w) / 2 - 6, y = (VH - h) / 2 - 4;
    const vn = (variant || '').toLowerCase();
    const round = /скругл/.test(vn) || /kal-karm/.test(item.id) ? Math.min(w, h) * 0.09 : 2;
    const band = Math.max(8, h * 0.2);
    const sheet = (dx, dy, op) => f.c
      ? `<circle cx="${x + w / 2 + dx}" cy="${y + h / 2 + dy}" r="${w / 2}" fill="#fff" stroke="#e7d9cc" opacity="${op}"/>`
      : `<rect x="${x + dx}" y="${y + dy}" width="${w}" height="${h}" rx="${round}" fill="#fff" stroke="#e7d9cc" opacity="${op}"/>`;
    let s = `<svg viewBox="0 0 ${VW} ${VH}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A00"/><stop offset=".5" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E3241B"/></linearGradient>` +
      `<clipPath id="${id}c">${f.c ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round}"/>`}</clipPath></defs>` +
      `<ellipse cx="${VW / 2}" cy="${y + h + 16}" rx="${w * 0.55}" ry="5" fill="#1a1513" opacity=".07"/>` +
      sheet(14, 10, .55) + sheet(7, 5, .8) + sheet(0, 0, 1) +
      `<g clip-path="url(#${id}c)">`;
    if (f.c) {
      s += `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w * 0.36}" fill="url(#${id})"/>` +
        `<path d="M${x + w * 0.36} ${y + h * 0.52}l${w * 0.1} ${w * 0.1} ${w * 0.18}-${w * 0.2}" fill="none" stroke="#fff" stroke-width="${Math.max(2, w * 0.05)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${band}" fill="url(#${id})"/>`;
      const lx = x + Math.max(8, w * 0.1), lw = w - 2 * Math.max(8, w * 0.1), lh = Math.max(3, Math.min(6, h * 0.05));
      const rows = Math.max(2, Math.min(6, Math.floor((h - band - 14) / (lh * 2.6))));
      for (let i = 0; i < rows; i++) {
        const yy = y + band + 10 + i * lh * 2.6, ww = i === 0 ? lw * 0.62 : lw * (i % 3 === 2 ? 0.55 : 0.88);
        s += `<rect x="${lx}" y="${yy}" width="${ww}" height="${lh}" rx="${lh / 2}" fill="${i === 0 ? '#1a1513' : '#e9ddd2'}"/>`;
      }
      (f.f || []).forEach(fx => {
        const X = x + fx * k;
        s += `<rect x="${X}" y="${y}" width="${Math.min(w - (X - x), fx * k)}" height="${h}" fill="#1a1513" opacity=".035"/><line x1="${X}" y1="${y}" x2="${X}" y2="${y + h}" stroke="#c9b6a6" stroke-dasharray="3 3"/>`;
      });
      if (/отверст/.test(vn)) s += `<circle cx="${x + w - 10}" cy="${y + band / 2}" r="3.4" fill="#f6efe8" stroke="#c9b6a6"/>`;
      if (/ламин|глянец|мат/.test(vn)) s += `<path d="M${x + w * 0.55} ${y} L${x + w * 0.75} ${y} L${x + w * 0.35} ${y + h} L${x + w * 0.15} ${y + h} Z" fill="#fff" opacity=".28"/>`;
    }
    return s + '</g></svg>';
  }

  /* ---------- карточки ---------- */
  const from = it => { const t = (it.v[0] || {}).t || []; return t.length ? t[0] : null; };
  let curCat = '';
  function renderCats() {
    const all = ['Все'].concat(D.cats);
    cats.innerHTML = all.map(c => `<button type="button" role="tab" class="pc-cat${(c === 'Все' ? '' : c) === curCat ? ' on' : ''}" data-c="${esc(c === 'Все' ? '' : c)}" aria-selected="${(c === 'Все' ? '' : c) === curCat}">${esc(c)}</button>`).join('');
    $$('.pc-cat', cats).forEach(b => b.onclick = () => { curCat = b.dataset.c; renderCats(); renderGrid(); });
  }
  function renderGrid() {
    const list = D.items.filter(it => !curCat || it.c === curCat);
    grid.innerHTML = list.map(it => {
      const f = from(it);
      return `<article class="pc-card" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.n)} — рассчитать">` +
        `<div class="pc-pic">${mock(it)}${it.b ? '<span class="pc-tag">2 стороны без доплаты</span>' : ''}</div>` +
        `<div class="pc-body"><span class="pc-c">${esc(it.c)}</span><h3>${esc(it.n)}</h3><p class="pc-s">${esc(it.s)}</p>` +
        `<div class="pc-ft">${f ? `<div class="pc-price"><b>от ${rub(f[1])}</b><span>за ${qty(f[0])} шт</span></div>` : '<div class="pc-price"><b>по запросу</b><span>посчитаем за 15 минут</span></div>'}` +
        `<span class="pc-go">${f ? 'Рассчитать' : 'Узнать цену'}</span></div></div></article>`;
    }).join('');
    $$('.pc-card', grid).forEach(c => {
      c.onclick = () => open(c.dataset.id);
      c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c.dataset.id); } };
    });
  }

  /* ---------- окно заказа ---------- */
  let S = null, lastFocus = null;
  const REQ = [
    ['Форматы', 'PDF (шрифты в кривых), TIFF, JPG, CDR (до версии 14), EPS. Не принимаем DOC, XLS, PPT и PDF из онлайн-редакторов.'],
    ['Размер', 'Макет — с вылетами по 1 мм с каждой стороны (визитка 90×50 → файл 92×52 мм). Текст и логотипы — не ближе 4 мм к линии реза. Без меток реза и рамок по краю: из-за допуска резки 1–2 мм рамка выйдет кривой.'],
    ['Цвет', 'CMYK, 300 dpi. Мелкий чёрный текст и QR-код — только чёрной краской (C0 M0 Y0 K100). Глубокий чёрный фон — C60 M50 Y50 K100. Суммарная красочность — не больше 280%.'],
    ['Файл', 'Слои сведены, без прозрачностей, теней, линз и скрытых объектов. Шрифт — не мельче 6 пт.'],
    ['Если не подходит', 'Проверим макет до оплаты и подскажем, что поправить. Файл, который не проходит требования, в печать не запускаем — так тираж не уйдёт в брак.']
  ];
  function open(id) {
    const it = D.items.find(x => x.id === id); if (!it) return;
    const hasT = it.v.length && it.v[0].t.length;
    S = { it, vi: 0, ti: 0, urgent: false, maket: 'have', files: [], deliv: 'pickup', pay: 'cash', step: 'form' };
    if (hasT) { const t = it.v[0].t; S.ti = Math.min(t.length - 1, t.findIndex(x => x[0] >= 1000) < 0 ? 0 : t.findIndex(x => x[0] >= 1000)); }
    lastFocus = document.activeElement;
    modal.hidden = false; document.documentElement.classList.add('pc-lock');
    requestAnimationFrame(() => modal.classList.add('on'));
    draw();
    setTimeout(() => { const b = $('.pcm-x', modal); if (b) b.focus(); }, 50);
  }
  function close() {
    modal.classList.remove('on'); document.documentElement.classList.remove('pc-lock');
    setTimeout(() => { modal.hidden = true; modal.innerHTML = ''; }, 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  const opt = (name, val, cur, title, sub, ic) => `<label class="pcm-opt${val === cur ? ' on' : ''}"><input type="radio" name="${name}" value="${val}"${val === cur ? ' checked' : ''}>` +
    (ic ? `<span class="pcm-oi">${ic}</span>` : '') + `<span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;

  function tiers() { const v = S.it.v[S.vi]; return v ? v.t : []; }
  function summary() {
    const t = tiers()[S.ti];
    if (!t) return { main: 'Цену назовёт менеджер', sub: S.it.n };
    if (S.urgent) return { main: 'от ' + rub(t[1]) + ' + срочность', sub: qty(t[0]) + ' шт · срочно — цену уточнит менеджер' };
    return { main: rub(t[1]), sub: qty(t[0]) + ' шт · ' + per(t[1], t[0]) + ' · 6–8 рабочих дней' };
  }

  function draw() {
    if (S.step === 'done') return drawDone();
    const it = S.it, v = it.v, t = tiers(), sm = summary();
    const fm = D.fmt[it.f] || {};
    const best = t.length > 1 ? t.reduce((b, x, i) => (x[1] / x[0] < t[b][1] / t[b][0] ? i : b), 0) : -1;
    modal.innerHTML =
      `<div class="pcm" role="document"><button type="button" class="pcm-x" aria-label="Закрыть">${ICON.x}</button>` +
      `<div class="pcm-head"><div class="pcm-pic">${mock(it, (v[S.vi] || {}).n)}</div><div><span class="pc-c">${esc(it.c)}</span><h3 id="pcmTitle">${esc(it.n)}</h3><p>${esc(it.s)}${it.p ? ' · ' + esc(it.p) : ''}</p>${it.b ? '<p class="pcm-b">Печать с двух сторон — по цене одной</p>' : ''}</div></div>` +
      `<form class="pcm-form" novalidate>` +
      (v.length > 1 ? `<fieldset class="pcm-f"><legend>Вариант</legend><div class="pcm-chips">${v.map((x, i) => `<button type="button" class="pcm-chip${i === S.vi ? ' on' : ''}" data-vi="${i}">${esc(x.n)}</button>`).join('')}</div></fieldset>` : '') +
      (t.length ? `<fieldset class="pcm-f"><legend>Тираж</legend><div class="pcm-tiers">${t.map((x, i) => `<button type="button" class="pcm-tier${i === S.ti ? ' on' : ''}" data-ti="${i}"><b>${qty(x[0])} шт</b><span>${rub(x[1])}</span><small>${per(x[1], x[0])}</small>${i === best && best > 0 ? '<i>выгоднее</i>' : ''}</button>`).join('')}</div>` +
        `<p class="pcm-note">Нужен другой тираж? Напишите в комментарии — посчитаем.</p></fieldset>` :
        `<fieldset class="pcm-f"><legend>Что нужно</legend><textarea name="what" rows="2" class="pcm-in" placeholder="Тираж, размер, бумага — что знаете. Посчитаем и пришлём цену."></textarea></fieldset>`) +
      `<fieldset class="pcm-f"><legend>Срок</legend><div class="pcm-opts two">${opt('urg', '0', S.urgent ? '1' : '0', '6–8 рабочих дней', t.length ? 'по цене каталога' : 'стандартный срок')}${opt('urg', '1', S.urgent ? '1' : '0', 'Срочно, 2–4 дня', 'дороже — цену назовёт менеджер')}</div></fieldset>` +
      `<fieldset class="pcm-f"><legend>Макет</legend><div class="pcm-opts three">${opt('mk', 'have', S.maket, 'Есть готовый', 'загрузить на проверку', ICON.up)}${opt('mk', 'design', S.maket, 'Нужен дизайн', 'нарисуем, стоимость скажем заранее', ICON.pen)}${opt('mk', 'self', S.maket, 'Нарисую сам', 'шаблон и требования', ICON.tpl)}</div>` +
      `<div class="pcm-mk">${mkPanel(it, fm)}</div></fieldset>` +
      `<fieldset class="pcm-f"><legend>Получение</legend><div class="pcm-opts three">${opt('dl', 'pickup', S.deliv, 'Самовывоз', 'Комсомольская, 134, оф. 115')}${opt('dl', 'city', S.deliv, 'По Йошкар-Оле', 'привезём в офис или магазин')}${opt('dl', 'russia', S.deliv, 'По России', 'транспортной компанией')}</div>` +
      (S.deliv !== 'pickup' ? `<input class="pcm-in" name="addr" placeholder="${S.deliv === 'russia' ? 'Город, адрес или пункт выдачи, получатель' : 'Адрес доставки'}" value="${esc(S.addr || '')}">` : '') + `</fieldset>` +
      `<fieldset class="pcm-f"><legend>Оплата</legend><div class="pcm-opts two">${opt('pay', 'cash', S.pay, 'Наличные или карта', 'при получении, СБП')}${opt('pay', 'invoice', S.pay, 'По счёту', 'для организаций и ИП, с документами')}</div>` +
      (S.pay === 'invoice' ? `<div class="pcm-row"><input class="pcm-in" name="org" placeholder="Название организации или ИП" value="${esc(S.org || '')}"><input class="pcm-in" name="inn" inputmode="numeric" placeholder="ИНН" value="${esc(S.inn || '')}"></div>` : '') + `</fieldset>` +
      `<fieldset class="pcm-f"><legend>Куда прислать подтверждение</legend><div class="pcm-row"><input class="pcm-in" name="name" autocomplete="name" placeholder="Имя" value="${esc(S.name || '')}"><input class="pcm-in" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="${esc(S.phone || '')}"></div>` +
      `<div class="pcm-chips sm">${['Позвонить', 'MAX', 'ВКонтакте', 'Почта'].map(c => `<button type="button" class="pcm-chip${(S.contact || 'Позвонить') === c ? ' on' : ''}" data-ct="${c}">${c}</button>`).join('')}</div>` +
      ((S.contact === 'Почта') ? `<input class="pcm-in" name="email" type="email" placeholder="E-mail" value="${esc(S.email || '')}">` : '') +
      `<textarea class="pcm-in" name="comment" rows="2" placeholder="Комментарий: бумага, другой тираж, пожелания">${esc(S.comment || '')}</textarea>` +
      `<label class="consent pcm-consent"><input type="checkbox" name="pd"${S.pd ? ' checked' : ''}><span>Даю <a href="soglasie.html" target="_blank">согласие на обработку персональных данных</a> и принимаю <a href="privacy.html" target="_blank">Политику обработки персональных данных</a></span></label></fieldset>` +
      `</form>` +
      `<div class="pcm-bar"><div class="pcm-sum"><b>${sm.main}</b><span>${esc(sm.sub)}</span></div><button type="button" class="btn btn-ink pcm-send">${t.length ? 'Отправить заказ' : 'Узнать цену'}</button></div>` +
      `<p class="pcm-err" role="alert" hidden></p></div>`;
    bind();
  }

  function mkPanel(it, fm) {
    if (S.maket === 'design') return `<p class="pcm-hint">Дизайнер свяжется, уточнит пожелания и назовёт стоимость до начала работы. Есть логотип, фото или пример — прикрепите ниже.</p>` + filesBox();
    if (S.maket === 'self') {
      const tp = it.tpl ? `<div class="pcm-tpl"><span class="pcm-tpl-ic">${ICON.tpl}</span><div><b>Шаблон: ${esc(it.s)}</b><small>Вылеты 1 мм, безопасная зона 4 мм${(fm.f || []).length ? ', линии сгиба' : ''}. Разметку удалите перед отправкой.</small></div>` +
        `<a href="shablony/${it.tpl}.pdf" download>${ICON.dl}PDF</a><a href="shablony/${it.tpl}.svg" download>${ICON.dl}SVG</a></div>` : `<p class="pcm-hint">Шаблон под этот формат пришлём по запросу — укажите размер в комментарии.</p>`;
      return tp + `<details class="pcm-req"><summary>Технические требования к макету</summary><dl>${REQ.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl></details>` +
        `<p class="pcm-hint">Готовый файл можно прикрепить сейчас или прислать позже в MAX или на почту.</p>` + filesBox();
    }
    return `<p class="pcm-hint">Проверим файл по требованиям до оплаты: размер, вылеты, цвет, шрифты. <button type="button" class="pcm-link" data-req>Требования к макету</button></p>` + filesBox() +
      `<details class="pcm-req" hidden><summary>Технические требования к макету</summary><dl>${REQ.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl></details>`;
  }
  function filesBox() {
    return `<div class="pcm-files">${S.files.map((f, i) => `<div class="pcm-file"><span>${ICON.file}</span><b>${esc(f.name)}</b><small>${(f.size / 1048576).toFixed(f.size > 1048576 ? 1 : 2)} МБ</small><button type="button" aria-label="Убрать файл" data-rm="${i}">${ICON.x}</button><i class="pcm-prog"><em></em></i></div>`).join('')}` +
      (S.files.length < 3 ? `<label class="pcm-drop"><input type="file" multiple accept=".pdf,.tif,.tiff,.jpg,.jpeg,.png,.cdr,.eps,.ai,.psd,.svg,.zip,.rar,.7z">${ICON.up}<span>Прикрепить файл <small>PDF, TIFF, JPG, CDR, EPS, ZIP · до 100 МБ</small></span></label>` : '') + `</div>`;
  }

  function keep() {
    const f = $('.pcm-form', modal); if (!f) return;
    ['addr', 'org', 'inn', 'name', 'phone', 'email', 'comment', 'what'].forEach(n => { const el = f.elements[n]; if (el) S[n] = el.value; });
    const pd = f.elements.pd; if (pd) S.pd = pd.checked;
  }
  function redraw() { keep(); const sc = $('.pcm', modal)?.scrollTop || 0; draw(); const m = $('.pcm', modal); if (m) m.scrollTop = sc; }

  function bind() {
    $('.pcm-x', modal).onclick = close;
    $$('[data-vi]', modal).forEach(b => b.onclick = () => { S.vi = +b.dataset.vi; const t = tiers(); S.ti = Math.min(S.ti, t.length - 1); redraw(); });
    $$('[data-ti]', modal).forEach(b => b.onclick = () => { S.ti = +b.dataset.ti; redraw(); });
    $$('[data-ct]', modal).forEach(b => b.onclick = () => { S.contact = b.dataset.ct; redraw(); });
    $$('input[type=radio]', modal).forEach(r => r.onchange = () => {
      if (r.name === 'urg') S.urgent = r.value === '1';
      if (r.name === 'mk') S.maket = r.value;
      if (r.name === 'dl') S.deliv = r.value;
      if (r.name === 'pay') S.pay = r.value;
      redraw();
    });
    const rq = $('[data-req]', modal); if (rq) rq.onclick = () => { const d = $('.pcm-req', modal); d.hidden = false; d.open = true; };
    $$('[data-rm]', modal).forEach(b => b.onclick = () => { S.files.splice(+b.dataset.rm, 1); redraw(); });
    const fi = $('.pcm-drop input', modal);
    if (fi) fi.onchange = () => {
      const err = [];
      [...fi.files].forEach(f => {
        if (S.files.length >= 3) return;
        if (f.size > 100 * 1048576) { err.push(f.name + ' — больше 100 МБ'); return; }
        S.files.push(f);
      });
      redraw(); if (err.length) showErr('Не прикрепили: ' + err.join('; ') + '. Большой файл пришлите ссылкой на облако в комментарии.');
    };
    const ph = $('input[name=phone]', modal);
    if (ph) ph.addEventListener('input', () => {
      let d = ph.value.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d && d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
      const m = d.slice(1).match(/(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
      ph.value = !d ? '' : '+7' + (m[1] ? ' (' + m[1] : '') + (m[1].length === 3 ? ') ' : '') + m[2] + (m[3] ? '-' + m[3] : '') + (m[4] ? '-' + m[4] : '');
    });
    $('.pcm-send', modal).onclick = send;
  }
  function showErr(t, el) {
    const e = $('.pcm-err', modal); if (!e) return; e.textContent = t; e.hidden = !t;
    if (el) { el.classList.add('bad'); el.focus(); el.addEventListener('input', () => el.classList.remove('bad'), { once: true }); }
  }

  /* ---------- отправка: файлы → заявка ---------- */
  function putFile(url, file, onp) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('PUT', url);
      x.upload.onprogress = e => { if (e.lengthComputable) onp(e.loaded / e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? res() : rej(new Error('HTTP ' + x.status)));
      x.onerror = () => rej(new Error('сеть')); x.send(file);
    });
  }
  async function uploadAll() {
    const out = [], fail = [];
    const rows = $$('.pcm-file', modal);
    for (let i = 0; i < S.files.length; i++) {
      const f = S.files[i], bar = rows[i] && rows[i].querySelector('.pcm-prog em');
      try {
        const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'upload', name: f.name, size: f.size }) });
        const j = await r.json().catch(() => ({}));
        if (!j.ok || !j.url) throw new Error(j.error || 'нет ссылки');
        await putFile(j.url, f, p => { if (bar) bar.style.width = Math.round(p * 100) + '%'; });
        out.push({ name: f.name, path: j.path, size: f.size });
      } catch (e) { fail.push(f.name); }
    }
    return { out, fail };
  }
  async function send() {
    keep();
    const f = $('.pcm-form', modal), btn = $('.pcm-send', modal);
    if (S.deliv !== 'pickup' && !(S.addr || '').trim()) return showErr('Укажите адрес доставки', f.elements.addr);
    if (S.pay === 'invoice' && !(S.org || '').trim()) return showErr('Укажите организацию для счёта', f.elements.org);
    if ((S.phone || '').replace(/\D/g, '').length < 11) return showErr('Укажите телефон — пришлём подтверждение', f.elements.phone);
    if (S.contact === 'Почта' && !/.+@.+\..+/.test(S.email || '')) return showErr('Укажите e-mail', f.elements.email);
    if (!S.pd) { const c = $('.pcm-consent', modal); c.classList.add('bad'); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); return showErr('Нужно согласие на обработку персональных данных'); }
    showErr('');
    btn.disabled = true; btn.textContent = S.files.length ? 'Загружаем файлы…' : 'Отправляем…';
    const up = S.files.length ? await uploadAll() : { out: [], fail: [] };
    const it = S.it, v = it.v[S.vi], t = tiers()[S.ti];
    const L = { have: 'есть готовый — на проверку', design: 'нужен дизайн', self: 'клиент рисует сам (шаблон)' };
    const DL = { pickup: 'самовывоз', city: 'доставка по Йошкар-Оле', russia: 'доставка по России (ТК)' };
    const q = [['Позиция', it.n + ' · ' + it.s]];
    if (it.v.length > 1 && v) q.push(['Вариант', v.n]);
    if (t) q.push(['Тираж', qty(t[0]) + ' шт'], ['Цена по каталогу', rub(t[1]) + (S.urgent ? ' (без срочности)' : '')]);
    if (S.what) q.push(['Что нужно', S.what]);
    q.push(['Срок', S.urgent ? 'СРОЧНО 2–4 дня — назвать цену' : '6–8 рабочих дней']);
    if (it.b) q.push(['Печать', 'двусторонняя (без доплаты)']);
    q.push(['Макет', L[S.maket] + (up.out.length ? ' · файлов: ' + up.out.length : '') + (up.fail.length ? ' · НЕ загрузились: ' + up.fail.join(', ') : '')]);
    q.push(['Получение', DL[S.deliv] + (S.addr ? ': ' + S.addr : '')]);
    q.push(['Оплата', S.pay === 'invoice' ? 'по счёту: ' + (S.org || '') + (S.inn ? ', ИНН ' + S.inn : '') : 'наличные / карта']);
    if (S.email) q.push(['E-mail', S.email]);
    if (S.comment) q.push(['Комментарий', S.comment]);
    const SRC = window.RiksSRC || {}, Lg = window.RiksLegal || {};
    const data = {
      name: (S.name || '').trim(), phone: S.phone, service: 'Полиграфия: ' + it.n + (t ? ', ' + qty(t[0]) + ' шт' : ''),
      detail: q.map(x => x[0] + ': ' + x[1]).join('\n'), quiz: q.map(x => ({ q: x[0], a: x[1] })), contact: S.contact || 'Позвонить',
      files: up.out, page: location.pathname.replace(/^\//, '') || 'poligrafiya.html',
      source: (window.RiksSrcLabel ? window.RiksSrcLabel() : 'сайт') + ' · каталог полиграфии', utm: SRC.utm || {}, ref: SRC.ref || '',
      ts: new Date().toISOString(), consent: { pd: true, ver: Lg.ver || '', at: new Date().toISOString(), page: location.pathname }
    };
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      S.step = 'done'; S.fail = up.fail; draw();
      try { if (window.ym && document.body.dataset.metrika) window.ym(+document.body.dataset.metrika, 'reachGoal', 'print_order'); } catch (e) {}
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Отправить заказ';
      showErr('Не получилось отправить. Позвоните +7 967 758-27-26 или напишите в MAX — примем заказ.');
    }
  }
  function drawDone() {
    const t = tiers()[S.ti];
    modal.innerHTML = `<div class="pcm pcm-done" role="document"><button type="button" class="pcm-x" aria-label="Закрыть">${ICON.x}</button>` +
      `<span class="pcm-ok">${ICON.ok}</span><h3 id="pcmTitle">Заказ принят</h3>` +
      `<p>${esc(S.it.n)}${t ? ', ' + qty(t[0]) + ' шт' : ''}. ${S.maket === 'have' ? 'Проверим макет и' : 'Менеджер'} свяжется с вами в рабочее время (пн–пт 9:00–17:00)${S.pay === 'invoice' ? ' и пришлёт счёт' : ''}.</p>` +
      ((S.fail || []).length ? `<p class="pcm-warn">Файл «${esc(S.fail.join('», «'))}» не загрузился — пришлите его в MAX или на почту, когда менеджер напишет.</p>` : '') +
      `<button type="button" class="btn btn-ink pcm-close2">Хорошо</button></div>`;
    $('.pcm-x', modal).onclick = close; $('.pcm-close2', modal).onclick = close;
  }

  /* карточки «Что печатаем» ведут в нужный раздел каталога */
  const MAP = [[/визитк/i, 'Визитки'], [/листовк|флаер/i, 'Листовки и флаеры'], [/буклет|лифлет/i, 'Буклеты и лифлеты'], [/купон|календар/i, 'Открытки и купоны'], [/наклейк/i, 'Наклейки']];
  $$('#types .s-card, #types article, #types a').forEach(c => {
    const h = c.querySelector('h3'); if (!h) return; const m = MAP.find(x => x[0].test(h.textContent)); if (!m) return;
    c.style.cursor = 'pointer';
    c.addEventListener('click', e => { e.preventDefault(); curCat = m[1]; renderCats(); renderGrid(); document.getElementById('katalog').scrollIntoView({ behavior: 'smooth' }); });
  });
  renderCats(); renderGrid();
  window.RiksPrint = { open };
})();

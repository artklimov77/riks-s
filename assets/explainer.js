/* Рикс+С — обучающие ролики «без человека»: анимированные шаги (SVG + CSS), тихий звук смены шага (Web Audio).
   Без видеофайлов. Разметка: <div class="xp" data-xp="poligrafiya"></div> — ролик из XP ниже. */
(() => {
  const roots = document.querySelectorAll('.xp[data-xp]');
  if (!roots.length) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const I = { // линейные иконки 24×24
    ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    frame: '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10" stroke-dasharray="2 2"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
    type: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 15l2 2 4-4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C21 6 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10" cy="7.5" r="1.2"/><circle cx="14.5" cy="7.5" r="1.2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    fire: '<path d="M12 3s5 4.5 5 9.5a5 5 0 0 1-10 0C7 9 9 7.5 9 7.5s.5 3 2.5 3.5C11 8 12 3 12 3z"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
    book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h6M8 12h6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'
  };
  const XP = {
    poligrafiya: { t: 'Как подготовить макет к печати', steps: [
      { ic: 'ruler', k: 'bleed', t: 'Добавьте вылеты', d: 'По 1 мм с каждой стороны: визитка 90×50 → файл 92×52 мм. Фон — до самого края файла.' },
      { ic: 'frame', k: 'safe', t: 'Безопасная зона', d: 'Текст и логотипы — не ближе 4 мм к линии реза. Рамки по краю не делайте: резка ±1–2 мм.' },
      { ic: 'drop', k: 'cmyk', t: 'Цвет — CMYK, 300 dpi', d: 'Мелкий чёрный текст и QR — только чёрной краской K100. Так буквы будут чёткими.' },
      { ic: 'type', k: 'curves', t: 'Шрифты в кривых', d: 'Слои сведены, без прозрачностей и теней. Шрифт — не мельче 6 пт.' },
      { ic: 'file', k: 'send', t: 'PDF, TIFF, JPG или CDR', d: 'Загрузите файл в заказ — проверим до оплаты и подскажем, если что-то поправить.' }] },
    neon: { t: 'Как мы делаем неоновую вывеску', steps: [
      { ic: 'pen', t: 'Эскиз', d: 'Название, логотип или фраза — рисуем макет и показываем, как неон будет смотреться на месте.' },
      { ic: 'palette', t: 'Цвет и размер', d: 'Подбираем цвет свечения и размер под витрину или интерьер.' },
      { ic: 'bolt', t: 'Гибкий неон', d: 'Безопасный гибкий неон: не бьётся, не греется, светит ровно.' },
      { ic: 'plug', t: 'Питание 12 В', d: 'Безопасное низковольтное питание. Проверяем свечение перед выдачей.' },
      { ic: 'tool', t: 'Монтаж под ключ', d: 'Повесим на стену, в витрину или подвесом — или отдадим готовый к установке.' }] },
    stendy: { t: 'Какие стенды нужны организации', steps: [
      { ic: 'book', t: 'Уголок потребителя', d: 'Для магазинов, кафе, салонов и сферы услуг — по закону о защите прав потребителей.' },
      { ic: 'fire', t: 'Пожарная безопасность', d: 'Правила, действия при пожаре и план эвакуации — то, что спрашивают при проверке.' },
      { ic: 'shield', t: 'ГО и ЧС, антитеррор', d: 'Обязательны для школ, детсадов, больниц и учреждений.' },
      { ic: 'alert', t: 'Свой комплект под вас', d: 'Набор зависит от типа учреждения — подскажем, что обязательно именно вам.' },
      { ic: 'chat', t: 'Получите список', d: 'Пришлём чек-лист и расчёт комплекта. Безнал и закрывающие документы.' }] }
  };
  const STEP = 5200;
  const SV = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const IC_PAUSE = SV('<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
    IC_PLAY = SV('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
    IC_AGAIN = SV('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    IC_SND = SV('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    IC_MUTE = SV('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');

  // анимированная схема визитки для ролика про макет
  const diagram = k => `<svg class="xp-dg xp-dg-${k}" viewBox="0 0 260 170" aria-hidden="true">
    <rect class="dg-bleed" x="20" y="15" width="220" height="140" rx="2"/>
    <rect class="dg-card" x="30" y="25" width="200" height="120" rx="1"/>
    <rect class="dg-band" x="20" y="15" width="220" height="34"/>
    <rect class="dg-safe" x="44" y="39" width="172" height="92"/>
    <g class="dg-txt"><rect x="56" y="64" width="96" height="9" rx="4.5"/><rect x="56" y="82" width="132" height="6" rx="3"/><rect x="56" y="95" width="110" height="6" rx="3"/><rect class="dg-qr" x="176" y="96" width="26" height="26"/></g>
    <g class="dg-lbl dg-l-bleed"><text x="130" y="11">+1 мм вылет</text></g>
    <g class="dg-lbl dg-l-safe"><text x="130" y="167">4 мм — безопасная зона</text></g>
    <g class="dg-cmyk"><circle cx="70" cy="113" r="9" fill="#00AEEF"/><circle cx="92" cy="113" r="9" fill="#EC008C"/><circle cx="114" cy="113" r="9" fill="#FFF200"/><circle cx="136" cy="113" r="9" fill="#1a1513"/></g>
    <g class="dg-curves"><path d="M60 125c10-22 22-22 30 0M75 125v-12" /></g>
    <g class="dg-send"><circle cx="210" cy="40" r="16"/><path d="M203 40l5 5 10-10"/></g>
  </svg>`;

  let AC = null;
  const tone = (f, muted) => { if (muted) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .02); g.gain.exponentialRampToValueAtTime(.0008, t + .5);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .55); } catch (e) {} };

  roots.forEach(root => {
    const x = XP[root.dataset.xp]; if (!x) return;
    const n = x.steps.length, secs = Math.round(n * STEP / 1000);
    let i = -1, timer = null, playing = false, muted = false, t0 = 0, left = STEP;
    root.innerHTML = `<div class="xp-stage" role="region" aria-label="Ролик: ${esc(x.t)}">` +
      `<div class="xp-bg"><i></i><i></i><i></i></div>` +
      `<div class="xp-top"><span class="xp-brand">Рикс+С · объясняем</span><span class="xp-ctl"><button type="button" class="xp-mute" aria-label="Выключить звук">${IC_SND}</button><button type="button" class="xp-pp" aria-label="Пауза">${IC_PAUSE}</button></span></div>` +
      `<div class="xp-body"><div class="xp-pic"></div><div class="xp-txt"><span class="xp-no"></span><h3></h3><p></p></div></div>` +
      `<div class="xp-prog">${x.steps.map(() => '<i><em></em></i>').join('')}</div>` +
      `<button type="button" class="xp-cover"><span class="xp-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><b>${esc(x.t)}</b><small>${n} шагов · ${secs} секунд</small></button>` +
      `</div>`;
    const $ = s => root.querySelector(s), pic = $('.xp-pic'), no = $('.xp-no'), h = $('.xp-txt h3'), p = $('.xp-txt p'), bars = root.querySelectorAll('.xp-prog i'), pp = $('.xp-pp');
    const show = k => {
      i = k; const st = x.steps[k];
      root.classList.remove('in'); void root.offsetWidth; root.classList.add('in');
      pic.innerHTML = st.k ? diagram(st.k) : `<span class="xp-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${I[st.ic] || ''}</svg></span>`;
      no.textContent = 'Шаг ' + (k + 1) + ' из ' + n; h.textContent = st.t; p.textContent = st.d;
      bars.forEach((b, j) => { b.className = j < k ? 'done' : j === k ? 'now' : ''; b.firstChild.style.animationDuration = STEP + 'ms'; b.firstChild.style.animationPlayState = 'running'; });
      tone(520 + k * 70, muted);
    };
    const tick = () => { timer = setTimeout(() => { if (i < n - 1) { show(i + 1); left = STEP; t0 = Date.now(); tick(); } else end(); }, left); };
    const end = () => { playing = false; root.classList.add('ended'); pp.innerHTML = IC_AGAIN; pp.setAttribute('aria-label', 'Смотреть снова'); };
    const start = () => { root.classList.add('on'); root.classList.remove('ended'); playing = true; pp.innerHTML = IC_PAUSE; pp.setAttribute('aria-label', 'Пауза'); show(0); left = STEP; t0 = Date.now(); tick(); };
    $('.xp-cover').onclick = start;
    pp.onclick = () => {
      if (root.classList.contains('ended')) return start();
      if (playing) { clearTimeout(timer); left -= Date.now() - t0; playing = false; root.classList.add('paused'); pp.innerHTML = IC_PLAY; pp.setAttribute('aria-label', 'Продолжить'); }
      else { playing = true; root.classList.remove('paused'); t0 = Date.now(); pp.innerHTML = IC_PAUSE; pp.setAttribute('aria-label', 'Пауза'); tick(); }
    };
    $('.xp-mute').onclick = e => { muted = !muted; e.currentTarget.innerHTML = muted ? IC_MUTE : IC_SND; e.currentTarget.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук'); };
    // остановить, если ушли со страницы
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pp.click(); });
  });
})();

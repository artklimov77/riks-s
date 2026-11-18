/* Рикс+С — анимированный ролик «Зачем мы спрашиваем» (~22 сек) для опросника.
   SVG + CSS-анимации, звуки синтезирует браузер (Web Audio) — без видеофайлов.
   window.RiksWhyVideo(container, { tiger: '<svg…>', onStart: () => {} }) */
(() => {
  const css = `
  .wv{position:relative;border-radius:16px;overflow:hidden;background:#141110;color:#fff;font-family:inherit;user-select:none;margin-top:12px}
  .wv svg{display:block;width:100%;height:auto}
  .wv-cap{position:absolute;left:0;right:0;bottom:34px;text-align:center;font-weight:800;font-size:clamp(13px,3.4vw,17px);line-height:1.35;padding:0 18px;text-shadow:0 2px 8px rgba(0,0,0,.7);transition:opacity .3s}
  .wv-cap b{color:#FFB43A}
  .wv-bar{position:absolute;left:0;bottom:0;height:5px;background:linear-gradient(90deg,#FF8A00,#E3241B);width:0}
  .wv-ctl{position:absolute;right:10px;top:10px;display:flex;gap:6px}
  .wv-ctl button{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:15px;border:0;cursor:pointer}
  .wv-ctl button:hover{background:rgba(255,255,255,.28)}
  .wv-play{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(20,17,16,.55);cursor:pointer;border:0;color:#fff;font:inherit;width:100%}
  .wv-play i{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#FF8A00,#E3241B);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:26px;box-shadow:0 10px 30px rgba(227,36,27,.5);animation:wvPulse 1.6s ease-in-out infinite}
  .wv-play span{font-weight:800;font-size:15px}
  @keyframes wvPulse{50%{transform:scale(1.08)}}
  .wv [data-s]{opacity:0;transition:opacity .45s}
  .wv.s1 [data-s~="1"],.wv.s2 [data-s~="2"],.wv.s3 [data-s~="3"],.wv.s4 [data-s~="4"],.wv.s5 [data-s~="5"],.wv.s6 [data-s~="6"]{opacity:1}
  .wv .wv-tiger{transition:transform .8s cubic-bezier(.3,1.3,.5,1)}
  .wv.s1 .wv-tiger{transform:translate(220px,40px)}
  .wv.s2 .wv-tiger,.wv.s3 .wv-tiger,.wv.s4 .wv-tiger,.wv.s5 .wv-tiger{transform:translate(430px,60px)}
  .wv.s6 .wv-tiger{transform:translate(60px,50px)}
  .wv .wv-wave{transform-origin:186px 222px}
  .wv.s1 .wv-wave,.wv.s6 .wv-wave{animation:wvWave .4s ease-in-out infinite alternate}
  @keyframes wvWave{from{transform:rotate(-16deg)}to{transform:rotate(18deg)}}
  .wv .q{opacity:0;transform:translateY(14px) scale(.8);transition:all .35s cubic-bezier(.3,1.5,.5,1)}
  .wv.s2 .q.on{opacity:1;transform:none}
  .wv .ring{animation:wvRing .15s linear infinite alternate;transform-origin:120px 170px}
  @keyframes wvRing{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}
  .wv .clock-h{transform-origin:52px 62px;animation:wvSpin 1s linear infinite}
  @keyframes wvSpin{to{transform:rotate(360deg)}}
  .wv .chk{opacity:.25;transition:opacity .3s}.wv .chk.on{opacity:1}
  .wv .tick{stroke-dasharray:30;stroke-dashoffset:30;transition:stroke-dashoffset .3s}.wv .chk.on .tick{stroke-dashoffset:0}
  .wv .coin{transform:scale(0);transform-box:fill-box;transform-origin:center;transition:transform .3s cubic-bezier(.3,1.6,.5,1)}.wv .chk.on .coin{transform:scale(1)}
  .wv .stamp{opacity:0;transform:scale(2.4) rotate(-14deg);transform-box:fill-box;transform-origin:center;transition:all .25s cubic-bezier(.5,0,.7,1)}
  .wv.stamped .stamp{opacity:1;transform:scale(1) rotate(-14deg)}
  .wv .phone{transform-box:fill-box;transform-origin:center;animation:wvPhone 1s ease-in-out infinite}
  @keyframes wvPulsePh{50%{transform:scale(1.12)}}
  @keyframes wvPhone{50%{transform:scale(1.1) rotate(-6deg)}}
  .wv .conf{opacity:0}.wv.s6 .conf{animation:wvConf 2.2s ease-out forwards}
  @keyframes wvConf{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(360deg)}}
  .wv-go{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);display:none;padding:12px 22px;border-radius:12px;border:0;background:linear-gradient(115deg,#FF8A00,#FF5A1F 48%,#E3241B);color:#fff;font:800 15px/1 inherit;cursor:pointer;box-shadow:0 10px 30px rgba(227,36,27,.45)}
  .wv.s6.end .wv-go{display:block}
  @media (prefers-reduced-motion:reduce){.wv *{animation:none!important;transition:none!important}}`;
  let styled = false;
  const INK = '#1A1513';

  // ---------- звуки (Web Audio, без файлов) ----------
  let AC = null, muted = false;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; };
  function tone(f, t0, dur, type = 'sine', vol = .18, slide = 0) {
    const a = ac(); if (!a || muted) return; const t = a.currentTime + t0;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .05);
  }
  function noise(t0, dur, vol = .25) {
    const a = ac(); if (!a || muted) return; const t = a.currentTime + t0, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; s.buffer = b; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(t);
  }
  const SFX = {
    hi: () => { tone(660, 0, .12, 'triangle'); tone(880, .1, .14, 'triangle'); tone(1320, .2, .22, 'triangle', .14); },
    pop: () => tone(520 + Math.random() * 300, 0, .12, 'sine', .2, 1.8),
    ring: () => { for (let i = 0; i < 4; i++) { tone(1200, i * .16, .07, 'square', .05); tone(1500, i * .16 + .07, .07, 'square', .05); } },
    ding: n => tone([784, 880, 988, 1047, 1175, 1319][n % 6], 0, .35, 'triangle', .16),
    coin: () => { tone(988, 0, .08, 'square', .06); tone(1319, .08, .25, 'square', .06); },
    stamp: () => { noise(0, .22, .5); tone(90, 0, .22, 'sine', .4, .5); },
    chime: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .5, 'triangle', .13)),
    whoosh: () => { const a = ac(); if (!a || muted) return; noise(0, .35, .12); tone(300, 0, .3, 'sine', .06, 3); },
    tada: () => { [523, 659, 784].forEach((f, i) => tone(f, i * .1, .25, 'triangle', .14)); tone(1047, .32, .7, 'triangle', .16); }
  };

  // ---------- сцена ----------
  function svg(tiger) {
    const qs = ['Какой размер?', 'А материал?', 'Где вешаем?', 'Макет есть?', 'К какому сроку?'];
    const pos = [[150, 60], [300, 40], [190, 120], [330, 110], [250, 180]];
    const items = ['Что нужно', 'Размер', 'Материалы', 'Макет', 'Срок'];
    const tigerInner = tiger.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace('<g class="qz-bd">', '<g class="qz-bd">');
    return `<svg viewBox="0 0 640 360" aria-hidden="true">
      <defs><linearGradient id="wvFl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A00"/><stop offset=".5" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E3241B"/></linearGradient>
        <radialGradient id="wvGlow"><stop offset="0" stop-color="rgba(255,110,20,.35)"/><stop offset="1" stop-color="rgba(255,110,20,0)"/></radialGradient></defs>
      <rect width="640" height="360" fill="#141110"/><circle cx="320" cy="170" r="260" fill="url(#wvGlow)"/>
      <path d="M0 300 L640 300" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
      <!-- 1: привет -->
      <g data-s="1"><text x="40" y="70" font-family="Roboto Condensed,Arial" font-weight="900" font-size="34" fill="#fff">ЗАЧЕМ МЫ</text><text x="40" y="108" font-family="Roboto Condensed,Arial" font-weight="900" font-size="34" fill="url(#wvFl)">СПРАШИВАЕМ?</text></g>
      <!-- 2: без ответов — менеджер переспрашивает -->
      <g data-s="2"><g class="ring"><rect x="80" y="120" width="80" height="120" rx="14" fill="#2A2320" stroke="#fff" stroke-width="3"/><rect x="90" y="134" width="60" height="80" rx="4" fill="#3d5a80"/><circle cx="120" cy="226" r="6" fill="#fff"/></g>
        ${qs.map((q, i) => `<g class="q" data-qi="${i}"><rect x="${pos[i][0]}" y="${pos[i][1]}" width="${q.length * 9.5 + 24}" height="34" rx="12" fill="#fff"/><text x="${pos[i][0] + 12}" y="${pos[i][1] + 22}" font-family="Onest,Arial" font-weight="800" font-size="15" fill="#141110">${q}</text></g>`).join('')}
        <g transform="translate(0 0)"><circle cx="52" cy="62" r="30" fill="#fff" stroke="${INK}" stroke-width="4"/><path class="clock-h" d="M52 62 V40" stroke="#E3241B" stroke-width="5" stroke-linecap="round"/><circle cx="52" cy="62" r="4" fill="${INK}"/></g></g>
      <!-- 3: опросник — галочки и монетки -->
      <g data-s="3 4"><rect x="70" y="40" width="300" height="250" rx="16" fill="#fff"/><text x="94" y="78" font-family="Roboto Condensed,Arial" font-weight="900" font-size="22" fill="#E3241B">ОПРОС · 1 МИНУТА</text>
        ${items.map((t, i) => `<g class="chk" data-ci="${i}"><rect x="94" y="${98 + i * 36}" width="24" height="24" rx="6" fill="#fff" stroke="#E3241B" stroke-width="3"/><path class="tick" d="M99 ${110 + i * 36} l6 6 l11 -12" fill="none" stroke="#2fbf5b" stroke-width="4" stroke-linecap="round"/><text x="130" y="${116 + i * 36}" font-family="Onest,Arial" font-weight="700" font-size="17" fill="#141110">${t}</text><g class="coin"><circle cx="336" cy="${110 + i * 36}" r="11" fill="#FFC23A" stroke="${INK}" stroke-width="2.5"/></g></g>`).join('')}</g>
      <!-- 4: штамп «ГОТОВО» -->
      <g data-s="4"><g class="stamp"><rect x="150" y="150" width="160" height="56" rx="8" fill="rgba(47,191,91,.12)" stroke="#2fbf5b" stroke-width="5"/><text x="230" y="188" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="30" fill="#2fbf5b">ГОТОВО</text></g></g>
      <!-- 5: позвоните мне -->
      <g data-s="5"><rect x="60" y="120" width="330" height="70" rx="16" fill="#fff5ec" stroke="#F7941D" stroke-width="3" stroke-dasharray="10 6"/><g class="phone"><circle cx="104" cy="155" r="22" fill="url(#wvFl)"/><text x="104" y="163" text-anchor="middle" font-size="22">📞</text></g><text x="138" y="150" font-family="Onest,Arial" font-weight="800" font-size="16" fill="#B5161A">Устали от вопросов?</text><text x="138" y="172" font-family="Onest,Arial" font-weight="700" font-size="15" fill="#B5161A">Жмите — просто перезвоним</text></g>
      <!-- 6: финал -->
      <g data-s="6"><text x="330" y="120" font-family="Roboto Condensed,Arial" font-weight="900" font-size="40" fill="#fff">ПОЕХАЛИ!</text><text x="330" y="156" font-family="Onest,Arial" font-weight="700" font-size="17" fill="#FFB43A">5 вопросов · 1 минута · точная цена</text>
        ${Array.from({ length: 14 }, (_, i) => `<rect class="conf" x="${300 + (i % 7) * 30}" y="190" width="8" height="12" fill="${['#FF8A00', '#E3241B', '#FFC23A', '#fff'][i % 4]}" style="--dx:${(i % 2 ? 1 : -1) * (30 + i * 9)}px;--dy:${-60 - (i % 5) * 25}px;animation-delay:${i * .05}s"/>`).join('')}</g>
      <!-- тигр -->
      <g class="wv-tiger"><g transform="scale(.62)">${tigerInner.replace('<g class="qz-wr">', '<g class="qz-wr wv-wave">')}</g></g>
    </svg>`;
  }

  const CAPS = [
    [0, '👋 Привет! Я тигр Рикс. За <b>20 секунд</b> объясню, зачем вопросы.', 'hi', 1],
    [3.6, 'Без ответов менеджер звонит вам <b>пять раз</b>: размер, материал, где вешаем… Время уходит.', 'ring', 2],
    [8.4, 'А тут — <b>5 коротких вопросов</b>. Минута, и вся картина у нас.', 'whoosh', 3],
    [13.2, 'Менеджер сразу считает <b>точную цену</b>, дизайнер начинает макет — без переспрашиваний.', '', 4],
    [17, 'Не хотите отвечать — нажмите <b>«просто позвоните мне»</b>. Перезвоним сами.', 'pop', 5],
    [20.4, 'Ну что, <b>поехали?</b> 🐯', 'tada', 6]
  ];
  const TOTAL = 23;

  window.RiksWhyVideo = (box, o = {}) => {
    if (!styled) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); styled = true; }
    box.innerHTML = `<div class="wv">${svg(o.tiger || '')}<div class="wv-cap"></div><div class="wv-bar"></div><div class="wv-ctl"><button class="wv-mute" title="Звук">🔊</button><button class="wv-re" title="Сначала">↺</button></div><button class="wv-go" type="button">Начать опрос →</button><button class="wv-play" type="button"><i>▶</i><span>Смотреть · 20 сек, со звуком</span></button></div>`;
    const W = box.querySelector('.wv'), cap = W.querySelector('.wv-cap'), bar = W.querySelector('.wv-bar');
    let timers = [], raf = 0, t0 = 0;
    const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
    const at = (s, fn) => timers.push(setTimeout(fn, s * 1000));
    const setScene = n => { W.className = 'wv s' + n; };
    function play() {
      clear(); W.querySelector('.wv-play').style.display = 'none'; const a = ac(); if (a && a.state === 'suspended') a.resume();
      W.querySelectorAll('.q').forEach(q => q.classList.remove('on')); W.querySelectorAll('.chk').forEach(c => c.classList.remove('on')); W.classList.remove('stamped', 'end');
      CAPS.forEach(([s, text, sfx, sc]) => at(s, () => { setScene(sc); cap.innerHTML = text; if (sfx) SFX[sfx](); }));
      [4.2, 5, 5.8, 6.6, 7.4].forEach((s, i) => at(s, () => { W.querySelector(`.q[data-qi="${i}"]`).classList.add('on'); SFX.pop(); }));
      [9.4, 10.1, 10.8, 11.5, 12.2].forEach((s, i) => at(s, () => { W.querySelector(`.chk[data-ci="${i}"]`).classList.add('on'); SFX.ding(i); setTimeout(SFX.coin, 120); }));
      at(14.4, () => { W.classList.add('stamped'); SFX.stamp(); setTimeout(SFX.chime, 250); });
      at(21.6, () => W.classList.add('end'));
      t0 = performance.now(); const tick = () => { const p = Math.min((performance.now() - t0) / 1000 / TOTAL, 1); bar.style.width = (p * 100) + '%'; if (p < 1) raf = requestAnimationFrame(tick); }; tick();
    }
    W.querySelector('.wv-play').onclick = play;
    W.querySelector('.wv-re').onclick = play;
    W.querySelector('.wv-mute').onclick = e => { muted = !muted; e.currentTarget.textContent = muted ? '🔇' : '🔊'; };
    W.querySelector('.wv-go').onclick = () => { clear(); if (o.onStart) o.onStart(); };
    setScene(1); cap.innerHTML = '';
    return { stop: clear };
  };
})();

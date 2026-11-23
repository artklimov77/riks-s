/* Рикс+С — анимированные сцены с тигром для первых экранов страниц.
   <div class="tscene" data-scene="neon"></div> → рисуем SVG-сцену. Анимации на CSS, крутятся по кругу,
   запускаются, когда сцена видна на экране. Голова тигра — из логотипа (img/logo-mark.png). */
(() => {
  const els = [...document.querySelectorAll('.tscene[data-scene]')];
  if (!els.length) return;
  let uid = 0;

  // ---------- тигр: тело в стиле логотипа (локальные координаты 260×400, голова смотрит влево) ----------
  const INK = '#1A1513';
  const arm = (x1, y1, x2, y2, bend = 14, sleeve = '#fff') => {
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 - bend * .4;
    const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${sleeve}" stroke-width="18" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="12" fill="#fff" stroke="${INK}" stroke-width="4"/>`;
  };
  const OUTFIT = {
    vest: g => `<path d="M112 198 C100 250 104 290 114 316 L192 316 C202 290 204 250 190 198 Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M112 204 C104 250 106 288 114 314 L146 314 L144 214 C134 214 122 210 112 204 Z" fill="url(#${g})" stroke="${INK}" stroke-width="4"/><path d="M190 204 C198 250 198 288 192 314 L160 314 L160 214 C170 214 182 210 190 204 Z" fill="url(#${g})" stroke="${INK}" stroke-width="4"/><path d="M108 262 h38 M160 262 h37 M110 280 h36 M160 280 h35" stroke="#FFD58A" stroke-width="6"/>`,
    coat: g => `<path d="M114 200 C100 250 96 300 90 342 Q150 352 208 342 C202 300 204 250 190 200 Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M128 202 L150 262 L174 202 Z" fill="url(#${g})" stroke="${INK}" stroke-width="3"/><path d="M146 206 h8 l3 34 l-7 9 l-7-9z" fill="${INK}"/><path d="M150 264 V347" stroke="${INK}" stroke-width="3"/><path d="M173 274 v-15" stroke="#E3241B" stroke-width="5" stroke-linecap="round"/><path d="M165 270 h22 v16 h-22z" fill="#fff" stroke="${INK}" stroke-width="3"/>`,
    apron: g => `<path d="M112 198 C100 250 104 290 114 316 L192 316 C202 290 204 250 190 198 Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M124 222 h58 v94 h-58z" fill="#2A2320" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M124 222 L116 202 M182 222 L190 202" stroke="#2A2320" stroke-width="6"/><rect x="138" y="252" width="30" height="20" rx="3" fill="url(#${g})" stroke="${INK}" stroke-width="3"/>`,
    tee: g => `<path d="M112 198 C100 250 104 290 114 316 L192 316 C202 290 204 250 190 198 Z" fill="url(#${g})" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M134 200 Q152 216 170 200" fill="none" stroke="${INK}" stroke-width="4"/><text x="152" y="270" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="26" fill="#fff">Р+С</text>`,
    suit: g => `<path d="M112 198 C100 250 104 290 114 316 L192 316 C202 290 204 250 190 198 Z" fill="#2A2320" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M132 200 L152 250 L172 200 Z" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M147 206 h10 l3 30 l-8 10 l-8-10z" fill="url(#${g})" stroke="${INK}" stroke-width="2"/>`,
    sweater: g => `<path d="M112 198 C100 250 104 290 114 316 L192 316 C202 290 204 250 190 198 Z" fill="#3D5A80" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M130 200 Q152 222 174 200" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="M116 296 h72" stroke="#FFB43A" stroke-width="6"/>`
  };
  const HAT = {
    none: () => '',
    helmet: g => `<g transform="translate(4,-24) rotate(-10 120 40) scale(.94)"><path d="M58 58 C60 14 96 -2 128 0 C164 2 186 22 186 58 Z" fill="url(#${g})" stroke="${INK}" stroke-width="5"/><path d="M44 58 H200 a6 6 0 0 1 0 12 H44 a6 6 0 0 1 0-12z" fill="#FF6A1F" stroke="${INK}" stroke-width="5"/></g>`,
    cap: g => `<g transform="translate(10,-14) rotate(-8 120 40)"><path d="M70 50 C72 18 104 6 132 8 C162 10 180 28 180 50 Z" fill="url(#${g})" stroke="${INK}" stroke-width="5"/><path d="M70 50 H30 a8 8 0 0 0 0 12 H182" fill="#2A2320" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`,
    beret: () => `<g transform="translate(18,-18) rotate(-14 120 40)"><ellipse cx="124" cy="34" rx="66" ry="24" fill="#C8102E" stroke="${INK}" stroke-width="5"/><path d="M124 10 v-10" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g>`,
    goggles: () => `<g transform="translate(0,6)"><path d="M70 64 Q130 46 196 60" fill="none" stroke="#2A2320" stroke-width="10"/><rect x="88" y="44" width="40" height="30" rx="12" fill="rgba(140,210,255,.55)" stroke="${INK}" stroke-width="5"/><rect x="132" y="42" width="40" height="30" rx="12" fill="rgba(140,210,255,.55)" stroke="${INK}" stroke-width="5"/></g>`,
    glasses: () => `<g transform="translate(-2,20)"><circle cx="104" cy="58" r="15" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="4"/><circle cx="142" cy="56" r="15" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="4"/><path d="M119 57 h8 M157 54 l30 -6" stroke="${INK}" stroke-width="4"/></g>`,
    headset: () => `<path d="M64 84 C60 20 196 10 198 80" fill="none" stroke="#2A2320" stroke-width="9"/><rect x="186" y="70" width="22" height="34" rx="9" fill="#2A2320"/><path d="M196 104 Q186 150 120 150" fill="none" stroke="#2A2320" stroke-width="5"/><circle cx="118" cy="150" r="7" fill="#E3241B"/>`
  };
  // tiger({outfit,hat,back,front,cls}) → <g> в локальных координатах; back/front — руки и предметы позади/поверх головы
  const tiger = (o, g) => `<g class="${o.cls || ''}">
    <path d="M192 300 C224 296 238 270 228 244 C222 228 232 216 240 220" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M192 300 C224 296 238 270 228 244 C222 228 232 216 240 220" fill="none" stroke="#FF7A1A" stroke-width="9" stroke-linecap="round"/><path d="M216 292l-4 10M230 270l-10 4M227 246l-10-2" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <g class="tg-legs"><path d="M120 312 L114 366 L142 366 L148 318 Z" fill="#2A2320" stroke="${INK}" stroke-width="4"/><path d="M160 318 L166 366 L194 366 L188 312 Z" fill="#2A2320" stroke="${INK}" stroke-width="4"/>
    <path d="M108 362 h38 a6 6 0 0 1 6 6 v8 h-50 v-6 a8 8 0 0 1 6-8z" fill="url(#${g})" stroke="${INK}" stroke-width="4"/><path d="M162 362 h34 a8 8 0 0 1 8 8 v6 h-48 v-8 a6 6 0 0 1 6-6z" fill="url(#${g})" stroke="${INK}" stroke-width="4"/></g>
    ${o.back || ''}${OUTFIT[o.outfit || 'vest'](g)}
    <image href="img/logo-mark.png" x="22" y="18" width="190" height="205"/>
    ${HAT[o.hat || 'none'](g)}${o.front || ''}</g>`;
  const defs = g => `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A00"/><stop offset=".5" stop-color="#FF5A1F"/><stop offset="1" stop-color="#E3241B"/></linearGradient>
    <filter id="${g}gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  const T = (x, y, s, inner, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;
  const wall = (h = 360) => `<path d="M20 ${h + 50}h480" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
  const bubble = (x, y, text, cls = 'ts-bub') => `<g class="${cls}"><rect x="${x}" y="${y}" width="${text.length * 8.6 + 26}" height="34" rx="12" fill="#fff"/><path d="M${x + 30} ${y + 34} l-8 12 l20 -12z" fill="#fff"/><text x="${x + 13}" y="${y + 22}" font-family="Onest,Arial" font-weight="800" font-size="14" fill="#141110">${text}</text></g>`;

  // ---------- сцены (viewBox 520×420) ----------
  const S = {};
  // 1. Вывески: замер рулеткой → фотопривязка (вспышка) → печать «СОГЛАСОВАНО» → буквы загораются
  S.vyveski = g => `<g stroke="rgba(255,255,255,.22)" stroke-width="1.5" fill="none"><path d="M40 410V70h330v340"/><rect x="66" y="96" width="70" height="56"/><rect x="170" y="96" width="70" height="56"/><rect x="274" y="96" width="70" height="56"/><rect x="70" y="290" width="90" height="120"/><rect x="250" y="290" width="90" height="120"/></g>${wall()}
    <rect x="66" y="196" width="278" height="60" rx="6" fill="#0c0a09" stroke="#3a2c26" stroke-width="2"/>
    <text class="vy-word" x="205" y="238" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="36" letter-spacing="3" fill="#3b3330">ВЫВЕСКА</text>
    <g class="vy-tape"><rect x="66" y="176" width="278" height="9" fill="#FFB43A" stroke="${INK}" stroke-width="2"/><path d="M80 176v5M100 176v5M120 176v5M140 176v5M160 176v5M180 176v5M200 176v5M220 176v5M240 176v5M260 176v5M280 176v5M300 176v5M320 176v5" stroke="${INK}" stroke-width="1.5"/></g>
    <g class="vy-dim"><rect x="170" y="158" width="72" height="20" rx="4" fill="#141110"/><text x="206" y="173" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="13" fill="#FFB43A">3200 мм</text></g>
    <rect class="vy-frame" x="54" y="186" width="302" height="82" rx="4" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 6"/>
    <rect class="vy-flash" x="0" y="0" width="520" height="420" fill="#fff"/>
    <g class="vy-stamp" transform="translate(150 300) rotate(-12)"><rect x="-10" y="-22" width="190" height="46" rx="6" fill="none" stroke="#2fbf5b" stroke-width="5"/><text x="85" y="10" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="24" fill="#2fbf5b" letter-spacing="2">СОГЛАСОВАНО</text></g>
    ${T(352, 158, .6, tiger({ outfit: 'vest', hat: 'helmet', front: `<g class="vy-arm">${arm(124, 222, 40, 160)}<rect x="10" y="140" width="34" height="30" rx="6" fill="#FFB43A" stroke="${INK}" stroke-width="4"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 2. Неон: надпись рисуется светящейся трубкой, мигает и горит
  S.neon = g => `<rect x="30" y="40" width="460" height="330" rx="14" fill="#1b1513" stroke="#2c2320"/><g stroke="rgba(255,255,255,.05)" stroke-width="2">${Array.from({ length: 10 }, (_, i) => `<path d="M30 ${70 + i * 32}h460"/>`).join('')}</g>
    <clipPath id="${g}n1"><rect class="tsrv ne-r1" x="24" y="100" width="320" height="90"/></clipPath><clipPath id="${g}n2"><rect class="tsrv ne-r2" x="40" y="200" width="300" height="60"/></clipPath><clipPath id="${g}n3"><rect class="tsrv ne-r3" x="150" y="270" width="80" height="80"/></clipPath>
    <g class="ne-on"><g clip-path="url(#${g}n1)"><text x="178" y="168" text-anchor="middle" font-family="'Comfortaa','Segoe Script',cursive" font-weight="700" font-size="48" fill="#ffd0e6" stroke="#FF5FA2" stroke-width="3" filter="url(#${g}gl)">Открыто</text></g>
    <g clip-path="url(#${g}n2)"><text x="190" y="240" text-anchor="middle" font-family="'Comfortaa','Segoe Script',cursive" font-weight="700" font-size="34" fill="#d8f6ff" stroke="#7BE0FF" stroke-width="2.5" filter="url(#${g}gl)">кофе с собой</text></g>
    <g clip-path="url(#${g}n3)"><path d="M190 300 c-14 -16 -40 -4 -26 16 l26 22 l26 -22 c14 -20 -12 -32 -26 -16z" fill="none" stroke="#FFB43A" stroke-width="4" filter="url(#${g}gl)"/></g></g>
    ${T(348, 140, .62, tiger({ outfit: 'tee', hat: 'goggles', front: `<g class="ne-arm">${arm(124, 222, 54, 178)}<path d="M54 178 L20 150" stroke="#FF5FA2" stroke-width="8" stroke-linecap="round" filter="url(#${g}gl)"/></g>${arm(186, 222, 210, 300, -8)}` }, g))}`;
  // 3. Транспорт: машина заезжает, тигр раскатывает плёнку, машина уезжает с рекламой
  S.transport = g => `<path d="M0 360h520" stroke="rgba(255,255,255,.35)" stroke-width="2"/><path class="tr-road" d="M0 380h520" stroke="rgba(255,180,58,.5)" stroke-width="4" stroke-dasharray="30 22"/>
    <g class="tr-car"><clipPath id="${g}car"><path d="M30 330 Q38 262 120 250 L188 214 Q222 200 300 204 L360 212 Q420 222 436 280 L444 330 Z"/></clipPath>
      <path d="M30 330 Q38 262 120 250 L188 214 Q222 200 300 204 L360 212 Q420 222 436 280 L444 330 Z" fill="#f3efe9" stroke="${INK}" stroke-width="5"/>
      <g clip-path="url(#${g}car)"><rect class="tr-wrap" x="20" y="200" width="440" height="140" fill="url(#${g})"/><text class="tr-txt" x="250" y="300" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="34" fill="#fff" letter-spacing="2">ВАША РЕКЛАМА</text></g>
      <path d="M200 222 L224 216 L296 216 L300 248 L196 250 Z M310 218 L356 222 Q386 230 398 252 L312 250 Z" fill="#9fc3d8" stroke="${INK}" stroke-width="4"/>
      <circle cx="120" cy="334" r="30" fill="#2A2320" stroke="${INK}" stroke-width="5"/><circle cx="120" cy="334" r="11" fill="#9A9089"/><circle cx="366" cy="334" r="30" fill="#2A2320" stroke="${INK}" stroke-width="5"/><circle cx="366" cy="334" r="11" fill="#9A9089"/></g>
    ${T(404, 150, .5, tiger({ outfit: 'vest', hat: 'cap', cls: 'tr-tiger', front: `<g class="tr-arm">${arm(124, 222, 40, 230)}<rect x="0" y="212" width="40" height="36" rx="4" fill="#FFB43A" stroke="${INK}" stroke-width="4"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}
    ${bubble(300, 40, 'Би-бип! 🚗', 'tr-bub')}`;
  // 4. Полиграфия: станок выпускает листы, они летят в стопку, счётчик тиража
  S.poligrafiya = g => `${wall(320)}<rect x="40" y="200" width="190" height="170" rx="12" fill="#2a2320" stroke="#4a3a32" stroke-width="3"/><rect x="58" y="220" width="70" height="24" rx="4" fill="#0f0c0b"/><text class="pg-cnt" x="93" y="237" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="13" fill="#7BE07B">1000</text><circle cx="160" cy="232" r="7" fill="#2fbf5b"/><circle cx="184" cy="232" r="7" fill="#E3241B"/><rect x="200" y="280" width="40" height="12" rx="3" fill="#0f0c0b"/>
    ${[0, 1, 2, 3, 4].map(i => `<g class="pg-sheet" style="animation-delay:${i * .6}s"><rect x="206" y="270" width="54" height="72" rx="3" fill="#fff" stroke="#ccc"/><rect x="214" y="280" width="38" height="10" fill="#FF7E00"/><path d="M214 298h38M214 306h30M214 314h34" stroke="#bbb" stroke-width="3"/></g>`).join('')}
    <g><rect x="292" y="350" width="70" height="20" fill="#fff" stroke="#ccc"/><rect x="294" y="342" width="70" height="10" fill="#fff" stroke="#ccc"/><rect x="290" y="334" width="70" height="10" fill="#fff" stroke="#ccc"/></g>
    ${T(372, 150, .58, tiger({ outfit: 'apron', hat: 'cap', front: `${arm(124, 222, 60, 290, -6)}${arm(186, 222, 210, 300, -8)}` }, g))}`;
  // 5. Стенды: стенд опускается на стену, уровень, листы заезжают в карманы
  S.stendy = g => `${wall()}<g class="st-board"><rect x="50" y="70" width="270" height="200" rx="8" fill="#fff" stroke="#1E4FA3" stroke-width="6"/><rect x="50" y="70" width="270" height="40" fill="#1E4FA3"/><text x="185" y="98" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="20" fill="#fff" letter-spacing="1">УГОЛОК ПОТРЕБИТЕЛЯ</text>
      ${[0, 1, 2].map(i => `<rect x="${66 + i * 84}" y="124" width="72" height="130" fill="#eaf0fa" stroke="#9db3d8" stroke-width="2"/><g class="st-paper" style="animation-delay:${1.6 + i * .5}s"><rect x="${72 + i * 84}" y="130" width="60" height="116" fill="#fff" stroke="#ccc"/><path d="M${78 + i * 84} 144h48M${78 + i * 84} 154h40M${78 + i * 84} 164h44M${78 + i * 84} 174h32" stroke="#aaa" stroke-width="3"/></g>`).join('')}</g>
    <g class="st-level"><rect x="110" y="282" width="150" height="20" rx="5" fill="#FFB43A" stroke="${INK}" stroke-width="3"/><rect x="172" y="285" width="26" height="14" rx="6" fill="#bff3a8" stroke="${INK}" stroke-width="2"/><circle class="st-bub" cx="185" cy="292" r="4" fill="#fff"/></g>
    ${T(356, 154, .6, tiger({ outfit: 'vest', hat: 'helmet', front: `<g class="st-arm">${arm(124, 222, 50, 160)}</g>${arm(186, 222, 214, 296, -8)}` }, g))}
    ${bubble(338, 50, 'Ровно! ✓', 'st-ok')}`;
  // 6. Мобильные стойки: ролл-ап вытягивается из основания, тигр машет
  S['mobilnye-stojki'] = g => `${wall()}<rect x="70" y="392" width="170" height="16" rx="6" fill="#9A9089" stroke="${INK}" stroke-width="3"/>
    <g class="ms-banner"><rect x="78" y="80" width="154" height="312" fill="#fff" stroke="${INK}" stroke-width="3"/><rect x="78" y="80" width="154" height="90" fill="url(#${g})"/><text x="155" y="136" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="30" fill="#fff">ВАШ</text><text x="155" y="214" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="26" fill="#141110">ЛОГОТИП</text><path d="M100 250h110M100 270h90M100 290h100" stroke="#ccc" stroke-width="6"/><rect x="104" y="320" width="102" height="34" rx="8" fill="#141110"/><text x="155" y="343" text-anchor="middle" font-family="Onest,Arial" font-weight="800" font-size="11" fill="#FFB43A">+7 (000) 000-00-00</text></g>
    <path d="M155 392 V80" stroke="#9A9089" stroke-width="3" class="ms-pole"/>
    ${T(330, 150, .6, tiger({ outfit: 'tee', front: `<g class="ms-pull">${arm(124, 222, 40, 120)}</g><g class="ms-wave">${arm(186, 222, 236, 150, -16)}</g>` }, g))}
    ${bubble(300, 40, 'Собрали за минуту!', 'ms-bub')}`;
  // 7. Работы: тигр-фотограф, вспышка, фото вылетают в галерею
  S.raboty = g => `<g>${[0, 1, 2].map(i => `<rect x="${44 + i * 100}" y="60" width="86" height="70" rx="4" fill="#2a2320" stroke="#4a3a32" stroke-width="2"/>`).join('')}</g>
    ${[0, 1, 2].map(i => `<g class="rb-photo" style="animation-delay:${i * 1.3}s;--tx:${-210 + i * 100}px"><rect x="250" y="210" width="80" height="64" rx="3" fill="#fff"/><rect x="256" y="216" width="68" height="44" fill="${['#FF7E00', '#1E4FA3', '#2fbf5b'][i]}"/><text x="290" y="244" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="12" fill="#fff">${['ВЫВЕСКА', 'СТЕНД', 'НЕОН'][i]}</text></g>`).join('')}
    <rect class="rb-flash" x="0" y="0" width="520" height="420" fill="#fff"/>${wall()}
    ${T(350, 150, .6, tiger({ outfit: 'sweater', hat: 'beret', front: `${arm(124, 222, 60, 210)}<g transform="translate(14 188)"><rect x="0" y="0" width="60" height="42" rx="8" fill="#2A2320" stroke="${INK}" stroke-width="4"/><circle cx="24" cy="21" r="13" fill="#9fc3d8" stroke="${INK}" stroke-width="4"/><rect x="42" y="-8" width="14" height="10" rx="2" fill="#FFB43A"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 8. Цены: калькулятор щёлкает, ценники качаются, монетки сыплются
  S.ceny = g => `${wall()}<g class="cn-tag" style="transform-origin:120px 70px"><path d="M120 70 L120 110" stroke="#9A9089" stroke-width="3"/><path d="M70 110 h100 l20 30 -20 30 h-100z" fill="#FFB43A" stroke="${INK}" stroke-width="4"/><text x="122" y="148" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="26" fill="#141110">ЧЕСТНО</text></g>
    <g class="cn-tag" style="transform-origin:250px 50px;animation-delay:.4s"><path d="M250 50 L250 84" stroke="#9A9089" stroke-width="3"/><path d="M210 84 h80 l16 24 -16 24 h-80z" fill="#fff" stroke="${INK}" stroke-width="4"/><text x="252" y="115" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="20" fill="#E3241B">от 300 ₽</text></g>
    ${[0, 1, 2, 3].map(i => `<g class="cn-coin" style="animation-delay:${i * .45}s"><circle cx="${110 + i * 40}" cy="200" r="14" fill="#FFC23A" stroke="${INK}" stroke-width="3"/><text x="${110 + i * 40}" y="206" text-anchor="middle" font-family="Arial" font-weight="900" font-size="14" fill="${INK}">₽</text></g>`).join('')}
    ${T(340, 150, .6, tiger({ outfit: 'suit', hat: 'glasses', front: `${arm(124, 222, 66, 286, -4)}<g transform="translate(16 236)"><rect x="0" y="0" width="64" height="86" rx="8" fill="#2A2320" stroke="${INK}" stroke-width="4"/><rect x="8" y="8" width="48" height="18" rx="2" fill="#bff3a8"/><g class="cn-keys" fill="#FFB43A">${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${8 + c * 17}" y="${34 + r * 16}" width="12" height="11" rx="2"/>`).join('')).join('')}</g></g>${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 9. Контакты: тигр отвечает на звонок, метка на карте прыгает
  S.kontakty = g => `<rect x="40" y="60" width="250" height="300" rx="14" fill="#221b18" stroke="#3a2c26" stroke-width="2"/><g stroke="rgba(255,255,255,.12)" stroke-width="6"><path d="M40 160h250M40 260h250M120 60v300M220 60v300"/></g><path d="M40 210 Q160 180 290 230" stroke="rgba(255,180,58,.35)" stroke-width="10" fill="none"/>
    <g class="kt-pin"><path d="M165 200 c-26 0 -40 -20 -40 -38 c0 -22 18 -38 40 -38 s40 16 40 38 c0 18 -14 38 -40 38z M165 200 l0 26" fill="#E3241B" stroke="#fff" stroke-width="4"/><circle cx="165" cy="162" r="13" fill="#fff"/></g>
    <text x="165" y="340" text-anchor="middle" font-family="Onest,Arial" font-weight="800" font-size="15" fill="#FFB43A">Комсомольская, 134</text>
    <g class="kt-ring" fill="none" stroke="#FFB43A" stroke-width="4"><path d="M330 170 q-14 16 0 32"/><path d="M318 160 q-24 26 0 52"/></g>
    ${T(340, 150, .6, tiger({ outfit: 'suit', hat: 'headset', front: `<g class="kt-wave">${arm(186, 222, 236, 150, -16)}</g>${arm(124, 222, 70, 290, -4)}` }, g))}
    ${bubble(300, 52, 'Алло, Рикс+С слушает!', 'kt-bub')}`;
  // 10. Штендеры: тигр выносит штендер, мелом пишет акцию
  S.shtendery = g => `${wall()}<g class="sh-board"><path d="M90 400 L140 120 L190 400" fill="none" stroke="#8a6a4a" stroke-width="10" stroke-linejoin="round"/><path d="M190 400 L240 120 L290 400" fill="none" stroke="#8a6a4a" stroke-width="10"/><rect x="130" y="130" width="120" height="200" rx="6" fill="#1f2a22" stroke="#8a6a4a" stroke-width="8"/>
      <clipPath id="${g}s1"><rect class="tsrv sh-r1" x="134" y="155" width="112" height="34"/></clipPath><clipPath id="${g}s2"><rect class="tsrv sh-r2" x="134" y="208" width="112" height="30"/></clipPath><g clip-path="url(#${g}s1)"><text x="190" y="180" text-anchor="middle" font-family="'Comfortaa',cursive" font-weight="700" font-size="17" fill="#f4f4f0">ОТКРЫТО</text></g><g clip-path="url(#${g}s2)"><text x="190" y="230" text-anchor="middle" font-family="'Comfortaa',cursive" font-weight="700" font-size="18" fill="#FFB43A">кофе 150 ₽</text></g><path class="sh-chalk3" d="M150 270 h80" stroke="#7BE0FF" stroke-width="3" stroke-dasharray="80" /></g>
    ${T(340, 150, .6, tiger({ outfit: 'apron', front: `<g class="sh-arm">${arm(124, 222, 40, 210)}<rect x="22" y="196" width="10" height="26" rx="3" fill="#fff" stroke="${INK}" stroke-width="3"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 11. Ростовые фигуры: плоский картонный тигр рядом с настоящим — оба машут
  S['rostovye-figury'] = g => `${wall()}<g class="rf-cut" style="transform-origin:150px 400px"><g transform="translate(40 120) scale(.66)"><path d="M10 400 L250 400" stroke="#9A9089" stroke-width="12"/>${tiger({ outfit: 'vest', hat: 'helmet', front: `<g class="rf-wave1">${arm(186, 222, 236, 150, -16)}</g>${arm(124, 222, 96, 300, 6)}` }, g)}<path d="M150 400 L170 340" stroke="#9A9089" stroke-width="8"/></g><text x="44" y="398" font-family="Onest,Arial" font-weight="800" font-size="12" fill="#FFB43A">ПВХ 5 мм · 1,8 м</text></g>
    ${T(360, 150, .6, tiger({ outfit: 'tee', front: `<g class="rf-wave2">${arm(186, 222, 236, 150, -16)}</g>${arm(124, 222, 96, 300, 6)}` }, g))}
    <rect class="rf-flash" x="0" y="0" width="520" height="420" fill="#fff"/>${bubble(290, 40, 'Найди 10 отличий 😉', 'rf-bub')}`;
  // 12. Пенопласт: горячая струна вырезает букву, летят крошки
  S.penoplast = g => `${wall()}<rect x="60" y="120" width="230" height="250" rx="4" fill="#f4f1ec" stroke="#d6cfc6" stroke-width="3"/>
    <clipPath id="${g}cut"><rect class="pp-mask" x="60" y="110" width="230" height="270"/></clipPath>
    <text x="175" y="330" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="240" fill="url(#${g})" stroke="${INK}" stroke-width="4" clip-path="url(#${g}cut)">Р</text>
    <g class="pp-wire"><path d="M40 0 V420" stroke="#FF5A1F" stroke-width="3" filter="url(#${g}gl)"/></g>
    ${[0, 1, 2, 3, 4, 5].map(i => `<circle class="pp-crumb" style="animation-delay:${i * .35}s;--dx:${(i % 2 ? 1 : -1) * (10 + i * 6)}px" cx="${90 + i * 30}" cy="200" r="${4 + i % 3}" fill="#fff" stroke="#ddd"/>`).join('')}
    ${T(346, 150, .6, tiger({ outfit: 'apron', hat: 'goggles', front: `${arm(124, 222, 40, 230)}${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 13. Брайль и знаки: точки проявляются, лапа читает, знак «Выход» светится в темноте
  S['tablichki-brajlya'] = g => `${wall()}<rect class="br-dark" x="0" y="0" width="520" height="420" fill="#000"/>
    <rect x="60" y="110" width="220" height="140" rx="10" fill="#e9e3dc" stroke="#b9afa5" stroke-width="3"/><text x="170" y="160" text-anchor="middle" font-family="Onest,Arial" font-weight="900" font-size="30" fill="#141110">Кабинет 12</text>
    <g fill="#141110">${[[0, 0], [0, 1], [1, 0], [2, 1], [2, 2], [3, 0], [3, 2], [4, 1], [5, 0], [5, 1], [5, 2]].map(([c, r], i) => `<circle class="br-dot" style="animation-delay:${.2 + i * .12}s" cx="${100 + c * 28 + (c % 2) * 6}" cy="${196 + r * 14}" r="5"/>`).join('')}</g>
    <g class="br-exit"><rect x="70" y="290" width="150" height="64" rx="6" fill="#2fbf5b" stroke="#fff" stroke-width="3"/><path d="M96 340 l14 -24 l10 8 l12 -12 M132 312 h0" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><text x="178" y="332" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="22" fill="#fff">ВЫХОД</text></g>
    ${T(340, 150, .6, tiger({ outfit: 'coat', hat: 'glasses', front: `<g class="br-paw">${arm(124, 222, 40, 140)}</g>${arm(186, 222, 214, 296, -8)}` }, g))}`;
  // 15. Школы и детсады: доска, указка, пятёрки и звёзды
  S['oformlenie-shkol'] = g => `${wall()}<rect x="40" y="70" width="290" height="190" rx="8" fill="#1f3a2c" stroke="#8a6a4a" stroke-width="10"/>
    <clipPath id="${g}k1"><rect class="tsrv sk-r" x="80" y="96" width="210" height="56"/></clipPath><g clip-path="url(#${g}k1)"><text x="185" y="140" text-anchor="middle" font-family="'Comfortaa',cursive" font-weight="700" font-size="44" fill="#f4f4f0">А Б В</text></g><text class="sk-five" x="270" y="230" text-anchor="middle" font-family="'Comfortaa',cursive" font-weight="700" font-size="54" fill="#E3241B">5</text>
    ${[0, 1, 2].map(i => `<path class="sk-star" style="animation-delay:${i * .5}s" transform="translate(${90 + i * 60} 210)" d="M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4Z" fill="#FFC23A"/>`).join('')}
    <rect x="60" y="290" width="120" height="90" rx="6" fill="#fff" stroke="#1E4FA3" stroke-width="5"/><rect x="60" y="290" width="120" height="20" fill="#1E4FA3"/><text x="120" y="304" text-anchor="middle" font-family="Arial" font-weight="900" font-size="10" fill="#fff">РАСПИСАНИЕ</text>
    ${T(350, 150, .6, tiger({ outfit: 'sweater', hat: 'glasses', front: `<g class="sk-arm">${arm(124, 222, 50, 180)}<path d="M50 180 L-60 60" stroke="#8a6a4a" stroke-width="7" stroke-linecap="round"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}
    <g class="sk-bell"><path d="M440 60 c-18 0 -22 16 -22 30 l-6 10 h56 l-6 -10 c0 -14 -4 -30 -22 -30z" fill="#FFC23A" stroke="${INK}" stroke-width="3"/><circle cx="440" cy="104" r="5" fill="${INK}"/></g>`;
  // 16. Логотип: тигр-дизайнер рисует логотип — круг, буква, заливка, значок ®
  S.logotip = g => `${wall()}<rect x="50" y="70" width="270" height="270" rx="12" fill="#fff" stroke="#3a2c26" stroke-width="3"/><g stroke="#e8e2dc" stroke-width="1">${Array.from({ length: 8 }, (_, i) => `<path d="M${50 + i * 34} 70v270M50 ${70 + i * 34}h270"/>`).join('')}</g>
    <circle class="lg-ring" cx="185" cy="205" r="90" fill="none" stroke="#141110" stroke-width="10"/>
    <circle class="lg-fill" cx="185" cy="205" r="80" fill="url(#${g})"/>
    <text class="lg-letter" x="185" y="240" text-anchor="middle" font-family="Roboto Condensed,Arial" font-weight="900" font-size="100" fill="#fff">Л</text>
    ${[[95, 205], [185, 115], [275, 205], [185, 295]].map(([x, y], i) => `<rect class="lg-node" style="animation-delay:${.3 + i * .15}s" x="${x - 6}" y="${y - 6}" width="12" height="12" fill="#fff" stroke="#1E4FA3" stroke-width="3"/>`).join('')}
    <g class="lg-r"><circle cx="286" cy="110" r="20" fill="#fff" stroke="#E3241B" stroke-width="4"/><text x="286" y="118" text-anchor="middle" font-family="Arial" font-weight="900" font-size="22" fill="#E3241B">®</text></g>
    ${T(350, 150, .6, tiger({ outfit: 'sweater', hat: 'beret', front: `<g class="lg-arm">${arm(124, 222, 40, 220)}<path d="M40 220 L6 250" stroke="#2A2320" stroke-width="9" stroke-linecap="round"/><path d="M6 250 L0 258" stroke="#FFB43A" stroke-width="6" stroke-linecap="round"/></g>${arm(186, 222, 214, 296, -8)}` }, g))}`;

  // ---------- анимации ----------
  const css = `
  .tscene{position:relative;aspect-ratio:520/420;width:100%;max-width:640px;justify-self:end}
  .tscene::before{content:"";position:absolute;inset:-6% -4%;background:radial-gradient(closest-side,rgba(255,110,20,.22),transparent 75%);pointer-events:none}
  .tscene svg{position:relative;width:100%;height:100%;display:block;overflow:visible}
  .tscene:not(.run) *{animation-play-state:paused!important}
  .tscene .tg-body{animation:tsBob 3.2s ease-in-out infinite}
  @keyframes tsBob{50%{transform:translateY(-4px)}}
  .tscene [class*="-bub"],.tscene .st-ok{opacity:0}
  /* вывески */
  .vy-tape{transform-origin:66px 180px;animation:vyTape 9s infinite}@keyframes vyTape{0%,4%{transform:scaleX(0)}16%,30%{transform:scaleX(1)}36%,100%{transform:scaleX(0)}}
  .vy-dim{opacity:0;animation:vyDim 9s infinite}@keyframes vyDim{0%,14%{opacity:0}18%,32%{opacity:1}36%,100%{opacity:0}}
  .vy-frame{opacity:0;animation:vyFr 9s infinite}@keyframes vyFr{0%,38%{opacity:0}42%,58%{opacity:1}62%,100%{opacity:0}}
  .vy-flash{opacity:0;animation:vyFl 9s infinite}@keyframes vyFl{0%,40%{opacity:0}41%{opacity:.85}46%,100%{opacity:0}}
  .vy-stamp{opacity:0;animation:vySt 9s infinite}@keyframes vySt{0%,60%{opacity:0;transform:translate(150px,300px) rotate(-12deg) scale(2.2)}64%,92%{opacity:1;transform:translate(150px,300px) rotate(-12deg) scale(1)}96%,100%{opacity:0}}
  .vy-word{animation:vyW 9s infinite}@keyframes vyW{0%,70%{fill:#3b3330}73%{fill:#FF8A00}75%{fill:#3b3330}78%,97%{fill:#FFB43A}100%{fill:#3b3330}}
  .vy-arm{transform-origin:124px 222px;animation:vyArm 9s infinite}@keyframes vyArm{0%,4%{transform:rotate(0)}16%,30%{transform:rotate(-8deg)}40%,100%{transform:rotate(0)}}
  /* неон */
  .tscene .tsrv{transform-box:fill-box;transform-origin:left center;transform:scaleX(0)}
  .ne-r1{animation:rv1 8s infinite}.ne-r2{animation:rv2 8s infinite}.ne-r3{animation:rv3 8s infinite}
  @keyframes rv1{0%,2%{transform:scaleX(0)}30%,94%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  @keyframes rv2{0%,30%{transform:scaleX(0)}50%,94%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  @keyframes rv3{0%,48%{transform:scaleX(0)}62%,94%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  .ne-on{animation:neFl 8s infinite}@keyframes neFl{0%,30%{opacity:1}32%{opacity:.25}34%{opacity:1}36%{opacity:.4}38%,92%{opacity:1}100%{opacity:0}}
  .ne-arm{transform-origin:124px 222px;animation:neArm 8s infinite}@keyframes neArm{0%{transform:rotate(14deg)}15%{transform:rotate(-10deg)}30%{transform:rotate(8deg)}45%{transform:rotate(-6deg)}60%,100%{transform:rotate(0)}}
  /* транспорт */
  .tr-car{animation:trCar 9s infinite}@keyframes trCar{0%{transform:translateX(-520px)}14%,74%{transform:translateX(0)}88%,100%{transform:translateX(620px)}}
  .tr-wrap{transform-origin:20px 0;animation:trWrap 9s infinite}@keyframes trWrap{0%,18%{transform:scaleX(0)}58%,100%{transform:scaleX(1)}}
  .tr-txt{opacity:0;animation:trTxt 9s infinite}@keyframes trTxt{0%,58%{opacity:0}62%,100%{opacity:1}}
  .tr-arm{transform-origin:124px 222px;animation:trArm 1.1s ease-in-out infinite alternate}@keyframes trArm{from{transform:rotate(-14deg)}to{transform:rotate(16deg)}}
  .tr-road{animation:trRoad 1s linear infinite}@keyframes trRoad{to{stroke-dashoffset:-52}}
  .tr-bub{animation:bub 9s infinite;--a:72%;--b:86%}
  @keyframes bub{0%,70%{opacity:0;transform:translateY(8px)}74%,86%{opacity:1;transform:none}90%,100%{opacity:0}}
  /* полиграфия */
  .pg-sheet{opacity:0;animation:pgFly 3s infinite}
  @keyframes pgFly{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}50%{transform:translate(50px,-90px) rotate(-18deg)}90%{opacity:1;transform:translate(90px,40px) rotate(4deg)}100%{opacity:0;transform:translate(90px,50px)}}
  .pg-cnt{animation:pgCnt 3s steps(1) infinite}@keyframes pgCnt{0%{opacity:1}50%{opacity:.4}}
  /* стенды */
  .st-board{animation:stB 8s infinite}@keyframes stB{0%{transform:translateY(-330px)}16%,90%{transform:translateY(0)}100%{transform:translateY(-330px)}}
  .st-paper{opacity:0;animation:stP 8s infinite}@keyframes stP{0%,18%{opacity:0;transform:translateY(-60px)}28%,90%{opacity:1;transform:none}100%{opacity:0}}
  .st-bub{animation:stBub 8s infinite}@keyframes stBub{0%,10%{transform:translateX(-10px)}18%{transform:translateX(8px)}24%,100%{transform:none}}
  .st-ok{animation:stOk 8s infinite}@keyframes stOk{0%,26%{opacity:0}30%,80%{opacity:1}86%,100%{opacity:0}}
  .st-arm{transform-origin:124px 222px;animation:stArm 8s infinite}@keyframes stArm{0%{transform:rotate(-20deg)}16%{transform:rotate(0)}100%{transform:rotate(0)}}
  /* стойки */
  .ms-banner{transform-origin:155px 392px;animation:msB 8s infinite}@keyframes msB{0%,8%{transform:scaleY(0)}36%,90%{transform:scaleY(1)}100%{transform:scaleY(0)}}
  .ms-pole{transform-origin:155px 392px;animation:msB 8s infinite}
  .ms-pull{transform-origin:124px 222px;animation:msPull 8s infinite}@keyframes msPull{0%,8%{transform:rotate(50deg)}36%{transform:rotate(0)}100%{transform:rotate(0)}}
  .ms-wave{transform-origin:186px 222px;animation:msWave 8s infinite}@keyframes msWave{0%,40%{transform:rotate(30deg)}45%{transform:rotate(-14deg)}50%{transform:rotate(12deg)}55%{transform:rotate(-14deg)}60%{transform:rotate(10deg)}66%,100%{transform:rotate(30deg)}}
  .ms-bub{animation:bub2 8s infinite}@keyframes bub2{0%,40%{opacity:0;transform:translateY(8px)}44%,80%{opacity:1;transform:none}86%,100%{opacity:0}}
  /* работы */
  .rb-flash{opacity:0;animation:rbFl 3.9s infinite}@keyframes rbFl{0%{opacity:0}4%{opacity:.8}14%,100%{opacity:0}}
  .rb-photo{opacity:0;animation:rbPh 3.9s infinite}@keyframes rbPh{0%,6%{opacity:0;transform:translate(0,0) scale(.4)}14%{opacity:1;transform:translate(0,-10px) scale(1)}60%,100%{opacity:1;transform:translate(var(--tx),-152px) scale(1)}}
  /* цены */
  .cn-tag{animation:cnSw 2.4s ease-in-out infinite alternate}@keyframes cnSw{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}
  .cn-coin{opacity:0;animation:cnC 2.6s infinite}@keyframes cnC{0%{opacity:0;transform:translateY(-120px)}20%{opacity:1}60%,85%{opacity:1;transform:translateY(160px)}100%{opacity:0;transform:translateY(160px)}}
  .cn-keys rect{animation:cnK 1.4s steps(1) infinite}.cn-keys rect:nth-child(3n){animation-delay:.3s}.cn-keys rect:nth-child(2n){animation-delay:.7s}@keyframes cnK{0%{fill:#FFB43A}50%{fill:#fff}}
  /* контакты */
  .kt-pin{animation:ktPin 1.2s cubic-bezier(.3,1.6,.6,1) infinite alternate}@keyframes ktPin{from{transform:translateY(-14px)}to{transform:none}}
  .kt-ring{animation:ktR 1s infinite}@keyframes ktR{0%,100%{opacity:.2}50%{opacity:1}}
  .kt-wave{transform-origin:186px 222px;animation:ktW 2.6s ease-in-out infinite}@keyframes ktW{0%,60%{transform:rotate(30deg)}66%{transform:rotate(-12deg)}72%{transform:rotate(12deg)}78%{transform:rotate(-12deg)}86%,100%{transform:rotate(30deg)}}
  .kt-bub{animation:bub3 6s infinite}@keyframes bub3{0%,10%{opacity:0;transform:translateY(8px)}16%,80%{opacity:1;transform:none}88%,100%{opacity:0}}
  /* штендеры */
  .sh-board{animation:shB 9s infinite}@keyframes shB{0%{transform:translateX(-360px)}16%,90%{transform:translateX(0)}100%{transform:translateX(-360px)}}
  .sh-r1{animation:shC 9s infinite}.sh-r2{animation:shC2 9s infinite}.sh-chalk3{stroke-dashoffset:80;animation:shC3 9s infinite}
  @keyframes shC{0%,20%{transform:scaleX(0)}44%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  @keyframes shC2{0%,44%{transform:scaleX(0)}64%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  @keyframes shC3{0%,64%{stroke-dashoffset:80}72%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:80}}
  .sh-arm{transform-origin:124px 222px;animation:shA .5s ease-in-out infinite alternate}@keyframes shA{from{transform:rotate(-6deg)}to{transform:rotate(8deg) translateY(4px)}}
  /* ростовые фигуры */
  .rf-wave1{transform-origin:186px 222px;animation:rfW1 1.6s steps(2) infinite}@keyframes rfW1{from{transform:rotate(18deg)}to{transform:rotate(-10deg)}}
  .rf-wave2{transform-origin:186px 222px;animation:rfW2 .5s ease-in-out infinite alternate}@keyframes rfW2{from{transform:rotate(20deg)}to{transform:rotate(-16deg)}}
  .rf-cut{animation:rfC 4s ease-in-out infinite}@keyframes rfC{0%,100%{transform:skewX(0)}50%{transform:skewX(-2deg)}}
  .rf-flash{opacity:0;animation:rbFl 5s infinite 1s}.rf-bub{animation:bub3 7s infinite}
  /* пенопласт */
  .pp-mask{transform-origin:60px 0;animation:ppM 7s infinite}@keyframes ppM{0%,8%{transform:scaleX(0)}70%,92%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  .pp-wire{animation:ppW 7s infinite}@keyframes ppW{0%,8%{transform:translateX(20px);opacity:1}70%{transform:translateX(250px);opacity:1}74%,100%{transform:translateX(250px);opacity:0}}
  .pp-crumb{opacity:0;animation:ppCr 2.1s infinite}@keyframes ppCr{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}100%{opacity:0;transform:translate(var(--dx),180px)}}
  /* брайль */
  .br-dot{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:brD 8s infinite}@keyframes brD{0%,2%{transform:scale(0)}8%,90%{transform:scale(1)}100%{transform:scale(0)}}
  .br-paw{transform-origin:124px 222px;animation:brP 8s infinite}@keyframes brP{0%,20%{transform:rotate(-30deg)}50%{transform:rotate(-58deg)}60%,100%{transform:rotate(-30deg)}}
  .br-dark{opacity:0;animation:brDk 8s infinite}@keyframes brDk{0%,60%{opacity:0}66%,86%{opacity:.78}92%,100%{opacity:0}}
  .br-exit{animation:brEx 8s infinite}@keyframes brEx{0%,60%{filter:none}66%,86%{filter:drop-shadow(0 0 14px #5dff8a)}92%,100%{filter:none}}
  /* печати */
  
  .pc-print{opacity:0;animation:pcP 2.6s infinite}@keyframes pcP{0%,40%{opacity:0}44%,92%{opacity:.9}100%{opacity:0}}
  .pc-arm{transform-origin:124px 222px;animation:pcA 2.6s infinite}@keyframes pcA{0%,20%{transform:rotate(22deg) translateY(-50px)}40%,48%{transform:rotate(0) translateY(0)}70%,100%{transform:rotate(22deg) translateY(-50px)}}
  .pc-bub{animation:bub3 7s infinite}
  /* школы */
  .sk-r{animation:skA 8s infinite}@keyframes skA{0%,6%{transform:scaleX(0)}40%,92%{transform:scaleX(1)}100%{transform:scaleX(0)}}
  .sk-five{opacity:0;transform-box:fill-box;transform-origin:center;animation:skF 8s infinite}@keyframes skF{0%,46%{opacity:0;transform:scale(2)}52%,92%{opacity:1;transform:scale(1)}100%{opacity:0}}
  .sk-star{opacity:0;animation:skS 8s infinite}@keyframes skS{0%,56%{opacity:0}62%,92%{opacity:1}100%{opacity:0}}
  .sk-arm{transform-origin:124px 222px;animation:skAr 2s ease-in-out infinite alternate}@keyframes skAr{from{transform:rotate(-4deg)}to{transform:rotate(10deg)}}
  .sk-bell{transform-origin:440px 60px;animation:skB 8s infinite}@keyframes skB{0%,80%{transform:rotate(0)}83%{transform:rotate(18deg)}86%{transform:rotate(-18deg)}89%{transform:rotate(12deg)}92%,100%{transform:rotate(0)}}
  /* логотип */
  .lg-ring{stroke-dasharray:570;stroke-dashoffset:570;animation:lgR 8s infinite}@keyframes lgR{0%,4%{stroke-dashoffset:570}30%,92%{stroke-dashoffset:0}100%{stroke-dashoffset:570}}
  .lg-fill{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:lgF 8s infinite}@keyframes lgF{0%,34%{transform:scale(0)}44%,92%{transform:scale(1)}100%{transform:scale(0)}}
  .lg-letter{opacity:0;animation:lgL 8s infinite}@keyframes lgL{0%,46%{opacity:0}52%,92%{opacity:1}100%{opacity:0}}
  .lg-node{opacity:0;animation:lgN 8s infinite}@keyframes lgN{0%,6%{opacity:0}12%,30%{opacity:1}34%,100%{opacity:0}}
  .lg-r{opacity:0;transform-box:fill-box;transform-origin:center;animation:lgRr 8s infinite}@keyframes lgRr{0%,60%{opacity:0;transform:scale(0)}66%{opacity:1;transform:scale(1.3)}70%,92%{opacity:1;transform:scale(1)}100%{opacity:0}}
  .lg-arm{transform-origin:124px 222px;animation:lgA 1.2s ease-in-out infinite alternate}@keyframes lgA{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}
  /* «уменьшить движение»: сцена замирает на кадре, где всё видно */
  @media (prefers-reduced-motion:reduce){.tscene *{animation-play-state:paused!important;animation-delay:-5.6s!important}.tscene .br-dark{opacity:0!important}}
  @media (max-width:1100px){.tscene{justify-self:center;margin-top:20px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('run', e.isIntersecting)), { threshold: .15 }) : null;
  els.forEach(el => {
    const fn = S[el.dataset.scene]; if (!fn) return;
    const g = 'ts' + (++uid);
    el.innerHTML = `<svg viewBox="0 0 520 420" role="img" aria-label="${el.getAttribute('aria-label') || 'Тигр Рикс+С за работой'}">${defs(g)}${fn(g)}</svg>`;
    if (io) io.observe(el); else el.classList.add('run');
  });
  window.RiksScenes = Object.keys(S);
})();

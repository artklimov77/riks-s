/* Рикс+С — галерея работ из альбомов ВК (data/vk-albums.json).
   #vkGallery            — полная галерея: направления, описания, фото, лайтбокс
   .vk-strip[data-albums="id,id"][data-limit=8] — полоска работ на страницах услуг */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const full = $('#vkGallery'), strips = $$('.vk-strip');
  if (!full && !strips.length) return;

  // скрытые от публики альбомы (юмор) и порядок важности
  const HIDE = ['293924435'];
  const ORDER = ['271519557', '306304007', '271537231', '271521637', '271520901', '271522317', '271799266', '288628424', '281754475', '279535823', '279535679', '271520251', '271537574', '271537912', '271518787', '281754524', '281754520', '279608306', '279690564', '279751084', '173182999', '304594001', '291956639', '276457429', '0'];
  const short = t => { if (/^Фотографии со страницы/.test(t)) return 'Из ленты'; const s = t.split(/\s+-\s+|:\s/)[0].replace(/^Изготовление\s+/i, '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  const descHtml = d => esc(d).replace(/\n{2,}/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).map(l => `<li>${l.replace(/^[-–•♦️🔸🔹]+\s*/u, '')}</li>`).join('');

  // ---- лайтбокс ----
  let LB = null, list = [], idx = 0;
  function lightbox() {
    if (LB) return LB;
    LB = document.createElement('div'); LB.className = 'lbox';
    LB.innerHTML = '<button class="x" aria-label="Закрыть">✕</button><button class="nav prev" aria-label="Назад">‹</button><img alt=""><button class="nav next" aria-label="Вперёд">›</button><div class="cap"></div>';
    document.body.appendChild(LB);
    const show = i => { idx = (i + list.length) % list.length; const p = list[idx]; $('img', LB).src = p.src; $('.cap', LB).textContent = (p.desc ? p.desc.split('\n')[0].slice(0, 140) + ' · ' : '') + p.album + ' · ' + (idx + 1) + '/' + list.length; };
    LB.show = show;
    $('.next', LB).onclick = e => { e.stopPropagation(); show(idx + 1); };
    $('.prev', LB).onclick = e => { e.stopPropagation(); show(idx - 1); };
    $('.x', LB).onclick = () => LB.classList.remove('open');
    LB.addEventListener('click', e => { if (e.target === LB) LB.classList.remove('open'); });
    addEventListener('keydown', e => { if (!LB.classList.contains('open')) return; if (e.key === 'Escape') LB.classList.remove('open'); else if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); });
    let x0 = null; LB.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
    LB.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });
    return LB;
  }
  const open = (photos, i) => { list = photos; const lb = lightbox(); lb.classList.add('open'); lb.show(i); };
  const fig = (p, i) => `<figure data-i="${i}"><img src="${p.th}" alt="${esc(p.album)}${p.desc ? ': ' + esc(p.desc.slice(0, 80)) : ''}" loading="lazy" width="${p.w}" height="${p.h}">${p.desc ? `<figcaption>${esc(p.desc.split('\n')[0].slice(0, 90))}</figcaption>` : ''}</figure>`;

  fetch('data/vk-albums.json').then(r => r.json()).then(data => {
    const albums = data.filter(a => !HIDE.includes(a.id) && a.count)
      .sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99))
      .map(a => Object.assign(a, { short: short(a.title), photos: a.photos.map(p => Object.assign(p, { album: short(a.title) })) }));
    const byId = Object.fromEntries(albums.map(a => [a.id, a]));

    // ---- полоски на страницах услуг ----
    strips.forEach(el => {
      const ids = (el.dataset.albums || '').split(',').map(s => s.trim()).filter(id => byId[id]);
      const lim = +el.dataset.limit || 8;
      const photos = ids.flatMap(id => byId[id].photos); if (!photos.length) return;
      const total = photos.length;
      el.innerHTML = `<div class="gal vk-grid">${photos.slice(0, lim).map(fig).join('')}</div><a class="btn btn-line vk-more" href="raboty.html#a-${ids[0]}">Все ${total} фото этого направления →</a>`;
      $$('figure', el).forEach(f => f.onclick = () => open(photos, +f.dataset.i));
    });

    // ---- полная галерея ----
    if (!full) return;
    const totalAll = albums.reduce((s, a) => s + a.count, 0);
    $$('[data-vk-total]').forEach(e => e.textContent = totalAll);
    $$('[data-vk-albums]').forEach(e => e.textContent = albums.length);
    full.innerHTML = `<div class="gal-filter vk-chips"><button class="fb on" data-a="all">Все <small>${totalAll}</small></button>${albums.map(a => `<button class="fb" data-a="${a.id}">${esc(a.short)} <small>${a.count}</small></button>`).join('')}</div>
      <div class="vk-about" hidden></div><div class="gal vk-grid" id="vkGrid"></div><div class="vk-more-wrap"><button class="btn btn-line" id="vkMore">Показать ещё</button></div>`;
    let cur = [], shown = 0; const STEP = 36;
    const grid = $('#vkGrid', full), about = $('.vk-about', full), more = $('#vkMore', full);
    const draw = () => { grid.insertAdjacentHTML('beforeend', cur.slice(shown, shown + STEP).map((p, k) => fig(p, shown + k)).join('')); shown = Math.min(shown + STEP, cur.length); more.parentElement.hidden = shown >= cur.length; $$('figure:not([data-b])', grid).forEach(f => { f.dataset.b = 1; f.onclick = () => open(cur, +f.dataset.i); }); };
    const pick = id => {
      $$('.fb', full).forEach(b => b.classList.toggle('on', b.dataset.a === id));
      if (id === 'all') { cur = albums.flatMap(a => a.photos.slice(0, 12)).concat(albums.flatMap(a => a.photos.slice(12))); about.hidden = true; }
      else { const a = byId[id]; cur = a.photos; about.hidden = false; about.innerHTML = `<h3>${esc(a.title.split(/\s+-\s+/)[0])}</h3>${a.desc || a.title.includes(' - ') ? `<ul>${descHtml(a.desc || a.title.split(/\s+-\s+/).slice(1).join('\n'))}</ul>` : ''}<p class="vk-cnt">${a.count} фото · <a href="#lead" data-quiz="">Хочу так же →</a></p>`; }
      grid.innerHTML = ''; shown = 0; draw();
      if (id !== 'all') history.replaceState(null, '', '#a-' + id);
    };
    $$('.fb', full).forEach(b => b.onclick = () => pick(b.dataset.a));
    more.onclick = draw;
    const m = location.hash.match(/^#a-(\d+)/);
    pick(m && byId[m[1]] ? m[1] : 'all');
    if (m) setTimeout(() => full.scrollIntoView({ behavior: 'smooth' }), 300);
  }).catch(() => { if (full) full.innerHTML = '<p class="lead">Галерея временно недоступна — смотрите альбомы в <a href="https://vk.com/albums-52849648">нашем ВКонтакте</a>.</p>'; });
})();

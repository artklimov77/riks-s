// Приватный CRUD для админки Рикс+С. Защита паролем (env LEADS_PASS).
// POST { pass, op, col, id?, data? }
//   op: list | save | delete | seedCatalog
//   col: leads | orders | catalog
// Хранилище — Upstash Redis (hash riks:<col>, поле = id).

const { kvReady, cmd, hall, genId } = require('./_kv.js');

const KEY = { leads: 'riks:leads', orders: 'riks:orders', catalog: 'riks:catalog' };

const DEFAULT_CATALOG = [
  // category, name, unit, price (цены — стартовые, правятся в админке)
  ['Вывески', 'Световой короб, односторонний', 'м²', 7500],
  ['Вывески', 'Световой короб, двусторонний', 'м²', 9500],
  ['Вывески', 'Несветовая вывеска (композит)', 'м²', 3500],
  ['Вывески', 'Объёмные световые буквы', 'шт', 2800],
  ['Вывески', 'Монтаж вывески', 'компл.', 5000],
  ['Неон', 'Гибкий неон (контур)', 'п.м.', 2500],
  ['Неон', 'Неоновая вывеска под макет', 'шт', 15000],
  ['Транспорт', 'Брендирование авто (оклейка)', 'м²', 1800],
  ['Транспорт', 'Магнитная наклейка на борт', 'шт', 1200],
  ['Полиграфия', 'Визитки, 1000 шт', 'компл.', 1500],
  ['Полиграфия', 'Листовки А6, 1000 шт', 'компл.', 2500],
  ['Полиграфия', 'Буклет (евро)', 'шт', 25],
  ['Стенды', 'Информационный стенд', 'шт', 4500],
  ['Стенды', 'Ролл-ап 85×200', 'шт', 3500],
  ['Стенды', 'Пресс-волл (баннер+каркас)', 'м²', 2200],
  ['Печать', 'Баннер литой', 'м²', 450],
  ['Печать', 'Интерьерная печать', 'м²', 900],
  ['Печать', 'УФ-печать', 'м²', 2500]
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  let raw = '';
  try {
    raw = await new Promise((resolve, reject) => {
      let d = '';
      req.on('data', (c) => { d += c; if (d.length > 2e5) req.destroy(); });
      req.on('end', () => resolve(d));
      req.on('error', reject);
    });
  } catch (e) { return res.status(400).json({ ok: false }); }

  let b = {};
  try { b = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw || '{}'); } catch (e) { b = {}; }

  if (!process.env.LEADS_PASS || (b.pass || '') !== process.env.LEADS_PASS) {
    return res.status(401).json({ ok: false, error: 'auth' });
  }

  const col = b.col;
  const key = KEY[col];
  if (!key) return res.status(400).json({ ok: false, error: 'bad col' });

  if (!kvReady()) {
    // без хранилища: чтение вернёт пусто, запись — сообщит о необходимости подключить Redis
    if (b.op === 'list') return res.status(200).json({ ok: true, items: [], note: 'storage-not-configured' });
    return res.status(200).json({ ok: false, note: 'storage-not-configured' });
  }

  try {
    if (b.op === 'list') {
      const items = await hall(key);
      items.sort((x, y) => String(y.ts || '').localeCompare(String(x.ts || '')));
      return res.status(200).json({ ok: true, items });
    }

    if (b.op === 'save') {
      const data = (b.data && typeof b.data === 'object') ? b.data : {};
      const id = String(data.id || b.id || genId()).slice(0, 80);
      const rec = Object.assign({}, data, { id });
      if (!rec.ts) rec.ts = new Date().toISOString();
      await cmd(['HSET', key, id, JSON.stringify(rec)]);
      return res.status(200).json({ ok: true, item: rec });
    }

    if (b.op === 'delete') {
      const id = String(b.id || '').slice(0, 80);
      if (!id) return res.status(400).json({ ok: false, error: 'no id' });
      await cmd(['HDEL', key, id]);
      return res.status(200).json({ ok: true });
    }

    if (b.op === 'seedCatalog') {
      const existing = await hall('riks:catalog');
      if (existing.length) return res.status(200).json({ ok: true, seeded: 0, items: existing });
      const items = [];
      for (const [category, name, unit, price] of DEFAULT_CATALOG) {
        const rec = { id: genId(), category, name, unit, price, ts: new Date().toISOString() };
        items.push(rec);
        await cmd(['HSET', 'riks:catalog', rec.id, JSON.stringify(rec)]);
      }
      return res.status(200).json({ ok: true, seeded: items.length, items });
    }

    return res.status(400).json({ ok: false, error: 'bad op' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};

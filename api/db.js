// Приватный CRUD для админки Рикс+С. Защита паролем (env LEADS_PASS, один вход на всех).
// POST { pass, op, col?, id?, data?, items? }
//   op: list | save | delete | bulk | importUds | seedCatalog | backup | restore | notify
//   col: leads | orders | catalog | clients | settings | tasks
// Хранилище — Upstash Redis (hash riks:<col>, поле = id).

const { kvReady, cmd, hall, genId } = require('./_kv.js');
const UDS = require('../data/uds-catalog.json');

const KEY = {
  leads: 'riks:leads', orders: 'riks:orders', catalog: 'riks:catalog',
  clients: 'riks:clients', settings: 'riks:settings', tasks: 'riks:tasks'
};

const now = () => new Date().toISOString();

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 3e7) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

// HSET одной командой для многих записей
async function hsetMany(key, recs) {
  for (let i = 0; i < recs.length; i += 100) {
    const args = ['HSET', key];
    for (const r of recs.slice(i, i + 100)) args.push(r.id, JSON.stringify(r));
    await cmd(args);
  }
}

async function tgSend(chatId, text) {
  const tok = process.env.TELEGRAM_BOT_TOKEN;
  if (!tok || !chatId) return { ok: false, note: 'telegram-not-configured' };
  const r = await fetch('https://api.telegram.org/bot' + tok + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900), disable_web_page_preview: true })
  });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = await readBody(req).catch(() => ({}));

  // перенос базы на свой сервер: разовый токен MIGRATE_TOKEN (только op 'restore'), после переноса его удаляют из env
  const migrate = !!process.env.MIGRATE_TOKEN && b.op === 'restore' && b.migrate === process.env.MIGRATE_TOKEN;
  if (!migrate && (!process.env.LEADS_PASS || (b.pass || '') !== process.env.LEADS_PASS)) {
    return res.status(401).json({ ok: false, error: 'auth' });
  }

  if (!kvReady()) {
    if (b.op === 'list') return res.status(200).json({ ok: true, items: [], note: 'storage-not-configured' });
    return res.status(200).json({ ok: false, note: 'storage-not-configured' });
  }

  try {
    if (b.op === 'backup') {
      const out = { exportedAt: now() };
      for (const [col, key] of Object.entries(KEY)) out[col] = await hall(key);
      return res.status(200).json({ ok: true, backup: out });
    }

    // восстановить базу из копии (формат op 'backup'): каждая переданная коллекция заменяется целиком
    if (b.op === 'restore') {
      const bk = (b.backup && typeof b.backup === 'object') ? b.backup : {};
      const saved = {};
      for (const [col, key] of Object.entries(KEY)) {
        if (!Array.isArray(bk[col])) continue;
        const recs = bk[col].filter((r) => r && typeof r === 'object' && r.id).map((r) => Object.assign({}, r, { id: String(r.id).slice(0, 80) }));
        await cmd(['DEL', key]);
        if (recs.length) await hsetMany(key, recs);
        saved[col] = recs.length;
      }
      return res.status(200).json({ ok: true, saved });
    }

    if (b.op === 'notify') {
      const r = await tgSend(b.chatId, b.text);
      return res.status(200).json(r);
    }

    const key = KEY[b.col];
    if (!key) return res.status(400).json({ ok: false, error: 'bad col' });

    if (b.op === 'list') {
      const items = await hall(key);
      items.sort((x, y) => String(y.ts || '').localeCompare(String(x.ts || '')));
      return res.status(200).json({ ok: true, items });
    }

    if (b.op === 'save') {
      const data = (b.data && typeof b.data === 'object') ? b.data : {};
      const id = String(data.id || b.id || genId()).slice(0, 80);
      const rec = Object.assign({}, data, { id });
      if (!rec.ts) rec.ts = now();
      rec.upd = now();
      await cmd(['HSET', key, id, JSON.stringify(rec)]);
      return res.status(200).json({ ok: true, item: rec });
    }

    if (b.op === 'bulk') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 5000) : [];
      const recs = items.map((d) => Object.assign({}, d, { id: String(d.id || genId()).slice(0, 80), ts: d.ts || now() }));
      if (b.replace) await cmd(['DEL', key]);
      if (recs.length) await hsetMany(key, recs);
      return res.status(200).json({ ok: true, saved: recs.length });
    }

    if (b.op === 'delete') {
      const id = String(b.id || '').slice(0, 80);
      if (!id) return res.status(400).json({ ok: false, error: 'no id' });
      await cmd(['HDEL', key, id]);
      return res.status(200).json({ ok: true });
    }

    // Прайс из UDS (снимок data/uds-catalog.json). seedCatalog — только если пусто.
    if (b.op === 'importUds' || b.op === 'seedCatalog') {
      if (b.op === 'seedCatalog') {
        const existing = await hall(KEY.catalog);
        if (existing.length) return res.status(200).json({ ok: true, seeded: 0, items: existing });
      }
      const recs = UDS.map((r) => Object.assign({}, r, { ts: now(), src: 'uds' }));
      await cmd(['DEL', KEY.catalog]);
      await hsetMany(KEY.catalog, recs);
      return res.status(200).json({ ok: true, seeded: recs.length, items: recs });
    }

    return res.status(400).json({ ok: false, error: 'bad op' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};

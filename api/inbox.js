// «Сообщения» CRM: единый ящик переписки (Telegram, ВКонтакте, почта, Авито, MAX).
// Работает только на собственном сервере (нужен постоянно работающий процесс — deploy/inbox/).
// POST { pass, op, ... }:
//   threads                         → { items, status, channels }
//   messages { tid }                → { items, thread }
//   read     { tid }                → отметить прочитанным
//   send     { tid, text, who }     → отправить ответ в канал
//   link     { tid, leadId?, clientId?, dealId? }
//   channels                        → настройки каналов (секреты замаскированы) + статус
//   saveChannel { ch, cfg }         → сохранить настройки канала (пустой/маска секрет = не менять)

const MASK = '••••••••';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 2e5) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = await readBody(req).catch(() => ({}));
  if (!process.env.LEADS_PASS || (b.pass || '') !== process.env.LEADS_PASS) return res.status(401).json({ ok: false, error: 'auth' });
  if (!process.env.REDIS_URL) return res.status(200).json({ ok: false, note: 'server-only' });

  const C = require('../deploy/inbox/core.js');
  const { DEF } = require('../deploy/inbox/channels.js');
  const M = require('../deploy/inbox/manager.js');

  const masked = (ch, cfg) => {
    const o = Object.assign({}, cfg || {});
    for (const k of (DEF[ch] ? DEF[ch].secret : [])) if (o[k]) o[k] = MASK;
    return o;
  };

  try {
    if (b.op === 'threads') {
      const [items, status, chans] = await Promise.all([C.listThreads(), C.getStatus(), C.getChannels()]);
      const on = {}; for (const ch of Object.keys(DEF)) on[ch] = !!(chans[ch] && chans[ch].enabled !== false && DEF[ch].need.every((k) => chans[ch][k]));
      return res.status(200).json({ ok: true, items, status, on });
    }
    if (b.op === 'messages') {
      const t = await C.getThread(String(b.tid || ''));
      if (!t) return res.status(404).json({ ok: false, error: 'нет диалога' });
      return res.status(200).json({ ok: true, thread: t, items: await C.listMessages(t.id, 400) });
    }
    if (b.op === 'read') {
      const t = await C.getThread(String(b.tid || ''));
      if (t && t.unread) { t.unread = 0; await C.putThread(t); }
      return res.status(200).json({ ok: true });
    }
    if (b.op === 'send') {
      const text = String(b.text || '').trim();
      if (!text) return res.status(400).json({ ok: false, error: 'пустое сообщение' });
      const msg = await M.send(String(b.tid || ''), text.slice(0, 4000), String(b.who || '').slice(0, 60));
      return res.status(200).json({ ok: true, item: msg });
    }
    if (b.op === 'link') {
      const t = await C.getThread(String(b.tid || ''));
      if (!t) return res.status(404).json({ ok: false });
      for (const k of ['leadId', 'clientId', 'dealId']) if (b[k] !== undefined) t[k] = b[k] ? String(b[k]).slice(0, 80) : undefined;
      if (b.name) t.name = String(b.name).slice(0, 120);
      await C.putThread(t);
      return res.status(200).json({ ok: true, thread: t });
    }
    if (b.op === 'channels') {
      const [chans, status] = await Promise.all([C.getChannels(), C.getStatus()]);
      const out = {}; for (const ch of Object.keys(DEF)) out[ch] = masked(ch, chans[ch]);
      return res.status(200).json({ ok: true, channels: out, status });
    }
    if (b.op === 'saveChannel') {
      const ch = String(b.ch || '');
      if (!DEF[ch]) return res.status(400).json({ ok: false, error: 'bad channel' });
      const cur = (await C.getChannels())[ch] || {};
      const inp = (b.cfg && typeof b.cfg === 'object') ? b.cfg : {};
      const next = Object.assign({}, cur);
      for (const [k, v] of Object.entries(inp)) {
        if (typeof v === 'boolean') { next[k] = v; continue; }
        const s = String(v == null ? '' : v).trim().slice(0, 400);
        if (DEF[ch].secret.includes(k) && (s === '' || s === MASK)) continue; // секрет не меняем
        next[k] = s;
      }
      if (b.clear) for (const k of DEF[ch].secret) delete next[k];
      await C.cmd(['HSET', C.K.ch, ch, JSON.stringify(next)]);
      await C.setStatus(ch, { ok: false, pending: true });
      M.sync();
      return res.status(200).json({ ok: true, cfg: masked(ch, next) });
    }
    return res.status(400).json({ ok: false, error: 'bad op' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e).slice(0, 300) });
  }
};

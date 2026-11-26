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
//   teamCreate { name, who } / teamEdit { tid, name } / teamDelete { tid } — внутренние группы «Между собой»
//   start { ch:'mail', to, name, subject, text, who, leadId?, dealId?, clientId? } — написать клиенту первыми (почта)
//   link { tid, kind:'supplier'|'' } — пометить переписку как «с поставщиком»

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
      // внутренние группы по умолчанию — один раз (как договорились на встрече 25.11)
      if (!(await C.getState('team.seeded'))) {
        const G = ['Общий чат', 'Готовые работы', 'Нормативка', 'Монтаж', 'Важные ссылки', 'Наклейки', 'Печать', 'Цех'];
        for (let i = 0; i < G.length; i++) await C.putThread({ id: 'team:' + C.genId(), ch: 'team', peer: '', name: G[i], last: '', ts: new Date(Date.now() - i * 1000).toISOString(), unread: 0, seq: 0, readBy: {}, meta: {} });
        await C.setState('team.seeded', '1');
      }
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
      if (t && t.ch === 'team') { const w = String(b.who || '').slice(0, 60); if (w) { t.readBy = Object.assign({}, t.readBy, { [w]: t.seq || 0 }); await C.putThread(t); } }
      else if (t && t.unread) { t.unread = 0; await C.putThread(t); M.markRead(t); }
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
      if (b.kind !== undefined) t.kind = b.kind === 'supplier' ? 'supplier' : undefined;
      if (b.name) t.name = String(b.name).slice(0, 120);
      await C.putThread(t);
      return res.status(200).json({ ok: true, thread: t });
    }
    if (b.op === 'teamCreate' || b.op === 'teamEdit') {
      const name = String(b.name || '').trim().slice(0, 60);
      if (!name) return res.status(400).json({ ok: false, error: 'нет названия' });
      let t = b.op === 'teamEdit' ? await C.getThread(String(b.tid || '')) : null;
      if (b.op === 'teamEdit' && (!t || t.ch !== 'team')) return res.status(404).json({ ok: false });
      if (!t) t = { id: 'team:' + C.genId(), ch: 'team', peer: '', last: '', ts: C.now(), unread: 0, seq: 0, readBy: {}, meta: { by: String(b.who || '').slice(0, 60) } };
      t.name = name; await C.putThread(t);
      return res.status(200).json({ ok: true, thread: t });
    }
    if (b.op === 'teamDelete') {
      const t = await C.getThread(String(b.tid || ''));
      if (!t || t.ch !== 'team') return res.status(404).json({ ok: false });
      await C.cmd(['HDEL', C.K.threads, t.id]); await C.cmd(['DEL', C.K.msgs(t.id)]);
      return res.status(200).json({ ok: true });
    }
    if (b.op === 'start') {
      if (b.ch !== 'mail') return res.status(400).json({ ok: false, error: 'первым можно написать только на почту' });
      const to = String(b.to || '').trim().toLowerCase();
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || to.length > 120) return res.status(400).json({ ok: false, error: 'неверный адрес почты' });
      const text = String(b.text || '').trim();
      if (!text) return res.status(400).json({ ok: false, error: 'пустое сообщение' });
      const id = 'mail:' + to;
      let t = await C.getThread(id);
      const subject = String(b.subject || '').trim().slice(0, 160) || 'Рикс+С';
      if (!t) t = { id, ch: 'mail', peer: to, name: String(b.name || '').trim().slice(0, 120) || to, last: '', ts: C.now(), unread: 0, meta: {} };
      t.meta = Object.assign({}, t.meta, { newSubject: subject });
      for (const k of ['leadId', 'clientId', 'dealId']) if (b[k]) t[k] = String(b[k]).slice(0, 80);
      await C.putThread(t);
      const msg = await M.send(id, text.slice(0, 4000), String(b.who || '').slice(0, 60));
      return res.status(200).json({ ok: true, item: msg, thread: await C.getThread(id) });
    }
    if (b.op === 'channels') {
      const [chans, status] = await Promise.all([C.getChannels(), C.getStatus()]);
      const out = {}; for (const ch of Object.keys(DEF)) out[ch] = masked(ch, chans[ch]);
      return res.status(200).json({ ok: true, channels: out, status });
    }
    if (b.op === 'maxuQr') { // вход в рабочий аккаунт MAX по QR-коду: act start | status | password | cancel
      const Q = require('../deploy/inbox/maxuser.js');
      const act = String(b.act || 'status');
      const v = act === 'start' ? await Q.qrStart() : act === 'password' ? await Q.qrPassword(b.password) : act === 'cancel' ? Q.qrCancel() : Q.qrView();
      return res.status(200).json(Object.assign({ ok: true }, v));
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

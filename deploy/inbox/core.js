// «Сообщения» — единый ящик переписки CRM (Telegram, ВКонтакте, почта, Авито, MAX).
// Хранение (Redis):
//   riks:threads           hash  id → диалог {id, ch, peer, name, last, ts, unread, leadId, clientId, meta}
//   riks:msg:<threadId>    list  сообщения {id, dir:'in'|'out', text, att[], ts, who, extId}
//   riks:channels          hash  ch → настройки канала (токены; наружу отдаются только замаскированными)
//   riks:channels:status   hash  ch → {ok, err, at, info}
//   riks:inbox:state       hash  служебное (offset Telegram, последний UID почты и т.п.)
//   riks:seen:<ch>:<extId> строка — защита от дублей (90 дней)

const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { cmd, genId } = require('../../api/_kv.js');
const files = require('../../api/_files_local.js');

const K = { threads: 'riks:threads', ch: 'riks:channels', st: 'riks:channels:status', state: 'riks:inbox:state', msgs: (t) => 'riks:msg:' + t };
const CH = {
  tg: { t: 'Telegram', src: 'Telegram' },
  vk: { t: 'ВКонтакте', src: 'ВКонтакте' },
  mail: { t: 'Почта', src: 'Почта' },
  avito: { t: 'Авито', src: 'Авито' },
  max: { t: 'MAX', src: 'MAX' },
  maxu: { t: 'MAX', src: 'MAX' }
};
const now = () => new Date().toISOString();
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

async function getState(k) { return cmd(['HGET', K.state, k]); }
async function setState(k, v) { return cmd(['HSET', K.state, k, String(v)]); }

async function getChannels() {
  const flat = (await cmd(['HGETALL', K.ch])) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = J(flat[i + 1], {});
  return out;
}
async function setStatus(ch, st) { await cmd(['HSET', K.st, ch, JSON.stringify(Object.assign({ at: now() }, st))]).catch(() => {}); }
async function getStatus() {
  const flat = (await cmd(['HGETALL', K.st])) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = J(flat[i + 1], {});
  return out;
}

// уже видели это сообщение? (true — дубль)
async function seen(ch, extId) {
  if (!extId) return false;
  const r = await cmd(['SET', 'riks:seen:' + ch + ':' + extId, '1', 'NX', 'EX', '7776000']);
  return r !== 'OK';
}

async function getThread(id) { return J(await cmd(['HGET', K.threads, id]), null); }
async function putThread(t) { await cmd(['HSET', K.threads, t.id, JSON.stringify(t)]); return t; }

// сохранить вложение из интернета в хранилище файлов CRM; вернуть {name, path, size, type}
const TRL = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
function safeName(n) {
  const s = String(n || 'file'), dot = s.lastIndexOf('.');
  const ext = dot > 0 ? s.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const base = (dot > 0 ? s.slice(0, dot) : s).toLowerCase().split('').map((c) => (TRL[c] != null ? TRL[c] : c)).join('')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 60) || 'file';
  return base + (ext ? '.' + ext : '');
}
async function saveRemote(ch, url, name, type, headers) {
  try {
    const r = await fetch(url, { headers: headers || {} });
    if (!r.ok || !r.body) return null;
    const p = 'riks/inbox/' + ch + '/' + new Date().toISOString().slice(0, 7) + '/' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex') + '-' + safeName(name);
    const size = await files.saveStream(Readable.fromWeb(r.body), p);
    return { name: clip(name || path.basename(p), 120), path: p, size, type: type || r.headers.get('content-type') || '' };
  } catch (e) { return null; }
}
async function saveBuffer(ch, buf, name, type) {
  try {
    const p = 'riks/inbox/' + ch + '/' + new Date().toISOString().slice(0, 7) + '/' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex') + '-' + safeName(name);
    const size = await files.saveStream(Readable.from([buf]), p);
    return { name: clip(name, 120), path: p, size, type: type || '' };
  } catch (e) { return null; }
}

// новое сообщение (входящее или исходящее, отправленное не из CRM — напр. с телефона)
//   m = { ch, peer, name, text, att, extId, dir, who, ts, meta, phone, noLead, silent }
//   noLead/silent — загрузка старой истории: без лида и без «непрочитанных»
async function addMessage(m) {
  if (await seen(m.ch, m.extId)) return null;
  const id = m.ch + ':' + m.peer;
  const cfg = (await getChannels())[m.ch] || {};
  let t = await getThread(id);
  const isNew = !t;
  if (!t) t = { id, ch: m.ch, peer: String(m.peer), name: '', last: '', ts: now(), unread: 0, meta: {} };
  if (m.name) t.name = clip(m.name, 120);
  t.meta = Object.assign({}, t.meta, m.meta || {});
  if (m.phone && !t.meta.phone) t.meta.phone = clip(m.phone, 40);
  const msg = { id: genId(), dir: m.dir || 'in', text: clip(m.text, 4000), att: (m.att || []).filter(Boolean), ts: m.ts || now(), who: m.who || '', extId: m.extId ? String(m.extId) : '' };
  await cmd(['RPUSH', K.msgs(id), JSON.stringify(msg)]);
  await cmd(['LTRIM', K.msgs(id), '-3000', '-1']);
  t.last = (msg.dir === 'out' ? 'Вы: ' : '') + (msg.text || (msg.att.length ? '📎 ' + (msg.att[0].name || 'вложение') : '')).slice(0, 140);
  t.ts = msg.ts;
  t.lastDir = msg.dir;
  if (msg.dir === 'in' && !m.silent) t.unread = (t.unread || 0) + 1;

  // первое входящее от нового собеседника → лид в CRM (если в настройках канала не выключено)
  const autoLead = cfg.autoLead != null ? !!cfg.autoLead : m.ch !== 'mail';
  if (msg.dir === 'in' && !m.noLead && !t.leadId && !t.clientId && autoLead && (isNew || !t.leadAsked)) {
    const lead = {
      id: genId(), name: t.name, phone: t.meta.phone || '', service: (CH[m.ch] || {}).t ? 'Сообщение: ' + CH[m.ch].t : 'Сообщение',
      detail: clip(msg.text || (msg.att.length ? 'Прислал(а) вложение' : ''), 2500), source: (CH[m.ch] || {}).src || m.ch,
      page: t.meta.item ? 'Объявление: ' + clip(t.meta.item, 50) : '', stage: 'new', note: '', thread: id, ts: now(), upd: now()
    };
    await cmd(['HSET', 'riks:leads', lead.id, JSON.stringify(lead)]);
    t.leadId = lead.id;
  }
  t.leadAsked = true;
  await putThread(t);
  return { thread: t, msg };
}

async function listThreads() {
  const flat = (await cmd(['HGETALL', K.threads])) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) { const t = J(flat[i + 1], null); if (t) out.push(t); }
  out.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
  return out;
}
async function listMessages(tid, n) {
  const raw = (await cmd(['LRANGE', K.msgs(tid), String(-(n || 300)), '-1'])) || [];
  return raw.map((x) => J(x, null)).filter(Boolean);
}

module.exports = { K, CH, now, J, clip, cmd, genId, getState, setState, getChannels, setStatus, getStatus, seen, getThread, putThread, addMessage, listThreads, listMessages, saveRemote, saveBuffer };

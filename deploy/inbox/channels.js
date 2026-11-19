// Подключения каналов «Сообщений». Каждый канал — фоновый цикл в процессе сервера API.
// make(cfg) → { run(signal), send(thread, text) → {extId} }

const C = require('./core.js');

const sleep = (ms, signal) => new Promise((res) => { const t = setTimeout(res, ms); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true }); });
async function getJSON(url, opt, signal) {
  const r = await fetch(url, Object.assign({ signal }, opt || {}));
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('HTTP ' + r.status + ': ' + txt.slice(0, 160)); }
  if (!r.ok && !j.ok) throw Object.assign(new Error((j.description || j.message || j.error_description || (j.error && (j.error.message || j.error.error_msg)) || ('HTTP ' + r.status)) + ''), { status: r.status });
  return j;
}

/* ============================== TELEGRAM ==============================
   Бот @BotFather. Клиенты пишут боту — или (Telegram Business, нужен Premium) бот подключается
   к аккаунту компании и видит обычную переписку: Настройки → Telegram для бизнеса → Чат-боты. */
function telegram(cfg) {
  const API = 'https://api.telegram.org/bot' + cfg.token + '/';
  const owners = {}; // business_connection_id → user id владельца
  const tg = (m, body, signal) => getJSON(API + m, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }, signal);
  async function ownerOf(bc) {
    if (!bc) return null;
    if (owners[bc] == null) { try { const r = await tg('getBusinessConnection', { business_connection_id: bc }); owners[bc] = r.result.user.id; } catch (e) { owners[bc] = 0; } }
    return owners[bc];
  }
  async function fileAtt(fileId, name, type) {
    try {
      const f = await tg('getFile', { file_id: fileId });
      if (!f.result || !f.result.file_path) return null;
      return await C.saveRemote('tg', 'https://api.telegram.org/file/bot' + cfg.token + '/' + f.result.file_path, name || f.result.file_path.split('/').pop(), type);
    } catch (e) { return { name: (name || 'файл') + ' (больше 20 МБ — откройте в Telegram)' }; }
  }
  return {
    async run(signal) {
      const me = await tg('getMe', {}, signal);
      await tg('deleteWebhook', {}, signal).catch(() => {});
      await C.setStatus('tg', { ok: true, info: '@' + me.result.username });
      let off = Number(await C.getState('tg.offset')) || 0;
      while (!signal.aborted) {
        const r = await tg('getUpdates', { offset: off, timeout: 25, allowed_updates: ['message', 'business_message', 'business_connection'] }, signal);
        for (const u of r.result || []) {
          off = u.update_id + 1;
          if (u.business_connection) { owners[u.business_connection.id] = u.business_connection.user.id; continue; }
          const m = u.message || u.business_message;
          if (!m || !m.chat || m.chat.type !== 'private' || (m.from && m.from.is_bot && !u.business_message)) continue;
          const bc = m.business_connection_id || '';
          const own = bc ? await ownerOf(bc) : 0;
          const out = !!(own && m.from && m.from.id === own);
          const c = m.chat;
          const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.username ? '@' + c.username : 'Telegram ' + c.id);
          let text = m.text || m.caption || '';
          const att = [];
          if (m.photo && m.photo.length) att.push(await fileAtt(m.photo[m.photo.length - 1].file_id, 'photo-' + m.message_id + '.jpg', 'image/jpeg'));
          if (m.document) att.push(await fileAtt(m.document.file_id, m.document.file_name, m.document.mime_type));
          if (m.voice) att.push(await fileAtt(m.voice.file_id, 'voice-' + m.message_id + '.ogg', 'audio/ogg'));
          if (m.video) att.push(await fileAtt(m.video.file_id, m.video.file_name || 'video-' + m.message_id + '.mp4', 'video/mp4'));
          if (m.video_note) att.push(await fileAtt(m.video_note.file_id, 'video-' + m.message_id + '.mp4', 'video/mp4'));
          if (m.sticker && !text) text = m.sticker.emoji || '[стикер]';
          let phone = '';
          if (m.contact) { phone = m.contact.phone_number; text = (text ? text + '\n' : '') + '📞 ' + phone; }
          if (m.location) text = (text ? text + '\n' : '') + '📍 https://yandex.ru/maps/?pt=' + m.location.longitude + ',' + m.location.latitude + '&z=17';
          const greet = !bc && text === '/start';
          if (greet) text = 'Открыл(а) чат с ботом';
          await C.addMessage({ ch: 'tg', peer: c.id, name, text, att, phone, dir: out ? 'out' : 'in', who: out ? 'с телефона' : '', extId: c.id + ':' + m.message_id, ts: new Date(m.date * 1000).toISOString(), meta: Object.assign({ username: c.username || '' }, bc ? { bc } : {}) });
          if (greet && cfg.greet !== '') {
            const g = cfg.greet || 'Здравствуйте! Это «Рикс+С» — наружная реклама и печать в Йошкар-Оле. Напишите, что нужно сделать (можно прислать фото или эскиз) — менеджер ответит в рабочее время.';
            try { const s = await tg('sendMessage', { chat_id: c.id, text: g }); await C.addMessage({ ch: 'tg', peer: c.id, text: g, dir: 'out', who: 'автоответ', extId: c.id + ':' + s.result.message_id }); } catch (e) {}
          }
        }
        await C.setState('tg.offset', off);
      }
    },
    async send(t, text) {
      const body = { chat_id: t.peer, text };
      if (t.meta && t.meta.bc) body.business_connection_id = t.meta.bc;
      const r = await tg('sendMessage', body);
      return { extId: t.peer + ':' + r.result.message_id };
    }
  };
}

/* ============================== ВКОНТАКТЕ ==============================
   Сообщения сообщества. Управление → Работа с API → Ключи доступа (права: сообщения, управление),
   Long Poll API: включить, версия 5.199, типы событий: входящее сообщение, исходящее сообщение. */
function vk(cfg) {
  const V = '5.199';
  const call = async (m, p, signal) => {
    const body = new URLSearchParams(Object.assign({ access_token: cfg.token, v: V }, p));
    const j = await getJSON('https://api.vk.com/method/' + m, { method: 'POST', body }, signal);
    if (j.error) throw new Error('VK: ' + j.error.error_msg);
    return j.response;
  };
  const names = {};
  async function nameOf(id) {
    if (names[id]) return names[id];
    try { const u = (await call('users.get', { user_ids: id }))[0]; names[id] = [u.first_name, u.last_name].filter(Boolean).join(' '); } catch (e) { names[id] = 'ВК ' + id; }
    return names[id];
  }
  function atts(list) {
    const out = [];
    for (const a of list || []) {
      if (a.type === 'photo' && a.photo && a.photo.sizes) { const s = a.photo.sizes.slice().sort((x, y) => x.width * x.height - y.width * y.height).pop(); out.push({ name: 'Фото ВК', link: s.url, type: 'image/jpeg' }); }
      else if (a.type === 'doc' && a.doc) out.push({ name: a.doc.title || 'документ', link: a.doc.url });
      else if (a.type === 'audio_message' && a.audio_message) out.push({ name: 'Голосовое', link: a.audio_message.link_mp3 });
      else if (a.type === 'sticker') out.push(null);
      else if (a.type) out.push({ name: '[' + a.type + '] — откройте в ВК', link: 'https://vk.com/gim' + (cfg.groupId || '') });
    }
    return out.filter(Boolean);
  }
  return {
    async run(signal) {
      const g = (await call('groups.getById', {}, signal));
      const grp = (g.groups || g)[0];
      cfg.groupId = grp.id;
      await C.setStatus('vk', { ok: true, info: grp.name });
      let lp = await call('groups.getLongPollServer', { group_id: grp.id }, signal);
      while (!signal.aborted) {
        const r = await getJSON(lp.server + '?act=a_check&key=' + lp.key + '&ts=' + lp.ts + '&wait=25', {}, signal);
        if (r.failed) { if (r.failed === 1) lp.ts = r.ts; else lp = await call('groups.getLongPollServer', { group_id: grp.id }, signal); continue; }
        lp.ts = r.ts;
        for (const u of r.updates || []) {
          if (u.type !== 'message_new' && u.type !== 'message_reply') continue;
          const m = u.type === 'message_new' ? u.object.message : u.object;
          if (!m || m.peer_id >= 2e9) continue; // только личные сообщения сообществу
          const out = u.type === 'message_reply';
          const uid = m.peer_id;
          let text = m.text || '';
          if (m.geo && m.geo.coordinates) text += (text ? '\n' : '') + '📍 https://yandex.ru/maps/?pt=' + m.geo.coordinates.longitude + ',' + m.geo.coordinates.latitude + '&z=17';
          await C.addMessage({ ch: 'vk', peer: uid, name: await nameOf(uid), text, att: atts(m.attachments), dir: out ? 'out' : 'in', who: out ? 'из ВК' : '', extId: m.id || (uid + ':' + m.conversation_message_id), ts: new Date(m.date * 1000).toISOString(), meta: { url: 'https://vk.com/id' + uid } });
        }
      }
    },
    async send(t, text) {
      const id = await call('messages.send', { peer_id: t.peer, message: text, random_id: Math.floor(Math.random() * 2e9) });
      return { extId: typeof id === 'number' ? id : '' };
    }
  };
}

/* ============================== MAX ==============================
   Бот MAX для бизнеса (business.max.ru → Чат-боты → токен). Клиенты пишут боту компании. */
function max(cfg) {
  const B = 'https://platform-api.max.ru';
  const call = (m, opt, signal) => getJSON(B + m + (m.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(cfg.token), Object.assign({ headers: { Authorization: cfg.token, 'Content-Type': 'application/json' } }, opt || {}), signal);
  return {
    async run(signal) {
      const me = await call('/me', {}, signal);
      await C.setStatus('max', { ok: true, info: me.name || me.username || 'бот' });
      let marker = await C.getState('max.marker');
      while (!signal.aborted) {
        const r = await call('/updates?timeout=30&types=message_created,bot_started' + (marker ? '&marker=' + marker : ''), {}, signal);
        for (const u of r.updates || []) {
          if (u.update_type === 'bot_started') {
            await C.addMessage({ ch: 'max', peer: u.chat_id, name: (u.user && u.user.name) || 'MAX', text: 'Открыл(а) чат с ботом', extId: 'start:' + u.chat_id + ':' + u.timestamp });
            continue;
          }
          const m = u.message;
          if (!m || !m.recipient || (m.recipient.chat_type && m.recipient.chat_type !== 'dialog') || (m.sender && m.sender.is_bot)) continue;
          const b = m.body || {};
          const att = (b.attachments || []).map((a) => (a.payload && a.payload.url) ? { name: a.type === 'image' ? 'Фото MAX' : (a.filename || a.type || 'файл'), link: a.payload.url } : null).filter(Boolean);
          await C.addMessage({ ch: 'max', peer: m.recipient.chat_id, name: (m.sender && (m.sender.name || m.sender.username)) || 'MAX', text: b.text || '', att, extId: b.mid, ts: m.timestamp ? new Date(m.timestamp).toISOString() : undefined });
        }
        if (r.marker) { marker = r.marker; await C.setState('max.marker', marker); }
      }
    },
    async send(t, text) {
      const r = await call('/messages?chat_id=' + encodeURIComponent(t.peer), { method: 'POST', body: JSON.stringify({ text }) });
      return { extId: r && r.message && r.message.body ? r.message.body.mid : '' };
    }
  };
}

/* ============================== АВИТО ==============================
   Мессенджер Авито через API (нужен тариф с доступом к API): avito.ru/professionals/api →
   Client ID и Client Secret. Опрос раз в 30 секунд. */
function avito(cfg) {
  const B = 'https://api.avito.ru';
  let tok = '', tokTill = 0, uid = '';
  async function token(signal) {
    if (tok && Date.now() < tokTill) return tok;
    const j = await getJSON(B + '/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret }) }, signal);
    tok = j.access_token; tokTill = Date.now() + ((j.expires_in || 3600) - 120) * 1000;
    return tok;
  }
  const call = async (m, opt, signal) => getJSON(B + m, Object.assign({}, opt || {}, { headers: Object.assign({ Authorization: 'Bearer ' + await token(signal), 'Content-Type': 'application/json' }, (opt && opt.headers) || {}) }), signal);
  return {
    async run(signal) {
      const me = await call('/core/v1/accounts/self', {}, signal);
      uid = me.id;
      await C.setStatus('avito', { ok: true, info: me.name || ('аккаунт ' + uid) });
      const first = !(await C.getState('avito.init'));
      while (!signal.aborted) {
        const r = await call('/messenger/v2/accounts/' + uid + '/chats?limit=50&chat_types=u2i,u2u', {}, signal);
        for (const ch of r.chats || []) {
          const lm = ch.last_message || {};
          const t = await C.getThread('avito:' + ch.id);
          if (t && t.meta && t.meta.lastId === lm.id) continue;
          const other = (ch.users || []).find((u) => String(u.id) !== String(uid)) || {};
          const item = ch.context && ch.context.value ? ch.context.value : {};
          const ms = await call('/messenger/v3/accounts/' + uid + '/chats/' + ch.id + '/messages/?limit=' + (first ? 20 : 50), {}, signal);
          const list = (ms.messages || []).slice().sort((a, b) => (a.created || 0) - (b.created || 0));
          for (const m of list) {
            if (m.type === 'system' && !(m.content && m.content.text)) continue;
            const c = m.content || {};
            let text = c.text || (c.link && c.link.url) || (c.item && c.item.title ? 'Объявление: ' + c.item.title : '') || (c.location ? '📍 ' + (c.location.text || '') : '');
            const att = [];
            if (c.image && c.image.sizes) { const k = Object.keys(c.image.sizes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).pop(); att.push({ name: 'Фото Авито', link: c.image.sizes[k], type: 'image/jpeg' }); }
            if (m.type === 'voice') text = text || '[голосовое — откройте в Авито]';
            const out = m.direction === 'out';
            const res = await C.addMessage({ ch: 'avito', peer: ch.id, name: other.name || 'Авито', text, att, dir: out ? 'out' : 'in', who: out ? 'из Авито' : '', extId: m.id, ts: m.created ? new Date(m.created * 1000).toISOString() : undefined, meta: { item: item.title || '', itemUrl: item.url || '', lastId: lm.id } });
            if (first && res && res.thread && res.thread.unread) { res.thread.unread = 0; await C.putThread(res.thread); }
          }
          const t2 = await C.getThread('avito:' + ch.id);
          if (t2) { t2.meta = Object.assign({}, t2.meta, { lastId: lm.id }); await C.putThread(t2); }
        }
        if (first) await C.setState('avito.init', '1');
        await sleep(30000, signal);
      }
    },
    async send(t, text) {
      if (!uid) uid = (await call('/core/v1/accounts/self')).id;
      const r = await call('/messenger/v1/accounts/' + uid + '/chats/' + t.peer + '/messages', { method: 'POST', body: JSON.stringify({ message: { text }, type: 'text' }) });
      return { extId: r.id || '' };
    }
  };
}

/* ============================== ПОЧТА ==============================
   IMAP (чтение) + SMTP (ответ). Яндекс 360: imap.yandex.ru:993, smtp.yandex.ru:465,
   пароль — «пароль приложения» (id.yandex.ru → Безопасность → Пароли приложений → Почта). */
function mail(cfg) {
  let ImapFlow, simpleParser, nodemailer;
  const load = () => {
    ImapFlow = ImapFlow || require('imapflow').ImapFlow;
    simpleParser = simpleParser || require('mailparser').simpleParser;
    nodemailer = nodemailer || require('nodemailer');
  };
  const imapOpt = () => ({ host: cfg.imapHost || 'imap.yandex.ru', port: Number(cfg.imapPort) || 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
  async function poll() {
    const client = new ImapFlow(imapOpt());
    await client.connect();
    try {
      const box = await client.mailboxOpen('INBOX');
      let last = Number(await C.getState('mail.uid:' + cfg.user)) || 0;
      if (!last || last >= box.uidNext) { last = Math.max(0, box.uidNext - 1); await C.setState('mail.uid:' + cfg.user, last); return; }
      for await (const msg of client.fetch({ uid: (last + 1) + ':*' }, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= last) continue;
        last = Math.max(last, msg.uid);
        const p = await simpleParser(msg.source);
        const from = (p.from && p.from.value && p.from.value[0]) || {};
        const addr = String(from.address || '').toLowerCase();
        if (!addr || addr === String(cfg.user).toLowerCase() || /no-?reply|mailer-daemon|postmaster/i.test(addr)) continue;
        let text = String(p.text || '').replace(/\r/g, '');
        const cut = text.search(/\n(>|.*(пишет|wrote):\s*\n)/i); if (cut > 40) text = text.slice(0, cut);
        const att = [];
        for (const a of (p.attachments || []).slice(0, 10)) if (a.content && a.size < 60 * 1048576) att.push(await C.saveBuffer('mail', a.content, a.filename || 'attachment', a.contentType));
        await C.addMessage({ ch: 'mail', peer: addr, name: from.name || addr, text: (p.subject ? '«' + p.subject + '»\n' : '') + text.trim(), att, extId: p.messageId || ('uid' + msg.uid), ts: (p.date || new Date()).toISOString(), meta: { subject: p.subject || '', msgId: p.messageId || '' } });
      }
      await C.setState('mail.uid:' + cfg.user, last);
    } finally { await client.logout().catch(() => {}); }
  }
  return {
    async run(signal) {
      load();
      await poll();
      await C.setStatus('mail', { ok: true, info: cfg.user });
      while (!signal.aborted) { await sleep(60000, signal); if (signal.aborted) break; await poll(); await C.setStatus('mail', { ok: true, info: cfg.user }); }
    },
    async send(t, text) {
      load();
      const tr = nodemailer.createTransport({ host: cfg.smtpHost || 'smtp.yandex.ru', port: Number(cfg.smtpPort) || 465, secure: true, auth: { user: cfg.user, pass: cfg.pass } });
      const subj = (t.meta && t.meta.subject) ? (/^re:/i.test(t.meta.subject) ? t.meta.subject : 'Re: ' + t.meta.subject) : 'Рикс+С';
      const r = await tr.sendMail({ from: { name: cfg.fromName || 'Рикс+С', address: cfg.user }, to: t.peer, subject: subj, text, inReplyTo: t.meta && t.meta.msgId || undefined, references: t.meta && t.meta.msgId || undefined });
      return { extId: r.messageId || '' };
    }
  };
}

// какие поля обязательны, какие секретные
const DEF = {
  tg: { make: telegram, need: ['token'], secret: ['token'] },
  vk: { make: vk, need: ['token'], secret: ['token'] },
  max: { make: max, need: ['token'], secret: ['token'] },
  avito: { make: avito, need: ['clientId', 'clientSecret'], secret: ['clientSecret'] },
  mail: { make: mail, need: ['user', 'pass'], secret: ['pass'] }
};

module.exports = { DEF, sleep };

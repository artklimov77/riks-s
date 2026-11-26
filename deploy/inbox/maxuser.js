// Канал «MAX (номер)» — рабочий аккаунт MAX целиком: личные диалоги с клиентами приходят в CRM,
// ответы из CRM уходят от имени аккаунта. Неофициально (протокол веб-версии) — см. maxweb.js.
// Вход — по QR-коду из CRM (qrStart/qrView/qrPassword); ключ сессии и deviceId хранятся в настройках канала.
// Диалоги один на один — все. Беседы (группы) — только выбранные в CRM: «Поставщики» или «Между собой»
// (state maxu.groups = { chatId: 'supplier'|'team' }); список бесед для выбора — state maxu.chats. Каналы MAX не берём.

const crypto = require('crypto');
const C = require('./core.js');
const W = require('./maxweb.js');
const { OP } = W;

const sleep = (ms, signal) => new Promise((res) => { const t = setTimeout(res, ms); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true }); });
const idOut = (v) => { const s = String(v); const n = Number(s); return Number.isSafeInteger(n) ? n : BigInt(s); }; // id → для запроса
const tokKey = (tok) => 'maxu.tok.' + crypto.createHash('sha1').update(String(tok)).digest('hex').slice(0, 12);
const AUTH_ERR = /login|token|auth|session/i;

function nameFrom(c) {
  if (!c) return '';
  const n = c.names || [];
  const full = n.find((x) => x.type === 'FULL_NAME') || n[0] || {};
  return (full.name || [full.firstName, full.lastName].filter(Boolean).join(' ') || '').trim();
}
const phoneFrom = (c) => { const p = (c && (c.phones || [])[0]) || {}; return p.number || (c && c.phone ? String(c.phone) : ''); };

function channel(cfg) {
  let conn = null, me = null;
  const chats = {};   // chatId → { type, peer }
  const people = {};  // userId → { name, phone }
  let queue = Promise.resolve();
  let groups = {};    // chatId → 'supplier' | 'team' (выбрано в CRM)
  let chatsDirty = false;

  async function person(uid) {
    if (people[uid]) return people[uid];
    try {
      const r = await conn.request(OP.CONTACT_INFO, { contactIds: [idOut(uid)] });
      const c = (r.contacts || [])[0];
      people[uid] = { name: nameFrom(c) || ('MAX ' + uid), phone: phoneFrom(c) };
    } catch (e) { people[uid] = { name: 'MAX ' + uid, phone: '' }; }
    return people[uid];
  }
  function remember(ch) {
    if (!ch || ch.id == null) return;
    const ids = Object.keys(ch.participants || {}).filter((x) => String(x) !== String(me));
    const old = chats[String(ch.id)] || {}, lm = ch.lastMessage || {};
    chats[String(ch.id)] = {
      type: ch.type || '', peer: ids.length === 1 ? ids[0] : old.peer,
      title: ch.title || old.title || '', count: ch.participantsCount || Object.keys(ch.participants || {}).length || old.count || 0,
      lastTs: Number(lm.time || ch.lastEventTime || old.lastTs || 0), last: String(lm.text || old.last || '').slice(0, 80)
    };
    if (ch.type === 'CHAT') chatsDirty = true;
  }
  // список бесед — для выбора в CRM (Настройки → Каналы связи → MAX · номер → Беседы)
  async function publishChats() {
    if (!chatsDirty) return;
    chatsDirty = false;
    const list = Object.entries(chats).filter(([, c]) => c.type === 'CHAT')
      .map(([id, c]) => ({ id, title: c.title, count: c.count, lastTs: c.lastTs, last: c.last }))
      .sort((a, b) => b.lastTs - a.lastTs).slice(0, 200);
    await C.setState('maxu.chats', JSON.stringify(list));
  }
  // выбор бесед из CRM: новые — подтягиваем последние сообщения, сменили раздел — переносим диалог
  async function loadGroups() {
    const g = C.J(await C.getState('maxu.groups'), {}) || {};
    for (const [id, kind] of Object.entries(g)) {
      if (!kind) continue;
      if (groups[id] && groups[id] !== kind) { const t = await C.getThread('maxu:' + id); if (t) { t.kind = kind; await C.putThread(t); } }
      if (!(await C.getState('maxu.gimp.' + id))) {
        await C.setState('maxu.gimp.' + id, C.now());
        groups[id] = kind;
        queue = queue.then(() => importChat(id, 50)).catch(() => {});
      }
    }
    groups = g;
  }
  async function chatOf(chatId) {
    const k = String(chatId);
    if (!chats[k]) {
      try { const r = await conn.request(OP.CHAT_INFO, { chatIds: [idOut(chatId)] }); (r.chats || []).forEach(remember); } catch (e) {}
      if (!chats[k]) chats[k] = { type: '?' };
    }
    return chats[k];
  }
  async function atts(chatId, m, save) {
    const out = [];
    for (const a of m.attaches || []) {
      const t = a._type || a.type;
      try {
        if (t === 'PHOTO' && a.baseUrl) {
          const s = save ? await C.saveRemote('maxu', a.baseUrl, 'foto-max.jpg', 'image/jpeg') : null;
          out.push(s || { name: 'Фото MAX', link: a.baseUrl, type: 'image/jpeg' });
        } else if (t === 'FILE' && a.fileId != null) {
          let url = '';
          if (save) { try { const r = await conn.request(OP.FILE_DOWNLOAD, { requestId: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)), fileId: BigInt(String(a.fileId)), fileName: a.name || '', messageId: BigInt(String(m.id)), chatId: BigInt(String(chatId)) }); url = r.url || ''; } catch (e) {} }
          const s = url ? await C.saveRemote('maxu', url, a.name || 'fail', '') : null;
          out.push(s || { name: (a.name || 'файл') + ' — откройте в MAX', link: 'https://web.max.ru/' });
        } else if (t === 'STICKER') out.push(null);
        else if (t === 'CONTROL' || t === 'CALL') out.push(null);
        else if (t) out.push({ name: '[' + String(t).toLowerCase() + '] — откройте в MAX', link: 'https://web.max.ru/' });
      } catch (e) {}
    }
    return out.filter(Boolean);
  }
  // одно сообщение → CRM. opt: { history } — загрузка истории при первом входе (без лидов и непрочитанных)
  async function take(chatId, m, opt) {
    if (!m || m.id == null) return;
    if (m.type && m.type !== 'USER') return;
    const ch = await chatOf(chatId);
    const mine = String(m.sender) === String(me);
    const kind = ch.type === 'CHAT' ? groups[String(chatId)] : null;
    if (kind) { // беседа, выбранная в CRM: подпись автора у каждого сообщения, лидов нет
      const att = await atts(chatId, m, !(opt && opt.history));
      if (!m.text && !att.length) return;
      const who = mine ? 'с телефона' : (await person(String(m.sender))).name;
      await C.addMessage({
        ch: 'maxu', peer: String(chatId), name: ch.title || 'Беседа MAX', text: m.text || '', att, kind,
        dir: mine ? 'out' : 'in', who, extId: String(m.id), ts: m.time ? new Date(Number(m.time)).toISOString() : undefined,
        meta: { group: true, count: ch.count || 0 }, noLead: true, silent: !!(opt && opt.history)
      });
      return;
    }
    if (ch.type !== 'DIALOG') return; // остальные группы, каналы, «Избранное» — мимо
    const peer = ch.peer || (!mine ? String(m.sender) : null);
    if (!peer) return;
    const p = await person(peer);
    const text = m.text || '';
    const att = await atts(chatId, m, !(opt && opt.history));
    if (!text && !att.length) return;
    await C.addMessage({
      ch: 'maxu', peer: String(chatId), name: p.name, phone: p.phone, text, att,
      dir: mine ? 'out' : 'in', who: mine ? 'с телефона' : '', extId: String(m.id),
      ts: m.time ? new Date(Number(m.time)).toISOString() : undefined,
      meta: { uid: String(peer) }, noLead: !!(opt && opt.history), silent: !!(opt && opt.history)
    });
  }
  // прочитали в MAX на телефоне → в CRM снимаем «непрочитано». Отметки собеседника («он прочитал наше») не трогаем.
  let markLogged = false;
  async function markedElsewhere(p) {
    if (!markLogged) { markLogged = true; C.setState('maxu.lastMark', JSON.stringify(p, (k, v) => typeof v === 'bigint' ? String(v) : v).slice(0, 300)).catch(() => {}); }
    const uid = p.userId != null ? p.userId : p.contactId;
    if (p.chatId == null || uid == null || String(uid) !== String(me)) return;
    const t = await C.getThread('maxu:' + String(p.chatId));
    if (t && t.unread) { t.unread = 0; await C.putThread(t); }
  }
  async function importChat(id, n) {
    try {
      const r = await conn.request(OP.CHAT_HISTORY, { chatId: idOut(id), from: Date.now(), forward: 0, backward: n || 30, getMessages: true });
      const ms = (r.messages || []).slice().sort((a, b) => Number(a.time) - Number(b.time));
      for (const m of ms) await take(id, m, { history: true });
    } catch (e) {}
  }
  async function importHistory(list) {
    const dialogs = list.filter((c) => c.type === 'DIALOG').slice(0, 30);
    for (const c of dialogs) { await importChat(c.id, 30); await sleep(400); }
  }

  return {
    async run(signal) {
      let token = (await C.getState(tokKey(cfg.token))) || cfg.token;
      let closed;
      const gone = new Promise((res) => { closed = res; });
      conn = await W.connect({
        deviceId: cfg.deviceId, signal,
        onClose: (why) => closed(why),
        onPush: (f, c) => {
          if (f.opcode === OP.NOTIF_MARK && f.payload) { queue = queue.then(() => markedElsewhere(f.payload)).catch(() => {}); return; }
          if (f.opcode !== OP.NOTIF_MESSAGE || !f.payload) return;
          const p = f.payload, m = p.message || p, chatId = p.chatId != null ? p.chatId : m.chatId;
          if (chatId != null && m.id != null) c.reply(f, { chatId, messageId: m.id }); // подтверждение доставки, как у веб-клиента
          queue = queue.then(() => take(chatId, m)).catch((e) => console.error(new Date().toISOString(), 'inbox maxu', e.message));
        }
      });
      let login;
      try {
        login = await conn.request(OP.LOGIN, { interactive: true, token, chatsCount: 100, chatsSync: 0, contactsSync: 0, presenceSync: -1, draftsSync: 0 });
      } catch (e) {
        conn.close();
        if (e.code && AUTH_ERR.test(String(e.code))) {
          // сессию завершили (в приложении MAX → Устройства) или ключ устарел: ждём нового входа по QR, сервер не дёргаем
          await C.setStatus('maxu', { ok: false, err: 'Вход в MAX завершён — нажмите «Войти по QR-коду» ещё раз' });
          await sleep(7 * 24 * 3600e3, signal);
          return;
        }
        throw e;
      }
      const nt = W.tokenOf(login);
      if (nt && nt !== token) { token = nt; await C.setState(tokKey(cfg.token), nt); }
      const prof = (login.profile && login.profile.contact) || {};
      me = prof.id;
      people[String(me)] = { name: nameFrom(prof), phone: phoneFrom(prof) };
      for (const c of login.chats || []) remember(c);
      await publishChats();
      await loadGroups();
      const tick = setInterval(() => { publishChats().then(loadGroups).catch(() => {}); }, 10000);
      signal.addEventListener('abort', () => clearInterval(tick), { once: true });
      gone.then(() => clearInterval(tick));
      await C.setStatus('maxu', { ok: true, info: [nameFrom(prof), phoneFrom(prof)].filter(Boolean).join(' · ') || 'аккаунт MAX' });
      const flag = 'maxu.imported.' + me;
      if (!(await C.getState(flag))) {
        await C.setState(flag, new Date().toISOString());
        queue = queue.then(() => importHistory(login.chats || [])).catch(() => {});
      }
      const why = await Promise.race([gone, new Promise((res) => signal.addEventListener('abort', () => res(''), { once: true }))]);
      conn.close();
      if (!signal.aborted) throw new Error('MAX: ' + why);
    },
    // открыли диалог в CRM → в MAX он тоже становится прочитанным
    async read(t) {
      if (!conn || conn.closed) return;
      const list = await C.listMessages(t.id, 50);
      const last = list.filter((m) => m.dir === 'in' && m.extId).pop();
      if (!last || (t.meta && t.meta.readExt === last.extId)) return; // уже отмечали
      const ask = (mid) => conn.request(OP.CHAT_MARK, { type: 'READ_MESSAGE', chatId: idOut(t.peer), messageId: mid, mark: Date.now() });
      let r, how = 'str';
      try { r = await ask(String(last.extId)); } catch (e) { how = 'num'; r = await ask(idOut(last.extId)); } // формат id у MAX: пробуем оба
      const t2 = await C.getThread(t.id);
      if (t2) { t2.meta = Object.assign({}, t2.meta, { readExt: last.extId }); await C.putThread(t2); }
      await C.setState('maxu.lastRead', JSON.stringify({ at: C.now(), tid: t.id, how, r: JSON.stringify(r || {}, (k, v) => typeof v === 'bigint' ? String(v) : v).slice(0, 200) }));
    },
    async send(t, text) {
      if (!conn || conn.closed) throw new Error('MAX: нет соединения, попробуйте через минуту');
      const r = await conn.request(OP.MSG_SEND, { chatId: idOut(t.peer), message: { text, cid: Math.floor(Math.random() * 2e9), elements: [], attaches: [] }, notify: true });
      return { extId: r && r.message && r.message.id != null ? String(r.message.id) : '' };
    }
  };
}

/* ---------------- вход по QR-коду (из CRM) ---------------- */
let QR = null; // { deviceId, conn, trackId, qrLink, expiresAt, poll, state: wait|password|ok|expired|error, hint, err, challenge }

function qrView() {
  if (!QR) return { state: 'none' };
  return { state: QR.state, qrLink: QR.state === 'wait' ? QR.qrLink : '', expiresAt: QR.expiresAt, hint: QR.hint || '', err: QR.err || '' };
}
async function finish(S, r) {
  if (r && r.passwordChallenge) { S.state = 'password'; S.challenge = r.passwordChallenge; S.hint = r.passwordChallenge.hint || ''; return; }
  const token = W.tokenOf(r);
  if (!token) { S.state = 'error'; S.err = 'MAX не выдал ключ входа'; S.conn.close(); return; }
  const cur = (await C.getChannels()).maxu || {};
  const next = Object.assign({}, cur, { token, deviceId: S.deviceId, enabled: true });
  await C.cmd(['HSET', C.K.ch, 'maxu', JSON.stringify(next)]);
  await C.setStatus('maxu', { ok: false, pending: true });
  S.state = 'ok'; S.conn.close();
  require('./manager.js').sync();
}
async function loop(S) {
  while (QR === S && S.state === 'wait' && Date.now() < S.expiresAt) {
    await sleep(S.poll);
    if (QR !== S || S.state !== 'wait') return;
    try {
      const st = await S.conn.request(OP.QR_STATUS, { trackId: S.trackId });
      if (st.status && st.status.loginAvailable) { await finish(S, await S.conn.request(OP.LOGIN_BY_QR, { trackId: S.trackId })); return; }
    } catch (e) { S.state = 'error'; S.err = e.message; S.conn.close(); return; }
  }
  if (QR === S && S.state === 'wait') { S.state = 'expired'; S.conn.close(); }
}
async function qrStart() {
  if (QR && QR.conn) QR.conn.close();
  const deviceId = W.newDeviceId();
  const conn = await W.connect({ deviceId });
  const q = await conn.request(OP.GET_QR, undefined);
  if (!q.qrLink || !q.trackId) { conn.close(); throw new Error('MAX не выдал QR-код'); }
  QR = { deviceId, conn, trackId: q.trackId, qrLink: q.qrLink, expiresAt: Number(q.expiresAt) || Date.now() + 110000, poll: Number(q.pollingInterval) || 5000, state: 'wait' };
  loop(QR);
  return qrView();
}
async function qrPassword(pw) {
  const S = QR;
  if (!S || S.state !== 'password') throw new Error('Пароль сейчас не нужен');
  try { await finish(S, await S.conn.request(OP.PASSWORD, { trackId: S.challenge.trackId, password: String(pw || '') })); }
  catch (e) { S.err = /password|пароль/i.test(e.message) ? 'Неверный пароль' : e.message; }
  return qrView();
}
function qrCancel() { if (QR && QR.conn) QR.conn.close(); QR = null; return { state: 'none' }; }

module.exports = { channel, qrStart, qrView, qrPassword, qrCancel };

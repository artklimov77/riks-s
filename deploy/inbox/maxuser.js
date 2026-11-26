// Канал «MAX (номер)» — рабочий аккаунт MAX целиком: личные диалоги с клиентами приходят в CRM,
// ответы из CRM уходят от имени аккаунта. Неофициально (протокол веб-версии) — см. maxweb.js.
// Вход — по QR-коду из CRM (qrStart/qrView/qrPassword); ключ сессии и deviceId хранятся в настройках канала.
// Группы и каналы MAX не берём — только диалоги один на один.

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
    chats[String(ch.id)] = { type: ch.type || '', peer: ids.length === 1 ? ids[0] : (chats[String(ch.id)] || {}).peer };
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
    if (ch.type !== 'DIALOG') return; // группы, каналы, «Избранное» — мимо
    const mine = String(m.sender) === String(me);
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
  async function importHistory(list) {
    const dialogs = list.filter((c) => c.type === 'DIALOG').slice(0, 30);
    for (const c of dialogs) {
      try {
        const r = await conn.request(OP.CHAT_HISTORY, { chatId: idOut(c.id), from: Date.now(), forward: 0, backward: 30, getMessages: true });
        const ms = (r.messages || []).slice().sort((a, b) => Number(a.time) - Number(b.time));
        for (const m of ms) await take(c.id, m, { history: true });
      } catch (e) {}
      await sleep(400);
    }
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
          if (f.opcode !== OP.NOTIF_MESSAGE || !f.payload) return;
          const p = f.payload, m = p.message || p, chatId = p.chatId != null ? p.chatId : m.chatId;
          if (chatId != null && m.id != null) c.reply(f, { chatId, messageId: m.id }); // подтверждение доставки, как у веб-клиента
          queue = queue.then(() => take(chatId, m)).catch((e) => console.error(new Date().toISOString(), 'inbox maxu', e.message));
        }
      });
      let login;
      try {
        login = await conn.request(OP.LOGIN, { interactive: true, token, chatsCount: 40, chatsSync: 0, contactsSync: 0, presenceSync: -1, draftsSync: 0 });
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

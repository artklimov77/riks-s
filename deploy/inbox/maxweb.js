// Личный (рабочий) аккаунт MAX — как веб-версия web.max.ru (НЕОФИЦИАЛЬНО: протокол веб-клиента, не публичный API).
// Вход: QR-код в CRM → в приложении MAX «Профиль → Устройства → Подключить устройство» → сканировать.
// CRM становится ещё одним «устройством» аккаунта (видно в списке устройств, можно завершить оттуда).
//
// Протокол (с 19.11.2026): wss://api.oneme.ru/websocket, Origin https://web.max.ru, бинарные кадры:
//   [0] ver=10  [1] cmd (0 запрос/пуш, 1 ответ, 3 ошибка)  [2..3] seq int16  [4..5] opcode int16
//   [6] LZ4-фактор (0 — без сжатия)  [7..9] длина uint24  [10..] msgpack; int64 — msgpack ext type 1.
// Без внешних зависимостей: свой msgpack и распаковка LZ4.

const crypto = require('crypto');

const URL_WS = 'wss://api.oneme.ru/websocket';
const ORIGIN = 'https://web.max.ru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const APP_VERSION = process.env.MAX_WEB_APP_VERSION || '26.11.9';
const OP = { PING: 1, SESSION_INIT: 6, LOGIN: 19, CONTACT_INFO: 32, CHAT_INFO: 48, CHAT_HISTORY: 49, FILE_DOWNLOAD: 88, CHAT_MARK: 50, MSG_SEND: 64, PASSWORD: 115, NOTIF_MESSAGE: 128, GET_QR: 288, QR_STATUS: 289, LOGIN_BY_QR: 291 };

/* ---------------- msgpack ---------------- */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const big2num = (v) => (v >= -MAX_SAFE && v <= MAX_SAFE ? Number(v) : v);

function encode(v) {
  const parts = [];
  const u8 = (...b) => parts.push(Buffer.from(b));
  const wr = (n, fn, val) => { const b = Buffer.alloc(n); b[fn](val, 0); parts.push(b); };
  function int64(x) { // bigint → uint64/int64
    const b = Buffer.alloc(9);
    if (x >= 0n) { b[0] = 0xcf; b.writeBigUInt64BE(x, 1); } else { b[0] = 0xd3; b.writeBigInt64BE(x, 1); }
    return b;
  }
  function str(s) {
    const b = Buffer.from(s, 'utf8'), n = b.length;
    if (n < 32) u8(0xa0 | n); else if (n < 256) u8(0xd9, n); else if (n < 65536) { u8(0xda); wr(2, 'writeUInt16BE', n); } else { u8(0xdb); wr(4, 'writeUInt32BE', n); }
    parts.push(b);
  }
  function go(x) {
    if (x === null || x === undefined) return u8(0xc0);
    if (x === true) return u8(0xc3);
    if (x === false) return u8(0xc2);
    if (typeof x === 'bigint') { const d = int64(x); u8(0xc7, d.length, 1); parts.push(d); return; } // ext type 1
    if (typeof x === 'number') {
      if (Number.isInteger(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER) {
        if (x >= 0) {
          if (x < 128) return u8(x);
          if (x < 256) return u8(0xcc, x);
          if (x < 65536) { u8(0xcd); return wr(2, 'writeUInt16BE', x); }
          if (x < 4294967296) { u8(0xce); return wr(4, 'writeUInt32BE', x); }
          return parts.push(int64(BigInt(x)));
        }
        if (x >= -32) return u8(x & 0xff);
        if (x >= -128) { u8(0xd0); return wr(1, 'writeInt8', x); }
        if (x >= -32768) { u8(0xd1); return wr(2, 'writeInt16BE', x); }
        if (x >= -2147483648) { u8(0xd2); return wr(4, 'writeInt32BE', x); }
        return parts.push(int64(BigInt(x)));
      }
      u8(0xcb); return wr(8, 'writeDoubleBE', x);
    }
    if (typeof x === 'string') return str(x);
    if (Buffer.isBuffer(x)) { const n = x.length; if (n < 256) u8(0xc4, n); else { u8(0xc6); wr(4, 'writeUInt32BE', n); } parts.push(x); return; }
    if (Array.isArray(x)) {
      const n = x.length;
      if (n < 16) u8(0x90 | n); else if (n < 65536) { u8(0xdc); wr(2, 'writeUInt16BE', n); } else { u8(0xdd); wr(4, 'writeUInt32BE', n); }
      x.forEach(go); return;
    }
    if (typeof x === 'object') {
      const ks = Object.keys(x).filter((k) => x[k] !== undefined), n = ks.length;
      if (n < 16) u8(0x80 | n); else if (n < 65536) { u8(0xde); wr(2, 'writeUInt16BE', n); } else { u8(0xdf); wr(4, 'writeUInt32BE', n); }
      for (const k of ks) { str(k); go(x[k]); }
      return;
    }
    u8(0xc0);
  }
  go(v);
  return Buffer.concat(parts);
}

function decode(buf) {
  let p = 0;
  const str = (n) => { const s = buf.toString('utf8', p, p + n); p += n; return s; };
  const arr = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = go(); return a; };
  const map = (n) => { const o = {}; for (let i = 0; i < n; i++) { const k = go(); o[String(k)] = go(); } return o; };
  const ext = (n) => {
    const type = buf.readInt8(p); p++;
    const data = buf.subarray(p, p + n); p += n;
    if (type === 1) { try { const v = decode(data); return typeof v === 'bigint' ? big2num(v) : v; } catch (e) { return null; } }
    return { ext: type, data };
  };
  function go() {
    const b = buf[p++];
    if (b <= 0x7f) return b;
    if (b >= 0xe0) return b - 256;
    if ((b & 0xf0) === 0x80) return map(b & 0x0f);
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f);
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f);
    let v;
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: v = buf[p]; p += 1; { const d = buf.subarray(p, p + v); p += v; return d; }
      case 0xc5: v = buf.readUInt16BE(p); p += 2; { const d = buf.subarray(p, p + v); p += v; return d; }
      case 0xc6: v = buf.readUInt32BE(p); p += 4; { const d = buf.subarray(p, p + v); p += v; return d; }
      case 0xc7: v = buf[p]; p += 1; return ext(v);
      case 0xc8: v = buf.readUInt16BE(p); p += 2; return ext(v);
      case 0xc9: v = buf.readUInt32BE(p); p += 4; return ext(v);
      case 0xca: v = buf.readFloatBE(p); p += 4; return v;
      case 0xcb: v = buf.readDoubleBE(p); p += 8; return v;
      case 0xcc: return buf[p++];
      case 0xcd: v = buf.readUInt16BE(p); p += 2; return v;
      case 0xce: v = buf.readUInt32BE(p); p += 4; return v;
      case 0xcf: v = buf.readBigUInt64BE(p); p += 8; return big2num(v);
      case 0xd0: v = buf.readInt8(p); p += 1; return v;
      case 0xd1: v = buf.readInt16BE(p); p += 2; return v;
      case 0xd2: v = buf.readInt32BE(p); p += 4; return v;
      case 0xd3: v = buf.readBigInt64BE(p); p += 8; return big2num(v);
      case 0xd4: return ext(1);
      case 0xd5: return ext(2);
      case 0xd6: return ext(4);
      case 0xd7: return ext(8);
      case 0xd8: return ext(16);
      case 0xd9: v = buf[p]; p += 1; return str(v);
      case 0xda: v = buf.readUInt16BE(p); p += 2; return str(v);
      case 0xdb: v = buf.readUInt32BE(p); p += 4; return str(v);
      case 0xdc: v = buf.readUInt16BE(p); p += 2; return arr(v);
      case 0xdd: v = buf.readUInt32BE(p); p += 4; return arr(v);
      case 0xde: v = buf.readUInt16BE(p); p += 2; return map(v);
      case 0xdf: v = buf.readUInt32BE(p); p += 4; return map(v);
    }
    throw new Error('msgpack: неизвестный байт 0x' + b.toString(16));
  }
  return go();
}

/* ---------------- LZ4 (блок) ---------------- */
function lz4(src, size) {
  const out = Buffer.alloc(size);
  let s = 0, d = 0;
  while (s < src.length) {
    const tok = src[s++];
    let lit = tok >> 4;
    if (lit === 15) { let b; do { b = src[s++]; lit += b; } while (b === 255); }
    src.copy(out, d, s, s + lit); s += lit; d += lit;
    if (s >= src.length) break;
    const off = src[s] | (src[s + 1] << 8); s += 2;
    let ml = tok & 15;
    if (ml === 15) { let b; do { b = src[s++]; ml += b; } while (b === 255); }
    ml += 4;
    for (let i = 0; i < ml; i++, d++) out[d] = out[d - off];
  }
  return out.subarray(0, d);
}

/* ---------------- кадры ---------------- */
function pack(cmd, seq, opcode, payload) {
  const body = payload === undefined ? Buffer.alloc(0) : encode(payload);
  const h = Buffer.alloc(10);
  h[0] = 10; h[1] = cmd; h.writeInt16BE(((seq % 0x8000) + 0x8000) % 0x8000, 2); h.writeInt16BE(opcode, 4); h[6] = 0; h.writeUIntBE(body.length, 7, 3);
  return Buffer.concat([h, body]);
}
function unpack(data) {
  const b = Buffer.from(data);
  const f = { ver: b[0], cmd: b[1], seq: b.readInt16BE(2), opcode: b.readInt16BE(4), payload: undefined };
  const factor = b[6], len = b.readUIntBE(7, 3);
  if (len) {
    let body = b.subarray(10, 10 + len);
    if (factor > 0) body = lz4(body, len * factor);
    f.payload = decode(body);
  }
  return f;
}

/* ---------------- соединение ---------------- */
// onPush(frame) — пуши сервера (cmd 0). request(opcode, payload) → payload ответа (ошибка → throw).
function connect({ deviceId, signal, onPush, onClose }) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(URL_WS, { headers: { Origin: ORIGIN, 'User-Agent': UA } }); } catch (e) { return reject(e); }
    ws.binaryType = 'arraybuffer';
    let seq = 0, closed = false, pingT = null;
    const wait = new Map();
    const conn = {
      request(opcode, payload, ms) {
        if (closed) return Promise.reject(new Error('MAX: соединение закрыто'));
        const s = seq++ % 0x8000;
        return new Promise((res, rej) => {
          const t = setTimeout(() => { wait.delete(s); rej(new Error('MAX: нет ответа (opcode ' + opcode + ')')); }, ms || 20000);
          wait.set(s, { res, rej, t, opcode });
          ws.send(pack(0, s, opcode, payload));
        });
      },
      reply(frame, payload) { if (!closed) ws.send(pack(1, frame.seq, frame.opcode, payload)); },
      close() { try { ws.close(); } catch (e) {} },
      get closed() { return closed; }
    };
    const shut = (why) => {
      if (closed) return; closed = true; clearInterval(pingT);
      for (const w of wait.values()) { clearTimeout(w.t); w.rej(new Error('MAX: ' + why)); }
      wait.clear();
      if (onClose) onClose(why);
    };
    if (signal) signal.addEventListener('abort', () => conn.close(), { once: true });
    ws.addEventListener('message', (ev) => {
      let f; try { f = unpack(ev.data); } catch (e) { return; }
      if (f.cmd !== 0) {
        const w = wait.get(f.seq);
        if (w && w.opcode === f.opcode) {
          wait.delete(f.seq); clearTimeout(w.t);
          const p = f.payload || {};
          if (f.cmd === 3 || p.error) { const e = new Error('MAX: ' + (p.localizedMessage || p.message || p.error || 'ошибка')); e.code = p.error; e.payload = p; w.rej(e); }
          else w.res(p);
        }
        return;
      }
      if (f.opcode === OP.PING) { conn.reply(f, undefined); return; }
      if (onPush) { try { onPush(f, conn); } catch (e) {} }
    });
    ws.addEventListener('close', (ev) => { shut('соединение закрыто (' + ev.code + ')'); reject(new Error('MAX: соединение закрыто (' + ev.code + ')')); });
    ws.addEventListener('error', () => { shut('ошибка соединения'); reject(new Error('MAX: ошибка соединения')); });
    ws.addEventListener('open', async () => {
      try {
        await conn.request(OP.SESSION_INIT, {
          deviceId,
          userAgent: { deviceType: 'WEB', locale: 'ru', deviceLocale: 'ru', osVersion: 'Windows', deviceName: 'Chrome', headerUserAgent: UA, appVersion: APP_VERSION, screen: '1080x1920 1.0x', timezone: 'Europe/Moscow', pushDeviceType: 'WEBPUSH' },
          clientSessionId: BigInt(Date.now())
        });
        pingT = setInterval(() => conn.request(OP.PING, { interactive: true }, 15000).catch(() => {}), 30000);
        resolve(conn);
      } catch (e) { conn.close(); reject(e); }
    });
  });
}

const newDeviceId = () => crypto.randomUUID();
const tokenOf = (p) => { const a = p && p.tokenAttrs; return (a && a.LOGIN && a.LOGIN.token) || (p && p.token) || ''; };

module.exports = { OP, connect, newDeviceId, tokenOf, encode, decode, lz4, pack, unpack };

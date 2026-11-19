// Общий помощник для Redis. Используется и публичным приёмом заявок, и приватной админкой.
// Два режима:
//   • свой сервер (РФ): REDIS_URL=redis://127.0.0.1:6379 — обычный Redis по TCP, без сторонних библиотек;
//   • Vercel (временно, для разработки): Upstash Redis по REST (KV_REST_API_URL + KV_REST_API_TOKEN).

const net = require('net');

const KVURL = process.env.KV_REST_API_URL;
const KVTOK = process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL || '';

const kvReady = () => !!(REDIS_URL || (KVURL && KVTOK));

// ---------- локальный Redis: минимальный клиент протокола RESP ----------
class RedisError extends Error {}
let sock = null, buf = Buffer.alloc(0), queue = [];

function encode(args) {
  const parts = [Buffer.from('*' + args.length + '\r\n')];
  for (const a of args) {
    const b = Buffer.from(String(a));
    parts.push(Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}

// разобрать один ответ с позиции i; null — ответ пришёл не целиком
function parse(b, i) {
  if (i >= b.length) return null;
  const nl = b.indexOf('\r\n', i);
  if (nl < 0) return null;
  const t = b[i], line = b.toString('utf8', i + 1, nl);
  if (t === 43) return [line, nl + 2];                        // +
  if (t === 45) return [new RedisError(line), nl + 2];        // -
  if (t === 58) return [Number(line), nl + 2];                // :
  if (t === 36) {                                             // $
    const n = Number(line);
    if (n < 0) return [null, nl + 2];
    if (b.length < nl + 2 + n + 2) return null;
    return [b.toString('utf8', nl + 2, nl + 2 + n), nl + 4 + n];
  }
  if (t === 42) {                                             // *
    const n = Number(line);
    if (n < 0) return [null, nl + 2];
    const arr = []; let j = nl + 2;
    for (let k = 0; k < n; k++) { const r = parse(b, j); if (!r) return null; arr.push(r[0]); j = r[1]; }
    return [arr, j];
  }
  throw new Error('redis: bad reply');
}

function failAll(err) {
  const q = queue; queue = []; buf = Buffer.alloc(0); sock = null;
  q.forEach((p) => p.reject(err));
}

function connect() {
  if (sock) return sock;
  const u = new URL(REDIS_URL);
  const s = net.createConnection({ host: u.hostname || '127.0.0.1', port: Number(u.port) || 6379 });
  s.setKeepAlive(true);
  s.on('data', (d) => {
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    let pos = 0;
    while (queue.length) {
      let r;
      try { r = parse(buf, pos); } catch (e) { s.destroy(e); return; }
      if (!r) break;
      pos = r[1];
      const p = queue.shift();
      if (r[0] instanceof RedisError) p.reject(r[0]); else p.resolve(r[0]);
    }
    buf = pos >= buf.length ? Buffer.alloc(0) : buf.subarray(pos);
  });
  s.on('error', (e) => failAll(e));
  s.on('close', () => { if (sock === s) failAll(new Error('redis: connection closed')); });
  sock = s;
  if (u.password) { queue.push({ resolve() {}, reject() {} }); s.write(encode(['AUTH', decodeURIComponent(u.password)])); }
  return s;
}

function localCmd(args) {
  return new Promise((resolve, reject) => {
    const s = connect();
    queue.push({ resolve, reject });
    s.write(encode(args));
  });
}

// ---------- Upstash REST ----------
async function restCmd(args) {
  const r = await fetch(KVURL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KVTOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Выполнить одну команду Redis: cmd(['HSET', key, field, value]) -> result
const cmd = (args) => (REDIS_URL ? localCmd(args) : restCmd(args));

// hgetall -> массив объектов (значения — JSON-строки)
async function hall(key) {
  const flat = (await cmd(['HGETALL', key])) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i + 1])); } catch (e) { /* skip */ }
  }
  return out;
}

const genId = () => {
  try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
};

module.exports = { KVURL, KVTOK, kvReady, cmd, hall, genId };

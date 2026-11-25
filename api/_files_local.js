// Файлы заказов и клиентов на собственном сервере (РФ): папка FILES_DIR на диске сервера.
// Файлы недоступны снаружи напрямую: ссылки подписываются (HMAC) и живут ограниченное время.
//
// POST /api/files { pass, op: 'status' }                → { ok, ready, mode: 'local' }
// POST /api/files { pass, op: 'uptoken', path }         → { ok, url }   (PUT на url — загрузка, 1 час)
// POST /api/files { pass, op: 'link',    path }         → { ok, url }   (скачивание, 30 минут)
// POST /api/files { pass, op: 'delete',  path }         → { ok }
// PUT  /api/files-up?p=&e=&s=   — тело запроса = файл
// GET  /api/files-get?p=&e=&s=  — отдаёт файл (через nginx X-Accel-Redirect, если задан FILES_ACCEL)
// Перенос с Vercel: POST /api/files { migrate, op: 'importUrl', path, url } — сервер сам скачивает файл.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const DIR = path.resolve(process.env.FILES_DIR || '/srv/riks-files');
const SECRET = process.env.FILES_SECRET || '';
const ACCEL = process.env.FILES_ACCEL || '';            // напр. /_files/ (internal location в nginx)
const MAX = 500 * 1024 * 1024;                          // 500 МБ на файл
const MAX_PUB = 100 * 1024 * 1024;                      // 100 МБ — макет, загруженный посетителем сайта
const PUB_EXT = /^(pdf|tif|tiff|jpg|jpeg|png|cdr|eps|ai|psd|svg|zip|rar|7z)$/;

const okPass = (p) => !!process.env.LEADS_PASS && p === process.env.LEADS_PASS;
const okMigrate = (t) => !!process.env.MIGRATE_TOKEN && t === process.env.MIGRATE_TOKEN;
const safePath = (p) => typeof p === 'string' && /^riks\/[A-Za-z0-9._\-\/]{1,400}$/.test(p) && !p.includes('..') && !p.includes('//');

const sign = (op, p, exp) => crypto.createHmac('sha256', SECRET).update(op + '\n' + p + '\n' + exp).digest('base64url');
function signedUrl(route, op, p, ttl) {
  const e = Date.now() + ttl;
  return route + '?p=' + encodeURIComponent(p) + '&e=' + e + '&s=' + sign(op, p, e);
}
function checkSig(req, op) {
  const u = new URL(req.url, 'http://x');
  const p = u.searchParams.get('p') || '', e = Number(u.searchParams.get('e') || 0), s = u.searchParams.get('s') || '';
  if (!SECRET || !safePath(p) || !(e > Date.now())) return null;
  const want = Buffer.from(sign(op, p, e)), got = Buffer.from(s);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  return p;
}
const abs = (p) => {
  const a = path.resolve(DIR, p);
  if (!a.startsWith(DIR + path.sep)) throw new Error('bad path');
  return a;
};

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

// записать поток в файл атомарно (через .part), с ограничением размера
async function saveStream(stream, p, lim) {
  lim = lim || MAX;
  const dst = abs(p);
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  const tmp = dst + '.part-' + crypto.randomBytes(4).toString('hex');
  let size = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp, { flags: 'wx' });
    const fail = (e) => { stream.destroy && stream.destroy(); out.destroy(); reject(e); };
    stream.on('data', (c) => { size += c.length; if (size > lim) fail(new Error('too big')); });
    stream.on('error', fail);
    out.on('error', fail);
    out.on('finish', resolve);
    stream.pipe(out);
  }).catch(async (e) => { await fsp.unlink(tmp).catch(() => {}); throw e; });
  await fsp.rename(tmp, dst);
  return size;
}

const json = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };

// POST /api/files
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const b = await readJson(req).catch(() => ({}));
  try {
    if (b.op === 'importUrl') {
      if (!okMigrate(b.migrate || '')) return json(res, 401, { ok: false, error: 'auth' });
      if (!safePath(b.path)) return json(res, 400, { ok: false, error: 'bad path' });
      const u = new URL(String(b.url || ''));
      if (u.protocol !== 'https:' || !/\.blob\.vercel-storage\.com$/.test(u.hostname)) return json(res, 400, { ok: false, error: 'bad url' });
      const r = await fetch(u);
      if (!r.ok) return json(res, 502, { ok: false, error: 'source ' + r.status });
      const { Readable } = require('stream');
      const size = await saveStream(Readable.fromWeb(r.body), b.path);
      return json(res, 200, { ok: true, size });
    }

    if (!okPass(b.pass || '')) return json(res, 401, { ok: false, error: 'auth' });
    const ready = !!SECRET;
    if (b.op === 'status') return json(res, 200, { ok: true, ready, mode: 'local' });
    if (!ready) return json(res, 200, { ok: false, note: 'files-not-configured' });
    if (!safePath(b.path)) return json(res, 400, { ok: false, error: 'bad path' });

    if (b.op === 'uptoken') return json(res, 200, { ok: true, url: signedUrl('/api/files-up', 'put', b.path, 3600e3) });
    if (b.op === 'link') {
      await fsp.access(abs(b.path)).catch(() => { throw new Error('not found'); });
      return json(res, 200, { ok: true, url: signedUrl('/api/files-get', 'get', b.path, 30 * 60e3) });
    }
    if (b.op === 'delete') {
      await fsp.unlink(abs(b.path)).catch(() => {});
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { ok: false, error: 'bad op' });
  } catch (e) {
    return json(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 300) });
  }
}

// PUT /api/files-up
async function upload(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'PUT' && req.method !== 'POST') return json(res, 405, { ok: false });
  // 'put' — загрузка из CRM (до 500 МБ); 'pput' — макет с сайта от посетителя (до 100 МБ, только riks/site/)
  let p = checkSig(req, 'put'), lim = MAX;
  if (!p) { p = checkSig(req, 'pput'); lim = MAX_PUB; if (p && !p.startsWith('riks/site/')) p = null; }
  if (!p) return json(res, 403, { ok: false, error: 'link expired' });
  if (Number(req.headers['content-length'] || 0) > lim) return json(res, 413, { ok: false, error: 'too big' });
  if (lim === MAX_PUB && fs.existsSync(abs(p))) return json(res, 409, { ok: false, error: 'exists' });
  try {
    const size = await saveStream(req, p, lim);
    return json(res, 200, { ok: true, pathname: p, size });
  } catch (e) {
    return json(res, e.message === 'too big' ? 413 : 500, { ok: false, error: String(e.message || e).slice(0, 200) });
  }
}

const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', txt: 'text/plain; charset=utf-8', html: 'text/plain; charset=utf-8', mp4: 'video/mp4' };

// GET /api/files-get
async function download(req, res) {
  const p = checkSig(req, 'get');
  if (!p) { res.statusCode = 403; return res.end('Ссылка устарела — откройте файл заново из CRM'); }
  let st;
  try { st = await fsp.stat(abs(p)); } catch (e) { res.statusCode = 404; return res.end('not found'); }
  const name = path.basename(p);
  const ext = (name.split('.').pop() || '').toLowerCase();
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', (TYPES[ext] ? 'inline' : 'attachment') + '; filename="' + name + '"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  if (ACCEL) { res.setHeader('X-Accel-Redirect', ACCEL + p.split('/').map(encodeURIComponent).join('/')); return res.end(); }
  res.setHeader('Content-Length', st.size);
  fs.createReadStream(abs(p)).pipe(res);
}

// Билет на загрузку макета посетителем сайта (вызывается из api/lead.js, op: 'upload').
// Имя файла на диске — латиница + случайная папка; исходное имя хранится в заявке.
function publicTicket(name, size) {
  if (!SECRET) return { ok: false, error: 'files-not-configured' };
  const ext = (String(name || '').split('.').pop() || '').toLowerCase();
  if (!PUB_EXT.test(ext)) return { ok: false, error: 'type' };
  if (!(Number(size) > 0) || Number(size) > MAX_PUB) return { ok: false, error: 'size' };
  const base = String(name).slice(0, -(ext.length + 1)).normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+|_+$/g, '').slice(0, 60) || 'maket';
  const d = new Date(), ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const p = 'riks/site/' + ym + '/' + crypto.randomBytes(8).toString('hex') + '/' + base + '.' + ext;
  return { ok: true, path: p, url: signedUrl('/api/files-up', 'pput', p, 30 * 60e3) };
}

module.exports = handler;
module.exports.publicTicket = publicTicket;
module.exports.upload = upload;
module.exports.download = download;
module.exports.saveStream = saveStream;

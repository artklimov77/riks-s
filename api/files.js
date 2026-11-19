// Файлы заказов и клиентов Рикс+С — Vercel Blob (закрытое хранилище, access: 'private').
// Файлы видны только через вход в админку: ссылка на скачивание выдаётся на 30 минут.
//
// 1) Загрузка (из браузера напрямую в хранилище, без лимита 4,5 МБ):
//    клиентская библиотека шлёт сюда событие blob.generate-presigned-url
//    (или blob.generate-client-token), пароль — в clientPayload.
// 2) POST { pass, op: 'status' }                 → { ok, ready }
//    POST { pass, op: 'link',   path }           → { ok, url }  (временная ссылка на файл)
//    POST { pass, op: 'delete', path }           → { ok }
//
// Подключение: Vercel → Storage → Create → Blob (Private) → Connect to project.
// Нужен BLOB_STORE_ID (OIDC) или BLOB_READ_WRITE_TOKEN — Vercel добавляет сам при подключении.

// На своём сервере (задан FILES_DIR) работает api/_files_local.js — файлы на диске сервера в РФ.
if (process.env.FILES_DIR) { module.exports = require('./_files_local.js'); return; }

const { issueSignedToken, presignUrl, del } = require('@vercel/blob');
const { handleUploadPresigned, handleUpload } = require('@vercel/blob/client');

const MAX = 500 * 1024 * 1024; // 500 МБ на файл
const ready = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const okPass = (p) => !!process.env.LEADS_PASS && p === process.env.LEADS_PASS;
// храним всё в папке riks/, без «..» и обратных слэшей
const safePath = (p) => typeof p === 'string' && /^riks\/[^\\]{1,400}$/.test(p) && !p.includes('..');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = await readBody(req).catch(() => ({}));

  try {
    // ---- загрузка: события клиентской библиотеки @vercel/blob ----
    if (b.type === 'blob.generate-presigned-url' || b.type === 'blob.generate-client-token') {
      const p = b.payload || {};
      let pass = '';
      try { pass = JSON.parse(p.clientPayload || '{}').pass || ''; } catch (e) {}
      if (!okPass(pass)) return res.status(401).json({ ok: false, error: 'auth' });
      if (!ready()) return res.status(503).json({ ok: false, error: 'files-not-configured' });
      if (!safePath(p.pathname)) return res.status(400).json({ ok: false, error: 'bad path' });
      // пароль дальше не передаём
      b.payload = Object.assign({}, p, { clientPayload: null });

      if (b.type === 'blob.generate-presigned-url') {
        const out = await handleUploadPresigned({
          body: b, request: req,
          getSignedToken: async (pathname) => ({
            token: await issueSignedToken({ pathname, operations: ['put'], validUntil: Date.now() + 3600e3, maximumSizeInBytes: MAX }),
            urlOptions: { maximumSizeInBytes: MAX }
          })
        });
        return res.status(200).json(out);
      }
      const out = await handleUpload({
        body: b, request: req,
        onBeforeGenerateToken: async () => ({ maximumSizeInBytes: MAX, addRandomSuffix: false })
      });
      return res.status(200).json(out);
    }

    // ---- остальное: только с паролем ----
    if (!okPass(b.pass || '')) return res.status(401).json({ ok: false, error: 'auth' });
    if (b.op === 'status') return res.status(200).json({ ok: true, ready: ready() });
    if (!ready()) return res.status(200).json({ ok: false, note: 'files-not-configured' });

    if (b.op === 'link') {
      if (!safePath(b.path)) return res.status(400).json({ ok: false, error: 'bad path' });
      const validUntil = Date.now() + 30 * 60e3;
      const tok = await issueSignedToken({ pathname: b.path, operations: ['get'], validUntil });
      const { presignedUrl } = await presignUrl(tok, { operation: 'get', pathname: b.path, access: 'private', validUntil });
      return res.status(200).json({ ok: true, url: presignedUrl });
    }

    if (b.op === 'delete') {
      if (!safePath(b.path)) return res.status(400).json({ ok: false, error: 'bad path' });
      await del(b.path);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'bad op' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e).slice(0, 300) });
  }
};

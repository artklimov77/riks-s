// Рикс+С — сервер API на собственном VPS (РФ). Статику (страницы, картинки) отдаёт nginx,
// сюда nginx проксирует только /api/*. Обработчики те же, что на Vercel (api/*.js).
// Запуск: systemd (deploy/riks.service), переменные — /etc/riks/riks.env.

const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

const routes = {};
for (const name of ['lead', 'leads', 'db', 'files', 'inbox']) routes['/api/' + name] = require(path.join(ROOT, 'api', name + '.js'));
const filesLocal = require(path.join(ROOT, 'api', '_files_local.js'));

// совместимость с Vercel: res.status().json()/send()
function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = (b) => { res.end(b); return res; };
}

const server = http.createServer(async (req, res) => {
  shim(res);
  const p = (req.url || '/').split('?')[0].replace(/\/+$/, '');
  try {
    if (p === '/api/files-up') return await filesLocal.upload(req, res);
    if (p === '/api/files-get') return await filesLocal.download(req, res);
    if (p === '/api/health') return res.status(200).json({ ok: true });
    const h = routes[p];
    if (!h) return res.status(404).json({ ok: false, error: 'not found' });
    await h(req, res);
  } catch (e) {
    console.error(new Date().toISOString(), p, e && e.stack || e);
    if (!res.headersSent) res.status(500).json({ ok: false });
    else res.end();
  }
});
server.requestTimeout = 0;           // загрузка больших файлов может идти долго
server.headersTimeout = 60e3;
server.listen(PORT, '127.0.0.1', () => console.log('riks api on 127.0.0.1:' + PORT));

// «Сообщения»: фоновое подключение к Telegram, ВК, почте, Авито, MAX
if (process.env.REDIS_URL && process.env.INBOX !== 'off') require('./inbox/manager.js').boot();

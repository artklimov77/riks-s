// Приём заявок с сайта: уведомление менеджеру в Telegram + сохранение в Redis (hash riks:leads).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (для Telegram); KV_REST_API_URL, KV_REST_API_TOKEN (хранилище).

const { kvReady, cmd, genId } = require('./_kv.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  let raw = '';
  try {
    raw = await new Promise((resolve, reject) => {
      let d = '';
      req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); });
      req.on('end', () => resolve(d));
      req.on('error', reject);
    });
  } catch (e) { return res.status(400).json({ ok: false }); }

  let lead = {};
  try { lead = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw || '{}'); } catch (e) { lead = {}; }

  const clean = (v, n) => String(v == null ? '' : v).slice(0, n);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45);

  // Загрузка макета с сайта (каталог полиграфии): выдаём подписанную ссылку на загрузку.
  // Только на своём сервере (FILES_DIR); не больше 20 файлов в час с одного IP.
  if (lead.op === 'upload') {
    if (!process.env.FILES_DIR) return res.status(200).json({ ok: false, error: 'files-not-configured' });
    if (kvReady() && ip) {
      try {
        const k = 'riks:upl:' + ip, n = await cmd(['INCR', k]);
        if (n === 1) await cmd(['EXPIRE', k, 3600]);
        if (n > 20) return res.status(429).json({ ok: false, error: 'limit' });
      } catch (e) { /* без лимита, если Redis недоступен */ }
    }
    const t = require('./_files_local.js').publicTicket(lead.name, lead.size);
    return res.status(t.ok ? 200 : 400).json(t);
  }

  const phone = clean(lead.phone, 40);
  if (!phone.replace(/\D/g, '')) return res.status(400).json({ ok: false, error: 'no phone' });
  // без отметки о согласии на обработку ПДн заявку не принимаем (152-ФЗ, ст. 9); факт согласия храним вместе с заявкой
  const c = (lead.consent && typeof lead.consent === 'object') ? lead.consent : null;
  if (!c || c.pd !== true) return res.status(400).json({ ok: false, error: 'no consent' });

  const rec = {
    id: genId(),
    name: clean(lead.name, 100),
    phone,
    service: clean(lead.service, 200),
    detail: clean(lead.detail, 2500),
    quiz: Array.isArray(lead.quiz) ? lead.quiz.slice(0, 20).map((x) => ({ q: clean(x && x.q, 120), a: clean(x && x.a, 400) })) : undefined,
    contact: clean(lead.contact, 40),
    files: Array.isArray(lead.files) ? lead.files.slice(0, 5)
      .filter((f) => f && /^riks\/site\/\d{4}-\d{2}\/[0-9a-f]{16}\/[A-Za-z0-9._-]{1,80}$/.test(String(f.path || '')))
      .map((f) => ({ name: clean(f.name, 160), path: String(f.path), size: Number(f.size) || 0, cat: 'mockup' })) : undefined,
    callback: !!lead.callback,
    page: clean(lead.page, 60),
    source: clean(lead.source, 120),
    utm: (lead.utm && typeof lead.utm === 'object') ? lead.utm : {},
    ref: clean(lead.ref, 200),
    consent: { pd: true, ver: clean(c.ver, 20), at: new Date().toISOString(), page: clean(c.page, 60), ip, ua: clean(req.headers['user-agent'], 200) },
    stage: 'new',
    note: '',
    ts: clean(lead.ts, 40) || new Date().toISOString()
  };

  // Telegram-уведомление менеджеру
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
  if (TOKEN && CHAT) {
    let when = rec.ts;
    try { when = new Date(rec.ts).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }); } catch (e) {}
    const text =
      '🔔 Новая заявка с сайта\n\n' +
      '👤 ' + (rec.name || '—') + '\n' +
      '📞 ' + rec.phone + '\n' +
      '🧩 ' + (rec.service || '—') + '\n' +
      (rec.detail ? '📝 ' + rec.detail + '\n' : '') +
      '\n🌐 Источник: ' + rec.source + '\n' +
      '📄 Страница: ' + rec.page + '\n' +
      '🕒 ' + when;
    try {
      await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true })
      });
    } catch (e) { /* не валим заявку, если телега недоступна */ }
  }

  // Сохранение в Redis (hash riks:leads, поле = id)
  if (kvReady()) {
    try { await cmd(['HSET', 'riks:leads', rec.id, JSON.stringify(rec)]); } catch (e) { /* ignore */ }
  }

  return res.status(200).json({ ok: true, id: rec.id });
};

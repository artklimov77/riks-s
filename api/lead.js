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
  const phone = clean(lead.phone, 40);
  if (!phone.replace(/\D/g, '')) return res.status(400).json({ ok: false, error: 'no phone' });

  const rec = {
    id: genId(),
    name: clean(lead.name, 100),
    phone,
    service: clean(lead.service, 200),
    detail: clean(lead.detail, 300),
    page: clean(lead.page, 60),
    source: clean(lead.source, 120),
    utm: (lead.utm && typeof lead.utm === 'object') ? lead.utm : {},
    ref: clean(lead.ref, 200),
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

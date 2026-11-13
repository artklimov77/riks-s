// Приём заявок с сайта: уведомление менеджеру в Telegram + сохранение (Upstash Redis, если подключён).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (обязательно для Telegram);
//      KV_REST_API_URL, KV_REST_API_TOKEN (опционально, для списка лидов и дашборда).

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // читаем тело
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
    name: clean(lead.name, 100),
    phone,
    service: clean(lead.service, 200),
    detail: clean(lead.detail, 300),
    page: clean(lead.page, 60),
    source: clean(lead.source, 120),
    utm: (lead.utm && typeof lead.utm === 'object') ? lead.utm : {},
    ref: clean(lead.ref, 200),
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

  // Сохранение в Upstash Redis (если настроен) — для дашборда и будущего переноса в Битрикс
  const KVURL = process.env.KV_REST_API_URL, KVTOK = process.env.KV_REST_API_TOKEN;
  if (KVURL && KVTOK) {
    try {
      await fetch(KVURL + '/lpush/riks_leads/' + encodeURIComponent(JSON.stringify(rec)), {
        headers: { Authorization: 'Bearer ' + KVTOK }
      });
    } catch (e) { /* ignore */ }
  }

  return res.status(200).json({ ok: true });
};

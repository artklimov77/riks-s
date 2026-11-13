// Список лидов для дашборда leads.html. Защита простым паролем (env LEADS_PASS).
// Требует Upstash Redis (KV_REST_API_URL, KV_REST_API_TOKEN). Без него вернёт пустой список.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, 'http://x');
  const pass = url.searchParams.get('pass') || '';

  if (!process.env.LEADS_PASS || pass !== process.env.LEADS_PASS) {
    return res.status(401).json({ ok: false, error: 'auth' });
  }

  const KVURL = process.env.KV_REST_API_URL, KVTOK = process.env.KV_REST_API_TOKEN;
  if (!KVURL || !KVTOK) {
    return res.status(200).json({ ok: true, leads: [], note: 'storage-not-configured' });
  }

  try {
    const r = await fetch(KVURL + '/lrange/riks_leads/0/1000', {
      headers: { Authorization: 'Bearer ' + KVTOK }
    });
    const j = await r.json();
    const leads = (j.result || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
    return res.status(200).json({ ok: true, leads });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};

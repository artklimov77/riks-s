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
    const auth = { headers: { Authorization: 'Bearer ' + KVTOK } };
    const [rLeads, rStatus] = await Promise.all([
      fetch(KVURL + '/lrange/riks_leads/0/1000', auth),
      fetch(KVURL + '/hgetall/riks_status', auth)
    ]);
    const jLeads = await rLeads.json();
    const leads = (jLeads.result || []).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);

    // карта стадий: { leadId: {stage, note, ts} }
    const status = {};
    try {
      const jStatus = await rStatus.json();
      const arr = jStatus.result || [];
      // Upstash hgetall -> плоский массив [field, value, field, value, ...]
      for (let i = 0; i < arr.length; i += 2) {
        try { status[arr[i]] = JSON.parse(arr[i + 1]); } catch (e) { status[arr[i]] = { stage: arr[i + 1] }; }
      }
    } catch (e) {}

    return res.status(200).json({ ok: true, leads, status });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};

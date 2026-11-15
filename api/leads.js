// Список лидов для старого дашборда leads.html. Защита паролем (env LEADS_PASS).
// Читает hash riks:leads. Новая админка — admin.html (api/db.js).

const { kvReady, hall } = require('./_kv.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, 'http://x');
  const pass = url.searchParams.get('pass') || '';

  if (!process.env.LEADS_PASS || pass !== process.env.LEADS_PASS) {
    return res.status(401).json({ ok: false, error: 'auth' });
  }
  if (!kvReady()) {
    return res.status(200).json({ ok: true, leads: [], note: 'storage-not-configured' });
  }

  try {
    const leads = await hall('riks:leads');
    leads.sort((x, y) => String(y.ts || '').localeCompare(String(x.ts || '')));
    const status = {};
    leads.forEach((l) => { status[l.id] = { stage: l.stage || 'new', note: l.note || '' }; });
    return res.status(200).json({ ok: true, leads, status });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};

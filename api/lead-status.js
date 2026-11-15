// Смена стадии/заметки лида в CRM-админке. Защита паролем (env LEADS_PASS).
// POST { pass, id, stage?, note? } -> сохраняет в Upstash hash riks_status[id] = {stage, note, ts}.
// Требует Upstash Redis (KV_REST_API_URL, KV_REST_API_TOKEN).

const STAGES = ['new', 'work', 'kp', 'deal', 'done', 'fail'];

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

  let body = {};
  try { body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(raw || '{}'); } catch (e) { body = {}; }

  if (!process.env.LEADS_PASS || (body.pass || '') !== process.env.LEADS_PASS) {
    return res.status(401).json({ ok: false, error: 'auth' });
  }

  const id = String(body.id || '').slice(0, 80);
  if (!id) return res.status(400).json({ ok: false, error: 'no id' });

  const KVURL = process.env.KV_REST_API_URL, KVTOK = process.env.KV_REST_API_TOKEN;
  if (!KVURL || !KVTOK) return res.status(200).json({ ok: true, note: 'storage-not-configured' });

  const stage = STAGES.includes(body.stage) ? body.stage : 'new';
  const note = String(body.note == null ? '' : body.note).slice(0, 1000);
  const payload = JSON.stringify({ stage, note, ts: new Date().toISOString() });

  try {
    await fetch(KVURL + '/hset/riks_status/' + encodeURIComponent(id) + '/' + encodeURIComponent(payload), {
      headers: { Authorization: 'Bearer ' + KVTOK }
    });
    return res.status(200).json({ ok: true, stage, note });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};

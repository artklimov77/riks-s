// Общий помощник для Upstash Redis (REST, однокомандный POST).
// Используется и публичным приёмом заявок, и приватной админкой.

const KVURL = process.env.KV_REST_API_URL;
const KVTOK = process.env.KV_REST_API_TOKEN;

const kvReady = () => !!(KVURL && KVTOK);

// Выполнить одну команду Redis: cmd(['HSET', key, field, value]) -> result
async function cmd(args) {
  const r = await fetch(KVURL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KVTOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// hgetall -> массив объектов (значения — JSON-строки)
async function hall(key) {
  const flat = (await cmd(['HGETALL', key])) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i + 1])); } catch (e) { /* skip */ }
  }
  return out;
}

const genId = () => {
  try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
};

module.exports = { KVURL, KVTOK, kvReady, cmd, hall, genId };

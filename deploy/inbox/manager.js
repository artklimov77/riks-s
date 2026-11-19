// Запуск и перезапуск каналов «Сообщений» по настройкам из CRM (riks:channels).
// Раз в 15 секунд сверяет настройки; при ошибке канал перезапускается с паузой (до 5 минут).

const C = require('./core.js');
const { DEF, sleep } = require('./channels.js');

const workers = {}; // ch → { sig, ctrl, api }

function cfgReady(ch, cfg) { return cfg && cfg.enabled !== false && DEF[ch].need.every((k) => cfg[k]); }

function start(ch, cfg) {
  const ctrl = new AbortController();
  const api = DEF[ch].make(Object.assign({}, cfg));
  const w = { sig: JSON.stringify(cfg), ctrl, api };
  workers[ch] = w;
  (async () => {
    let pause = 5000;
    while (!ctrl.signal.aborted) {
      try { await api.run(ctrl.signal); pause = 5000; }
      catch (e) {
        if (ctrl.signal.aborted) break;
        const msg = String((e && e.message) || e).slice(0, 300);
        console.error(new Date().toISOString(), 'inbox', ch, msg);
        await C.setStatus(ch, { ok: false, err: msg });
        await sleep(pause, ctrl.signal);
        pause = Math.min(pause * 2, 300000);
      }
    }
  })();
}
function stop(ch) { const w = workers[ch]; if (w) { w.ctrl.abort(); delete workers[ch]; } }

async function sync() {
  try {
    const all = await C.getChannels();
    for (const ch of Object.keys(DEF)) {
      const cfg = all[ch];
      if (!cfgReady(ch, cfg)) { if (workers[ch]) { stop(ch); await C.setStatus(ch, { ok: false, off: true }); } continue; }
      if (!workers[ch] || workers[ch].sig !== JSON.stringify(cfg)) { stop(ch); start(ch, cfg); }
    }
  } catch (e) { console.error('inbox sync', e && e.message); }
}

let started = false;
function boot() { if (started) return; started = true; sync(); setInterval(sync, 15000); }

// отправить сообщение из CRM
async function send(tid, text, who) {
  const t = await C.getThread(tid);
  if (!t) throw new Error('диалог не найден');
  // демо-диалоги (mock): ответ сохраняется в CRM, никуда не отправляется
  let w = t.mock ? { api: { send: async () => ({}) } } : workers[t.ch];
  if (!w) { await sync(); w = workers[t.ch]; }
  if (!w) throw new Error('канал «' + ((C.CH[t.ch] || {}).t || t.ch) + '» не подключён');
  const r = await w.api.send(t, text);
  if (r && r.extId) await C.seen(t.ch, r.extId); // эхо этого сообщения из канала не дублируем
  const msg = { id: C.genId(), dir: 'out', text: C.clip(text, 4000), att: [], ts: C.now(), who: who || '', extId: r && r.extId ? String(r.extId) : '' };
  await C.cmd(['RPUSH', C.K.msgs(tid), JSON.stringify(msg)]);
  const t2 = await C.getThread(tid);
  t2.last = 'Вы: ' + msg.text.slice(0, 140); t2.ts = msg.ts; t2.lastDir = 'out'; t2.unread = 0;
  await C.putThread(t2);
  return msg;
}

module.exports = { boot, sync, send, workers };

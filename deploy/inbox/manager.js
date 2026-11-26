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
  // внутренние группы «Между собой» и демо-диалоги: сообщение остаётся в CRM, наружу не уходит
  let w = (t.mock || t.ch === 'team') ? { api: { send: async () => ({}) } } : workers[t.ch];
  if (!w) { await sync(); w = workers[t.ch]; }
  if (!w) throw new Error('канал «' + ((C.CH[t.ch] || {}).t || t.ch) + '» не подключён');
  const r = await w.api.send(t, text);
  // эхо этого сообщения из канала не дублируем. ВК бывает быстрее: эхо («из ВК») уже записано —
  // тогда не добавляем второе, а подписываем записанное именем отправителя из CRM.
  const echoed = r && r.extId ? await C.seen(t.ch, r.extId) : false;
  let msg = null;
  if (echoed) {
    const list = await C.cmd(['LRANGE', C.K.msgs(tid), '-30', '-1']) || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = C.J(list[i], null);
      if (m && m.extId === String(r.extId)) {
        m.who = who || m.who; msg = m;
        await C.cmd(['LSET', C.K.msgs(tid), String(i - list.length), JSON.stringify(m)]);
        break;
      }
    }
  }
  if (!msg) {
    msg = { id: C.genId(), dir: 'out', text: C.clip(text, 4000), att: [], ts: C.now(), who: who || '', extId: r && r.extId ? String(r.extId) : '' };
    await C.cmd(['RPUSH', C.K.msgs(tid), JSON.stringify(msg)]);
  }
  const t2 = await C.getThread(tid);
  if (t2.ch === 'team') {
    t2.seq = (t2.seq || 0) + 1; t2.lastWho = msg.who; t2.readBy = Object.assign({}, t2.readBy, msg.who ? { [msg.who]: t2.seq } : {});
    t2.last = (msg.who ? msg.who + ': ' : '') + msg.text.slice(0, 140);
  } else t2.last = 'Вы: ' + msg.text.slice(0, 140);
  t2.ts = msg.ts; t2.lastDir = 'out'; t2.unread = 0;
  // новое письмо, начатое из CRM: тема уходит как есть, дальше переписка идёт с «Re:»
  if (t2.meta && t2.meta.newSubject) { t2.meta.subject = t2.meta.newSubject; delete t2.meta.newSubject; }
  await C.putThread(t2);
  return msg;
}

// диалог прочитан в CRM → отметить прочитанным и в самом мессенджере (где канал это умеет)
async function markRead(t) {
  const w = workers[t.ch];
  if (!w || !w.api.read || t.mock) return;
  try { await w.api.read(t); }
  catch (e) { console.error(new Date().toISOString(), 'inbox read', t.ch, e.message); await C.setState(t.ch + '.lastRead', JSON.stringify({ at: C.now(), tid: t.id, err: String(e.message || e).slice(0, 300) })).catch(() => {}); }
}

module.exports = { boot, sync, send, markRead, workers };

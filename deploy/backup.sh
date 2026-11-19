#!/bin/bash
# Ночной бэкап на сервере: база (снимок Redis + JSON) и файлы CRM → /var/backups/riks/ГГГГ-ММ-ДД.
# Файлы копируются жёсткими ссылками на прошлую копию: неизменённые файлы место не занимают.
# Хранятся 14 дней + копия на 1-е число каждого месяца (12 месяцев).
set -euo pipefail
B=/var/backups/riks; D=$B/$(date +%F); PREV=$(ls -1d $B/20* 2>/dev/null | grep -v "$D" | tail -1 || true)
mkdir -p "$D"
redis-cli -q SAVE >/dev/null
cp /var/lib/redis/dump.rdb "$D/redis.rdb"
# читаемая копия базы (JSON) — можно открыть без Redis
for k in leads orders clients catalog settings tasks; do
  redis-cli --raw HVALS "riks:$k" > "$D/$k.jsonl"
done
if [ -n "$PREV" ] && [ -d "$PREV/files" ]; then
  rsync -a --delete --link-dest="$PREV/files" /srv/riks-files/ "$D/files/"
else
  rsync -a --delete /srv/riks-files/ "$D/files/"
fi
chmod -R go-rwx "$D"
# очистка: дневные старше 14 дней, кроме первых чисел месяца (их держим год)
find $B -maxdepth 1 -type d -name '20*' -mtime +14 ! -name '20*-01' -exec rm -rf {} +
find $B -maxdepth 1 -type d -name '20*-01' -mtime +370 -exec rm -rf {} +
echo "$(date -Is) backup ok: $D ($(du -sh "$D" | cut -f1))"

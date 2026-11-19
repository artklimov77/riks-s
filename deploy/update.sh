#!/bin/bash
# Автообновление с GitHub (main): раз в минуту по таймеру riks-update.timer.
# Новый коммит → забрать файлы → при изменении API/зависимостей перезапустить сервис.
set -euo pipefail
cd /srv/riks/app
git fetch -q origin main
OLD=$(git rev-parse HEAD); NEW=$(git rev-parse origin/main)
[ "$OLD" = "$NEW" ] && exit 0
CHANGED=$(git diff --name-only "$OLD" "$NEW")
git reset -q --hard "$NEW"
if echo "$CHANGED" | grep -q '^package\(-lock\)\?\.json$'; then npm install --omit=dev --no-audit --no-fund -q || true; fi
if echo "$CHANGED" | grep -q '^\(api/\|deploy/server\.js\|data/uds-catalog\.json\)'; then sudo /bin/systemctl restart riks; fi
if echo "$CHANGED" | grep -q '^deploy/nginx-riks\.conf$'; then echo "nginx-riks.conf изменён — применить вручную (deploy/README.md)"; fi
echo "$(date -Is) $OLD -> $NEW"

#!/bin/bash
# HTTPS для www.riks-s.ru: ждёт, пока домен в реестре .ru будет делегирован на DNS Рег.ру и смотреть на этот сервер,
# выпускает сертификат Let's Encrypt (webroot) и ставит nginx-riks-ssl.conf. Запускается таймером riks-https.timer
# раз в 10 минут; после успеха таймер выключается. Продление — штатный certbot.timer (+ reload nginx).
set -euo pipefail
IP=92.118.91.101
CONF=/etc/nginx/conf.d/riks.conf
APP=/srv/riks/app/deploy
log(){ echo "$(date -Is) $*"; }

[ -f /etc/riks/le-ok ] || { log "нет согласия с условиями Let's Encrypt (/etc/riks/le-ok) — жду"; exit 0; }

if [ ! -f /etc/letsencrypt/live/riks-s.ru/fullchain.pem ]; then
  ns=$(dig +short NS riks-s.ru @a.dns.ripn.net | tr 'A-Z' 'a-z')
  echo "$ns" | grep -q vercel && { log "в реестре ещё NS Vercel: $(echo $ns)"; exit 0; }
  for h in riks-s.ru www.riks-s.ru; do
    a=$(dig +short A $h @ns1.reg.ru | tail -1)
    [ "$a" = "$IP" ] || { log "$h → '$a', а не $IP — жду"; exit 0; }
  done
  # проверка, что Let's Encrypt достучится: файл в webroot виден по http через домен
  t=check-$RANDOM; mkdir -p /var/www/letsencrypt/.well-known/acme-challenge; echo ok > /var/www/letsencrypt/.well-known/acme-challenge/$t
  for h in riks-s.ru www.riks-s.ru; do
    r=$(curl -s -m 10 --resolve $h:80:$IP http://$h/.well-known/acme-challenge/$t || true)
    [ "$r" = "ok" ] || { log "$h: webroot не отвечает"; rm -f /var/www/letsencrypt/.well-known/acme-challenge/$t; exit 1; }
  done
  rm -f /var/www/letsencrypt/.well-known/acme-challenge/$t
  certbot certonly --webroot -w /var/www/letsencrypt -d riks-s.ru -d www.riks-s.ru \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring \
    --deploy-hook "systemctl reload nginx"
fi

if ! cmp -s $APP/nginx-riks-ssl.conf $CONF; then
  cp $CONF $CONF.bak
  cp $APP/nginx-riks-ssl.conf $CONF
  if nginx -t 2>/dev/null; then systemctl reload nginx; log "HTTPS включён"; else cp $CONF.bak $CONF; log "nginx -t не прошёл — вернул старый конфиг"; exit 1; fi
fi
systemctl disable --now riks-https.timer 2>/dev/null || true
log "готово: https://www.riks-s.ru"

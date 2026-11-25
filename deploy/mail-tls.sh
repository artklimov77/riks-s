#!/bin/sh
# Сертификат Let's Encrypt для почты (Exim + Dovecot из ISPmanager): IMAP/SMTP на riks-s.ru.
# Ставится как deploy-hook certbot: /etc/letsencrypt/renewal-hooks/deploy/mail-tls.sh
set -e
LE=/etc/letsencrypt/live/riks-s.ru
SSL=/etc/exim4/ssl
[ -f $SSL/exim.crt.isp ] || cp -p $SSL/exim.crt $SSL/exim.crt.isp
[ -f $SSL/exim.key.isp ] || cp -p $SSL/exim.key $SSL/exim.key.isp
for n in riks-s.ru exim; do
  cp $LE/fullchain.pem $SSL/$n.crt
  cp $LE/privkey.pem $SSL/$n.key
  chown Debian-exim:Debian-exim $SSL/$n.crt $SSL/$n.key 2>/dev/null || true
  chmod 640 $SSL/$n.key
done
systemctl reload exim4 2>/dev/null || systemctl restart exim4
systemctl reload dovecot

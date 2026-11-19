# Рикс+С — общая часть сайта для nginx (подключается из riks.conf, HTTP и HTTPS)
root /srv/riks/app;
index index.html;
charset utf-8;

access_log /var/log/nginx/riks.access.log;
error_log  /var/log/nginx/riks.error.log warn;

gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_types text/css application/javascript application/json image/svg+xml text/xml application/xml;

add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Cache-Control $riks_cache;

# служебное — наружу не отдаём
location ~ ^/(\.git|\.vercel|deploy|tools|_private|_vk_raw|node_modules)(/|$) { return 404; }
location ~ ^/(package(-lock)?\.json|\.gitignore|.*\.md)$ { return 404; }

location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 30m;
}

# загрузка файлов CRM — до 500 МБ, потоком без буфера
location = /api/files-up {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    client_body_timeout 3600s;
    client_max_body_size 520m;
}

# отдача файлов после проверки подписи в Node (X-Accel-Redirect)
location /_files/ {
    internal;
    alias /srv/riks-files/;
    add_header X-Content-Type-Options nosniff always;
    add_header Content-Security-Policy "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox" always;
    add_header Cache-Control "private, no-store" always;
}

location / {
    try_files $uri $uri.html $uri/ =404;
}

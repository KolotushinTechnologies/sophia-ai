# Деплой на VPS

Одного домена хватает: **sophia.letteland.space**.  
Отдельный домен для API не нужен — Nginx снаружи отдаёт сайт, а внутри Docker веб-контейнер проксирует `/api` на API.

Схема:

```
браузер → Nginx (SSL, :443) → web (:5465) → статика
                              └→ /api/* → api (:5555)
```

---

## 0. Что нужно на сервере

Уже есть: Nginx, Certbot, Node (Node для прода можно не трогать — приложение в Docker).

Нужен Docker:

```bash
# Ubuntu/Debian, пример
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# перелогинься, потом:
docker compose version
```

---

## 1. Залить проект

```bash
cd /var/www   # или куда удобно
git clone <твой-репо> sophia-ai
cd sophia-ai
```

---

## 2. Env

```bash
cp .env.example .env
nano .env
```

Обязательно проверь:

| Переменная | Значение |
|------------|----------|
| `MONGODB_URI` | Atlas / свой Mongo |
| `ANTHROPIC_API_KEY` | ключ Claude |
| `WEB_ORIGIN` | `https://sophia.letteland.space` |
| `YOOKASSA_RETURN_URL` | `https://sophia.letteland.space/?payment=success` |
| `JWT_SECRET` | длинная случайная строка |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | логин в админку |

---

## 3. Собрать и запустить контейнеры

```bash
docker compose up -d --build
```

Если Anthropic отвечает 403 с VPS (блок по региону) — в репозитории уже есть `proxy.env` (Decodo), он подключается в `docker-compose.yml` для контейнера `api`. SDK сам `HTTP_PROXY` не читает — в коде настроен `undici.ProxyAgent`. После деплоя в логах: `Anthropic client via proxy: ...`. Пересоздание: `docker compose up -d --build --force-recreate api`.

Первый раз засидить данные (парк Находка, знания, админ):

```bash
docker compose run --rm api node apps/server/dist/scripts/seed.js
```

Подожди пару секунд — знания индексируются в фоне.

Проверка с сервера:

```bash
curl -s http://127.0.0.1:5465/api/health
curl -s http://127.0.0.1:5555/api/health
```

Должно вернуть `{"ok":true,...}`.

---

## 4. Nginx на хосте + HTTPS

DNS: A-запись `sophia.letteland.space` → IP VPS.

Создай `/etc/nginx/sites-available/sophia`:

```nginx
server {
  listen 80;
  server_name sophia.letteland.space;

  location / {
    proxy_pass http://127.0.0.1:5465;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

Включи сайт:

```bash
sudo ln -sf /etc/nginx/sites-available/sophia /etc/nginx/sites-enabled/sophia
sudo nginx -t && sudo systemctl reload nginx
```

Сертификат:

```bash
sudo certbot --nginx -d sophia.letteland.space
```

Certbot сам допишет SSL в конфиг.

---

## 5. Куда заходить

| Что | URL |
|-----|-----|
| Чат | https://sophia.letteland.space |
| Админка | https://sophia.letteland.space/admin/login |

---

## Обновление после правок в коде

```bash
cd /var/www/sophia-ai
git pull
docker compose up -d --build
```

Seed повторно не обязателен (перезапишет сидовые документы, если снова запустишь).

---

## Полезные команды

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose down
```

Порты `5465` (web) и `5555` (api) слушаются только на `127.0.0.1` — снаружи только через Nginx с SSL.

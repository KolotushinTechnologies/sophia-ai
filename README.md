# Sophia AI

Чат-помощник для семейного парка **Sofi Park**. Гости спрашивают про цены, правила, дни рождения — София отвечает по базе знаний и может сама провести бронь с оплатой. Менеджерам не нужно дергать всё руками: админка в том же приложении — знания, каталог, календарь броней, города.

Сейчас в сиде — Находка. Архитектура уже под несколько городов.

Стек: React/Vite спереди, Fastify + Claude, MongoDB, платежи через ЮKassa (или mock в деве).

Прод: один домен `sophia.letteland.space` на всё (чат + админка + API через `/api`). Отдельный домен для API не нужен. Как поднять на VPS — см. **[DEPLOY.md](./DEPLOY.md)**.

---

## Как поднять локально

Нужен **Node 22+** и доступ к MongoDB (например Atlas).

1. Скопируй env и заполни ключи:

```bash
cp .env.example .env
```

В `.env` минимум: `MONGODB_URI`, `ANTHROPIC_API_KEY`, логин/пароль админки (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), что-нибудь серьёзное в `JWT_SECRET`.

2. Поставь зависимости и собери пакеты:

```bash
npm install
npm run build -w @sophia/shared && npm run build -w @sophia/domain && npm run build -w @sophia/mcp-tools
```

3. Залей стартовые данные (парк, каталог, знания, админ):

```bash
npm run seed
```

Индексация знаний идёт в фоне — пару секунд подожди, потом можно спрашивать про сайт и правила.

4. Запусти сервер и фронт (в двух терминалах):

```bash
npm run dev:server   # API на :3001
npm run dev:web      # UI на :5173
```

Или всё в Docker (как на проде):

```bash
docker compose up -d --build
docker compose run --rm api node apps/server/dist/scripts/seed.js
# UI + API: http://localhost:5465
# API напрямую: http://localhost:5555/api/health
```

---

## Куда заходить

| Что | Локально | Прод |
|-----|----------|------|
| Чат с Софией | http://localhost:5173 | https://sophia.letteland.space |
| Админка | http://localhost:5173/admin/login | https://sophia.letteland.space/admin/login |

Логин в админку — из `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

---

## Контакты

По проекту и вопросам пишите в Telegram:

### [@Kolotushin](https://t.me/Kolotushin)

---

`.env` и любые файлы с ключами в репозиторий не коммитьте.

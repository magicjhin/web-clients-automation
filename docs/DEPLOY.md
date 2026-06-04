# Деплой и инфраструктура — Leadgen LT

## Топология
- **VPS** (Hetzner): Docker Compose — Postgres + воркеры (node-cron). Redis добавляется в фазе 2.
- **Frontend** (Next.js): Vercel ИЛИ в Docker на VPS. Решается на старте (открытый вопрос техспек §8).
  - Вариант A: фронт на Vercel, воркеры+БД на VPS (БД доступна фронту через защищённое соединение).
  - Вариант B: всё в Docker на VPS (один хост).
- **RAM**: 4ГБ достаточно (нет Puppeteer). Апгрейд по факту.

## Секреты
- `.env` — НЕ в git (`.gitignore`). `.env.example` — в git, без значений.
- Все секреты читаются через `src/lib/config`.
- Нужные ключи: `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`, `PAGESPEED_API_KEY`,
  `RESEND_API_KEY` (мой домen webvibe.lt на фазе 1), `OPENAI_API_KEY` (GPT-4o),
  `ANTHROPIC_API_KEY` (опц. Claude), `AUTH_SECRET`, `GOOGLE_OAUTH_*`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`.

## CI/CD (настроено ✅)
- `.github/workflows/deploy.yml`: push в `main` → `appleboy/ssh-action` → SSH на VPS →
  `git reset --hard origin/main` → `docker compose up -d --build` → `prisma migrate deploy`.
- Секреты репозитория уже заведены: `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD`, `VPS_PORT` (+ `VPS_SSH_KEY`).
- Путь на сервере: `/opt/leadgen`. Активируется, как только в main появятся `docker-compose.yml` + `Dockerfile`.
- ⚠️ Имена сервисов в compose должны совпадать с workflow (`web` для Next.js/Prisma). Devops-агент синхронизирует.

## Docker Compose (целевой состав)
```
services:
  postgres   — PostgreSQL 15, volume для данных
  workers    — Node воркеры (node-cron), общий образ, разные CLI-команды
  web        — Next.js (если вариант B), иначе на Vercel
  redis      — фаза 2 (BullMQ)
```

## Repo / remote (решено ✅)
- Остаёмся на `github.com/magicjhin/web-clients-automation.git` (origin уже привязан на VPS, деплой настроен).
- Старый код уходит первым же коммитом нового стека (рабочее дерево пересоздаётся с нуля).
- SSH с локальной машины: **`ssh leadgen`** (алиас в `~/.ssh/config`).

## Резерв из старого проекта (переиспользуется концептуально)
- Паттерн `shared/` (db, logger, config) → теперь `src/lib/`
- Docker Compose + GitHub Actions автодеплой
- Структура воркеров с CLI-аргументами
- **Заменено**: scraper.js (Puppeteer) → rc-sync (RC API). Снят главный блокер старого проекта (IP-бан/капча).

## Безопасность (после инцидента BSI/CERT-Bund 2026-06-02)
**Что было:** старый `docker-compose.yml` публиковал `ports: "5432:5432"` → Postgres торчал в
открытый интернет на `0.0.0.0:5432`. BSI прислал уведомление через Hetzner. Контейнер снесён, порт закрыт.

**Железные правила нового стека:**
- ❌ **НИКОГДА не публиковать порт Postgres** (`ports:` для БД в compose запрещён).
  Postgres доступен только во внутренней Docker-сети — web/workers ходят по имени сервиса `postgres:5432`.
- Если нужен доступ с хоста (psql/миграции вручную) — биндить ТОЛЬКО на localhost: `127.0.0.1:5432:5432`.
  Для удалённого доступа — через SSH-туннель, не публичный порт.
- ⚠️ **Docker обходит ufw!** Опубликованный в compose порт пробивает iptables мимо ufw —
  «ufw deny 5432» НЕ спасёт. Единственная защита — не публиковать порт вовсе (см. выше).
- Наружу торчат только: **22 (SSH), 80/443 (Caddy)**. ufw активен (`default deny incoming`).
- Caddy уже стоит на VPS (reverse-proxy + TLS) — Next.js (`web`) проксируем через него, наружу сам не публикуем.

## Прогрев домена (важно с фазы 1)
- Отправка через мой Resend + домен `webvibe.lt` — с первого письма.
- Репутация домена набирается временем → верификация (SPF/DKIM) и прогрев сразу, не откладывать.

# AGENT HANDOFF — Leadgen LT

> Перезаписывай этот файл в конце каждой сессии. Дата последнего обновления: 2026-06-04.

## Где мы сейчас
Проект **пересоздан с нуля** по новому спеку (`leadgen-techspec.md` + `leadgen-service-konspekt.md`).
Старый проект (Puppeteer-парсер rekvizitai) **отменён** — все файлы рабочего дерева удалены,
осталась только история git. Новый источник данных = **RC API** (`get.data.gov.lt`), парсинга нет.

## Что сделано в этой сессии
- ✅ **RC API проверен вживую** — эндпоинты, поля, объёмы, синтаксис. См. `docs/API_RC.md`.
  - 544 063 записи всего, **160 536 действующих** (`veikiantis=1`).
  - Решено: **качаем только действующих** (фильтр при записи, техспек важнее конспекта).
- ✅ Контекстные файлы: `CLAUDE.md`, `TASKS.md`, `docs/{ARCHITECTURE,DATABASE,DEPLOY,API_RC}.md`.
- ✅ Субагенты в `.claude/agents/`: backend-pipeline, db-schema, frontend-dev, designer, devops.
- ✅ **VPS вычищен** — снесены старые контейнеры (`leadgen_node`, `leadgen_postgres`, `clever_yonath`),
  volumes (`leadgen_postgres_data`, `leadgen_n8n_data`), образы. Освобождено ~8 ГБ (14G→5.9G). `.env`
  забэкаплен в `~/leadgen-server-backup/env.bak` (переносим: ANTHROPIC_API_KEY, PAGESPEED_API_KEY, GOOGLE_MAPS_API_KEY).
- ✅ **SSH одной командой**: `ssh leadgen` (алиас в `~/.ssh/config`, ключ id_ed25519, passwordless).
- ✅ **Авто-деплой**: `.github/workflows/deploy.yml` — push в main → SSH на VPS → `git reset --hard origin/main`
  → `docker compose up -d --build` → `prisma migrate deploy`. Секреты уже есть (VPS_HOST/USER/PASSWORD/PORT).
  Активируется, как только запушим новый стек (compose + Dockerfile, задача 1).
- ✅ **Репо решено**: остаёмся на `magicjhin/web-clients-automation` (деплой уже привязан, переподключать
  сервер не надо). Удалять не стали — у gh-токена нет `delete_repo`, да и незачем: рабочее дерево
  пересоздаём с нуля, старый код уйдёт первым же коммитом. Переименование (если захочется `leadgen-lt`)
  — отдельной командой `gh repo rename`, позже.

## Безопасность (инцидент BSI/CERT-Bund, 2026-06-02)
- Старый Postgres торчал в интернет (`5432:5432` в compose). Контейнер снесён → порт закрыт ✅.
- **ufw включён** на VPS: разрешены только 22/80/443, `default deny incoming`. SSH проверен — живой.
- Правило зашито в `CLAUDE.md` / `docs/DEPLOY.md` / агента devops: **БД наружу не публиковать никогда**
  (Docker обходит ufw → защита = отсутствие `ports` у postgres; нужен хост-доступ — только `127.0.0.1`).

## Следующий шаг
**Задача 1 (devops)** — инициализация проекта: Next.js (App Router, TS) + Prisma + Postgres
+ Docker Compose + структура `src/lib` (db, logger, config, rc-api) + `workers/` + .env.example + CI/CD.
Параллельно можно стартовать **задачу 2 (db-schema)** — Prisma-схему по `docs/DATABASE.md`.

## Code review gate (Codex) — на каждый модуль
После реализации каждого модуля оркестратор прогоняет `scripts/codex-review.sh "<модуль>"`
(OpenAI Codex CLI, авторизован). Находки BLOCKER/MAJOR чинятся до «готово». Правила проекта
зашиты в обёртку. Субагенты должны явно сообщать «модуль готов, файлы: …» — это триггер ревью.

## Как вести параллельную разработку
Диспетчеризую субагентов (`.claude/agents/`) через инструмент Agent. Независимые задачи — в параллель:
- `db-schema` (схема) и `devops` (скелет проекта) не конфликтуют → можно вместе.
- `backend-pipeline` (воркеры) стартует после готовой схемы.
- `frontend-dev` + `designer` идут в паре на UI-задачах (6, 10, 13).
Каждый агент читает `CLAUDE.md` + нужный doc перед работой.

## Нерешённые решения (нужен вход пользователя)
1. **Frontend хостинг**: Vercel+VPS-воркеры или всё в Docker на VPS?
2. **LLM для литовского**: GPT-4o (по спеку) vs Claude — на сервере уже есть `ANTHROPIC_API_KEY`,
   так что разумный дефолт = Claude `claude-sonnet-4-6`, замерить себестоимость на 20–50 лидах.

## Важные правила (не нарушать)
- Качаем только `veikiantis=1`. Фильтрация по нише — в Postgres по индексу, НЕ на RC API (contains() висит).
- Google Places: 1 запрос/компания, жёсткий стоп 5000/мес, без доп. запросов как fallback.
- Подтверждение письма человеком обязательно (GDPR). Не делать автомат рассылки.
- Мультитенант (`subscriber_id`) и PWA — заложены с фазы 1.

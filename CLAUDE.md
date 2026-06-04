# Leadgen LT — система лидогенерации для digital-фриланса (Литва)

## Быстрый старт для агента
1. Читай `AGENT_HANDOFF.md` — что сделано, следующий шаг
2. Читай `TASKS.md` — план разработки по фазам (пп. 1–17)
3. Детали — в `docs/`:
   - `docs/ARCHITECTURE.md` — воронка, модули, фазы
   - `docs/DATABASE.md` — схема БД (мультитенант с фазы 1)
   - `docs/API_RC.md` — **проверенный** RC API (эндпоинты, поля, лимиты)
   - `docs/DEPLOY.md` — VPS, Docker, CI/CD
4. Источник истины по бизнес-логике и реализации — два спека-документа:
   `leadgen-service-konspekt.md` (бизнес) и `leadgen-techspec.md` (техника).
   **При конфликте техспек важнее** (новее).

## Проект
Система забирает действующие компании Литвы из открытого реестра (RC, `get.data.gov.lt`),
фильтрует по нише и активности, обогащает данными о сайте (Google Places + HTML-верификация),
прогоняет PageSpeed, формирует лиды и подаёт их через веб-кабинет (Next.js).
Фаза 2 — мультитенантная подписка: аудит, генерация писем, Resend-рассылка, дедупликация, биллинг.

**Парсинга НЕТ.** Источник данных = REST API государства. Puppeteer не используется.

- **VPS**: Hetzner, Docker Compose (Postgres + воркеры; Redis на фазе 2)
- **Frontend**: Next.js (App Router) — Vercel или Docker на VPS (решается на старте)
- **Deploy**: push в main → GitHub Actions → VPS

## Стек (из техспека §2)
- **Frontend/API**: Next.js (App Router) + React + Tailwind CSS + TypeScript
- **Воркеры**: Node.js + node-cron (забор, обогащение, генерация)
- **БД**: PostgreSQL 15 + Prisma (миграции, типобезопасность)
- **Очереди (фаза 2)**: BullMQ + Redis
- **Auth**: Auth.js + 2FA (email-код) / Google OAuth — мультитенант
- **Email**: Resend (мой домен на фазе 1; API подписчика на фазе 2)
- **LLM**: GPT-4o (литовский), опц. Claude `claude-sonnet-4-6` — замерить себестоимость до фиксации цен
- **Push**: Web Push API + VAPID (PWA с фазы 1)

## Ключевые решения (зафиксированы)
- **Качаем ТОЛЬКО действующих** (`veikiantis=1`, ~160k), фильтрация при записи (техспек §5.1).
  Конспект предлагал хранить всё — отменено, побеждает техспек.
- **Мультитенант с фазы 1**: `subscriber_id` в схеме сразу, на фазе 1 заполнен один subscriber (я).
- **PWA + push заложены в фазе 1** (дёшево заложить, дорого ретрофитить).
- **Google Places: 1 запрос на компанию**, жёсткий стоп на 5000/мес, без доп. запросов как fallback.
  Точность — через кандидатов из одного ответа + confidence-scoring + lightweight HTML-верификацию.
- **Подтверждение письма человеком** обязательно (юр-предохранитель GDPR). Не делать автомат.
- **Финансы = атрибут карточки**, не фильтр платёжеспособности.
- 🔒 **БД наружу не публикуется НИКОГДА** (инцидент BSI 2026-06-02: старый compose светил 5432 в интернет).
  Postgres только во внутренней Docker-сети. Docker обходит ufw → защита = не публиковать порт. См. `docs/DEPLOY.md`.

## Структура папок (целевая)
```
├── .github/workflows/        # автодеплой
├── .claude/agents/           # субагенты для параллельной разработки
├── docker-compose.yml
├── prisma/schema.prisma      # схема БД (мультитенант)
├── src/                      # Next.js App Router (страницы, API routes, server actions)
│   ├── app/
│   ├── components/
│   └── lib/                  # shared: db (Prisma client), logger, config, rc-api, places
├── workers/                  # Node-cron воркеры
│   ├── rc-sync/              # забор активных компаний из RC
│   ├── enrich/               # Places (1 запрос) + scoring + HTML-верификация + PageSpeed
│   ├── enrich-fallback/      # нерешённые случаи (Bing/Brave/rekvizitai), не Places
│   ├── audit-gen/            # шаблонный аудит (LLM на Tier 3)
│   ├── email-gen/            # GPT-4o литовское письмо (фаза 2)
│   ├── lead-select/          # дневной отбор по тарифу + дедупликация
│   └── recheck/              # динамика базы (три ведра)
└── docs/
```

## Правила кодирования
- TypeScript везде. Все БД-операции — через Prisma client из `src/lib/db`.
- Все логи — через общий logger (`src/lib/logger`). Все секреты — через `src/lib/config` (читает .env).
- Воркеры принимают CLI-аргументы: `--niche=41`, `--limit=N`, `--batch=N`.
- Каждый воркер начинается с комментария: модуль / что делает / как запустить.
- Google Places: всегда FieldMask, перед запросом — проверка `places_usage.used < 5000`.
- LLM с prompt caching. Никогда не коммитить секреты (.env в .gitignore, .env.example в git).

## Code review gate (Codex) — ОБЯЗАТЕЛЬНО для каждого модуля
После реализации КАЖДОГО модуля по спеке — прогнать его через OpenAI Codex CLI на ревью.
Это делает оркестратор (главный агент): субагент сообщает «модуль готов» → запускаем ревью.

```
scripts/codex-review.sh "<модуль / на что смотреть>"        # ревью незакоммиченных изменений
scripts/codex-review.sh "<модуль>" --commit <sha>           # ревью конкретного коммита
```
Обёртка несёт правила проекта (безопасность БД, RC/Places лимиты, GDPR-подтверждение, мультитенант).
**Находки BLOCKER/MAJOR чинятся до того, как модуль считается готовым.** Только потом — следующий модуль.
(`codex` уже установлен и авторизован; тот же приём используется в проекте DSK.)

## Завершение сессии
1. Обновить `TASKS.md` (отметить выполненное ✅).
2. Перезаписать `AGENT_HANDOFF.md` (следующий шаг для следующего агента).

## Параллельная разработка через субагентов
Доступны в `.claude/agents/`:
- `backend-pipeline` — воркеры (rc-sync, enrich, и т.д.), RC API, Places, PageSpeed, Prisma-запросы
- `db-schema` — Prisma-схема, миграции, мультитенант-изоляция
- `frontend-dev` — Next.js App Router, страницы кабинета, API routes, PWA
- `designer` — UI/UX через глобальные дизайн-скилы (frontend-design, emil-design-eng и др.)
- `devops` — Docker, Compose, GitHub Actions, деплой на VPS

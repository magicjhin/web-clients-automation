# Leadgen — Lithuanian B2B Lead Generation System

## Быстрый старт для агента
1. Читай `AGENT_HANDOFF.md` — что сделано, следующий шаг
2. Читай `TASKS.md` — прогресс по 14 дням
3. При необходимости читай `docs/` — детали архитектуры

## Проект
Автоматизированная система: парсинг литовских компаний → фильтрация → аудит сайта через Claude API → персонализированное письмо на литовском → Telegram управление.

- **VPS**: 178.104.253.76 (Hetzner CX23, Ubuntu)
- **Репо**: https://github.com/magicjhin/web-clients-automation.git
- **Bot**: `https://n8n.webvibe-lead.fun` (Node.js Express, будет реализован)
- **Deploy**: push в main → GitHub Actions → git pull на VPS автоматически

## Стек
- Node.js 20, PostgreSQL 15, Docker Compose
- Express (webhook сервер), Node-cron (оркестрация), Puppeteer (браузер), Claude Sonnet API
- Nodemailer (SMTP), imapflow (IMAP), node-telegram-bot-api

## Структура папок
```
├── .github/workflows/deploy.yml  # Автодеплой
├── docker-compose.yml
├── .env                          # Не в git!
├── .env.example                  # В git (без значений)
├── db/init.sql                   # Схема БД
├── docs/                         # Детальная документация
├── TASKS.md                      # Прогресс ✅🔄📋
├── AGENT_HANDOFF.md              # Контекст для следующей сессии
└── scripts/
    ├── shared/     db.js, logger.js, config.js
    ├── parser/     index.js, scraper.js, normalizer.js
    ├── filter/     index.js, pagespeed.js, screenshot.js, design.js, activity.js, vip.js (⏳ не реализованы)
    ├── audit/      index.js, crawler.js, claude.js, letterTemplates.js (⏳ не реализованы)
    ├── email/      sender.js, followup.js, imap.js (⏳ не реализованы)
    └── bot/        index.js, telegram.js, cron.js (⏳ не реализованы)
```

## Правила кодирования
- Все DB операции только через `scripts/shared/db.js` (pg Pool)
- Все логи только через `scripts/shared/logger.js`
- Все секреты только через `scripts/shared/config.js` (загружает .env)
- Puppeteer: всегда headless + `--no-sandbox` (Docker)
- Claude: модель `claude-sonnet-4-6`, включать prompt caching
- Каждый index.js начинается с комментария: модуль / что делает / как запустить
- Скрипты принимают CLI аргументы: `--niche=X`, `--batch=N`, `--limit=N`

## Завершение сессии
Перед выходом обязательно:
1. Обновить `TASKS.md` — отметить выполненное
2. Перезаписать `AGENT_HANDOFF.md` — следующий шаг для следующего агента

## Документация
- `docs/ARCHITECTURE.md` — воронка, VIP система, типы писем, обработка ошибок
- `docs/DATABASE.md` — полная схема БД, все колонки, статусы
- `docs/DEPLOY.md` — VPS setup, Docker, GitHub Actions

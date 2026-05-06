# Agent Handoff

## Текущий статус

День 11 из 14. Парсер и Telegram бот полностью работают. Следующий шаг — запустить `/discover` из Telegram чтобы найти все реальные ниши, потом начать фильтрацию (День 5-6).

---

## Что сделано в этой сессии

### Парсер
- `scraper.js` — полностью переписан: парсит все страницы (не 50), resume с последней страницы, глобальный `parseState` для live трекинга прогресса
- Дедупликация по `rekvizitai_url` (SELECT перед INSERT) — раньше был ложный дедуп по имени
- `parser/index.js` — передаёт `nicheName` в scraper, экспортирует `getParseState`

### Ниши
- `discover-niches.js` — новый скрипт: заходит на rekvizitai.vz.lt, проверяет каждую из ~291 категорий, добавляет в БД те где > 500 фирм. Имеет `discoverState` для live трекинга.
- `sync-categories.js` — вспомогательный: синхронизирует search_term с реальными URL ключами сайта
- `fix-niches-mapping.sql` — правильный маппинг всех 50 старых ниш к реальным ключам

### Telegram бот (новые команды)
- `/discover [min]` — запускает поиск ниш (по умолчанию min=500), работает в фоне, присылает результат
- `/discover_status` — прогресс-бар поиска ниш (категория, %, найдено, добавлено)
- `/parse_status` — прогресс-бар парсинга (страница, %, найдено, новых, время)
- `/reset_niche <id>` — сброс ниши из Telegram (удаляет компании, сбрасывает прогресс)

### БД
- Добавлены колонки `total_pages`, `last_parsed_page` в таблицу `niches` (ALTER TABLE на VPS)
- Уникальный индекс `idx_companies_rekvizitai_url` на `companies(rekvizitai_url)`

---

## Состояние VPS

- Контейнеры: `leadgen_postgres` + `leadgen_node` запущены
- БД: ниши и компании очищены (DELETE FROM companies; DELETE FROM niches)
- Бот: работает, отвечает на команды
- Код: актуальный (последний pull: commit 91f68c3)

---

## Следующий конкретный шаг

**1. Запустить поиск ниш из Telegram:**
```
/discover
```
Подождать 10-15 минут, следить через `/discover_status`. Бот пришлёт результат.

**2. После завершения — запустить парсинг первой ниши:**
```
/niches          <- посмотреть какие ниши добавились
/parse <id>      <- запустить парсинг
/parse_status    <- следить за прогрессом
```

**3. После накопления 500+ raw компаний — реализовать фильтрацию (День 5-6):**
- `scripts/filter/pagespeed.js` — PageSpeed Insights API
- `scripts/filter/screenshot.js` — Puppeteer скриншот
- `scripts/filter/design.js` — Claude API оценка дизайна
- `scripts/filter/index.js` — полный pipeline

---

## Архитектура бота

```
Telegram → https://n8n.webvibe-lead.fun/webhook/telegram (Caddy HTTPS → port 5678)
    → Express POST /webhook/telegram
    → telegram.handleUpdate(req.body)
    → switch(cmd) → handler
```

Команды парсинга вызывают `parser.parseNiche()` / `discoverNiches()` напрямую в процессе (не через execFile — нет таймаута).

---

## Важные файлы

| Файл | Статус |
|------|--------|
| `scripts/bot/index.js` | ✅ точка входа, порт 5678 |
| `scripts/bot/telegram.js` | ✅ все команды |
| `scripts/bot/cron.js` | ✅ расписание |
| `scripts/parser/scraper.js` | ✅ парсер с трекингом |
| `scripts/parser/index.js` | ✅ оркестратор |
| `scripts/parser/discover-niches.js` | ✅ поиск ниш |
| `scripts/shared/db.js` | ✅ pg Pool |
| `scripts/shared/logger.js` | ✅ логгер |
| `scripts/filter/index.js` | 📋 не реализован |
| `scripts/audit/index.js` | 📋 не реализован |
| `scripts/email/sender.js` | 📋 не реализован |

---

## Блокеры

- `scripts/filter/index.js` — не реализован (День 5-6), `/filter` команда возвращает заглушку
- `scripts/audit/index.js` — не реализован (День 7-8), `/run` команда возвращает заглушку
- `scripts/email/` — не реализован (День 9+)

---

## Важные детали

- `docker-compose restart node` — правильная команда (не `restart leadgen_node`)
- `docker-compose down && docker-compose up -d` — если контейнер завис
- logger.js — фабрика: `require('./shared/logger')('module')` возвращает `{info, warn, error}`
- `db.one()` возвращает `null` если не найдено (не бросает исключение)
- Puppeteer требует Chrome libs в Docker (уже установлены в Dockerfile)
- VPS: 178.104.253.76, папка `/opt/leadgen`

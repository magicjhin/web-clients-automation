# TASKS - Прогресс разработки (14 дней)

Статусы: ✅ сделано / 🔄 в процессе / 📋 не начато / ❌ заблокировано

---

## День 1 - VPS + Git + Docker
✅ Установить Docker + Docker Compose + Git на VPS  
✅ git clone репо на VPS в `/opt/leadgen`  
✅ Загрузить `.env` на VPS вручную  
✅ Добавить SSH ключ в GitHub Secrets  
✅ Создать `docker-compose.yml`  
✅ Создать `.github/workflows/deploy.yml`  
✅ Запустить `docker compose up -d postgres node`  
✅ Dockerfile с Chrome зависимостями для Puppeteer

## День 2 - База данных
✅ Написать `db/init.sql` с таблицами `niches`, `companies`, `parse_history`, `logs`  
✅ Добавлены колонки `total_pages`, `last_parsed_page` в `niches`  
✅ Выполнить init SQL на VPS (ALTER TABLE для существующей БД)  
✅ Проверить, что таблицы созданы

## День 3 - Общие утилиты
✅ `scripts/shared/db.js` - pg Pool и query helpers  
✅ `scripts/shared/logger.js` - запись в `logs` и console  
✅ `scripts/shared/config.js` - загрузка `.env`  
✅ Проверить загрузку конфига и доступ к БД

## День 4 - Парсер rekvizitai.lt
✅ `scripts/parser/scraper.js` - Puppeteer, пагинация по всем страницам, resume с последней страницы, глобальный parseState для трекинга  
✅ `scripts/parser/normalizer.js` - очистка email, phone, URL  
✅ `scripts/parser/index.js` - CLI `--list`, `--niche=X`, `--auto`, экспорт getParseState  
✅ `scripts/parser/discover-niches.js` - автопоиск ниш с 500+ фирм, экспорт getDiscoverState  
✅ `scripts/parser/sync-categories.js` - синхронизация search_term с реальными URL ключами сайта  
✅ `scripts/parser/fix-niches-mapping.sql` - правильный маппинг всех 50 ниш  
✅ `db/niches_seed.sql` - seed 50 ниш (устарел, теперь используется /discover)  
✅ Парсинг протестирован: ниша Restoranai ir Barai (359 стр)  
✅ Дедупликация по `rekvizitai_url` (SELECT перед INSERT)

## День 5 - Фильтр часть 1
📋 `scripts/filter/pagespeed.js` - PageSpeed API  
📋 `scripts/filter/screenshot.js` - Puppeteer screenshot  
📋 Тест: проверить оба модуля независимо

## День 6 - Фильтр часть 2
📋 `scripts/filter/design.js` - Claude API оценка дизайна  
📋 `scripts/filter/activity.js` - Google Maps API  
📋 `scripts/filter/vip.js` - расчет VIP score  
📋 `scripts/filter/index.js` - полный pipeline  
📋 Тест: 5 raw компаний через фильтр

## День 7 - Краулер + аудит
📋 `scripts/audit/crawler.js` - Puppeteer crawling  
📋 `scripts/audit/claude.js` - аудит JSON и перепроверка  
📋 Логика: если `audit_confidence < 6` -> pending + Telegram уведомление  
📋 Тест: аудит одной qualified компании

## День 8 - Генерация писем
📋 `scripts/audit/letterTemplates.js` - 3 шаблона на литовском  
📋 Расширить `claude.js` генерацией письма  
📋 `scripts/audit/index.js` - orchestration аудита  
📋 Тест: сгенерировать письмо и проверить литовский текст

## День 9 - Email отправка
📋 `scripts/email/sender.js` - Nodemailer  
📋 Расширить `audit/index.js` отправкой и обновлением статуса  
📋 Тест: отправить письмо себе

## День 10 - Telegram бот
✅ `scripts/bot/index.js` - Express сервер + setWebhook + запуск cron  
✅ `scripts/bot/telegram.js` - все команды: /status, /niches, /parse, /parse_status, /reset_niche, /discover, /discover_status, /filter, /run, /pause, /resume, /history, /logs, /calls, /help  
✅ `scripts/bot/cron.js` - node-cron расписания  
✅ Все команды работают на VPS

## День 11 - HTTPS и домен
✅ DNS `A n8n -> 178.104.253.76`  
✅ Caddy установлен, HTTPS работает  
✅ `https://n8n.webvibe-lead.fun` доступен  
✅ Бот задеплоен, отвечает на команды в Telegram

## День 12 - IMAP входящие
📋 `scripts/email/imap.js` - imapflow + сопоставление ответов + Telegram уведомление  
📋 Тест: ответить на тестовое письмо и проверить уведомление

## День 13 - End-to-end тестирование
📋 E2E тест с 1 нишей: parse -> filter -> audit -> email -> reply  
📋 Тест: сайт недоступен -> VIP статус  
📋 Тест: несуществующий email -> `email_failed`  
📋 Тест: падение Postgres -> Telegram alert  
📋 Исправить найденные баги

## День 14 - Запуск
📋 `/discover` из Telegram — найти все ниши с 500+ фирм  
📋 `/parse` первых 2-3 ниш  
📋 Фильтрация  
📋 `/run` первый batch 15 компаний  
📋 Мониторинг Telegram

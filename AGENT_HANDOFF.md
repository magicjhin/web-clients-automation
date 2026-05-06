# Agent Handoff

## Текущий статус

День 11 из 14. HTTPS домен настроен и работает. n8n полностью убран из проекта. Требуется переделать Telegram бот-инфраструктуру с использованием чистого Node.js вместо n8n воркфлоу.

---

## Что сделано в этой сессии

- Настроена DNS запись `A n8n -> 178.104.253.76`
- Установлен Caddy на VPS и получена HTTPS через Let's Encrypt
- Проверена работа `https://n8n.webvibe-lead.fun` (HTTP/2 200, TLSv1.3)
- Убран весь n8n прогресс из проекта (удалены JSON воркфлоу, http-executor.js, лишние скрипты и MD документация)
- Обновлены TASKS.md и docker-compose.yml
- Сброшены статусы День 10 и 11 на "не начато" и переформулированы под новый подход

---

## Текущая архитектура (новая)

Telegram бот будет состоять из трёх компонентов Node.js:

```
scripts/bot/
  ├── index.js      ← точка входа: Express сервер + cron планировщик
  ├── telegram.js   ← обработчик webhook, маршрутизация команд
  └── cron.js       ← расписание для pipeline задач (parser, filter, audit, etc)
```

**Webhook поток:**
```
Telegram message → Express /webhook/telegram → Парсинг команды → Запуск скрипта → Отправка ответа
```

**Cron поток:**
```
09:00 ежедневно   → node scripts/parser/index.js
каждые 30 минут   → node scripts/filter/index.js --batch=10 (заглушка)
каждые 30 минут   → node scripts/audit/index.js --batch=5 (заглушка)
10:00 ежедневно   → node scripts/email/followup.js (заглушка)
каждые 5 минут    → node scripts/email/imap.js (заглушка)
```

Результаты любого скрипта отправляются в Telegram чат `TELEGRAM_CHAT_ID`.

---

## Важные файлы

**Удалены:**
- `n8n/` (все 6 JSON воркфлоу)
- `scripts/http-executor.js`
- `scripts/deploy-workflows.js`, `scripts/setup-workflows.js`, `scripts/import-workflows.js`
- `scripts/telegram/bot.js` (старый polling)
- `scripts/telegram/command.js` (CLI для n8n)
- `docs/WORKFLOWS.md`, `docs/HTTP_EXECUTOR_SETUP.md`, `docs/DOMAIN_SETUP.md`
- `WORKFLOWS_SUMMARY.md`

**Актуальные:**
- `scripts/shared/` — db.js, logger.js, config.js (без изменений)
- `scripts/parser/` — index.js, scraper.js, normalizer.js (без изменений)
- `docker-compose.yml` — убран сервис n8n и том n8n_data
- `package.json` — добавить `node-cron` при реализации

---

## Следующий конкретный шаг

1. **Создать `scripts/bot/index.js`** — основной файл, который:
   - Загружает config через `scripts/shared/config.js`
   - Создаёт Express приложение на порту 5678
   - Регистрирует маршрут `POST /webhook/telegram` (использует `telegram.js`)
   - Регистрирует cron расписания (использует `cron.js`)
   - При старте отправляет `setWebhook` в Telegram API

2. **Создать `scripts/bot/telegram.js`** — обработчик команд:
   - Парсит `body.message.text` из Telegram update
   - Маршрутизирует по команде (/status, /parse, /niches, и т.д.)
   - Для интерактивных команд: запускает скрипт, отправляет результат в Telegram
   - Поддерживает те же 10+ команд, что и старые системы

3. **Создать `scripts/bot/cron.js`** — планировщик:
   - Регистрирует 5 cron задач по расписанию (parser, filter, audit, followup, imap)
   - Для каждого срабатывания: запускает скрипт, отправляет результат в Telegram
   - Для нереализованных скриптов (filter/index.js, audit/index.js): пропускает с логом

4. **Добавить `node-cron` в package.json** — зависимость для cron планировщика

5. **Обновить `docker-compose.yml` сервис node**:
   - Изменить command с `tail -f /dev/null` на `node scripts/bot/index.js`
   - Добавить `ports: ["5678:5678"]` (Caddy будет проксировать через HTTPS)

6. **На VPS:**
   - `cd /opt/leadgen && docker compose pull && docker compose up -d`
   - Проверить `docker logs leadgen_node` — должно быть "Bot started, webhook registered"
   - Отправить `/status` боту в Telegram — должен вернуть ответ

---

## Блокеры

- `scripts/filter/index.js` — не реализован (возвращает заглушку)
- `scripts/audit/index.js` — не реализован (возвращает заглушку)
- `scripts/email/followup.js` — не реализован (возвращает заглушку)
- `scripts/email/imap.js` — не реализован (возвращает заглушку)

Все эти скрипты будут пропущены в cron с log-записью, не падать.

---

## Осторожно

- Не возвращаться к n8n — вся инфраструктура убрана полностью
- Caddy Caddyfile уже настроен на `https://n8n.webvibe-lead.fun → localhost:5678` — когда бот запустится, это будет работать без изменений
- Telegram webhook должен быть на `https://n8n.webvibe-lead.fun/webhook/telegram` (URL зарегистрирован при старте бота)

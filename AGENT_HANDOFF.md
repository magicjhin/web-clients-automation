# Agent Handoff

## Текущий статус

День 11 из 14. Telegram бот полностью реализован (Days 10-11). Требуется задеплоить на VPS и протестировать.

---

## Что сделано в этой сессии

- Создан `scripts/bot/index.js` — Express сервер на порту 5678, регистрирует webhook в Telegram, запускает cron
- Создан `scripts/bot/telegram.js` — обработчик всех команд бота (/status, /niches, /parse, /filter, /run, /pause, /resume, /history, /logs, /calls, /help)
- Создан `scripts/bot/cron.js` — node-cron расписания: parser 09:00, filter каждые 30 мин, audit каждые 30 мин, followup 10:00, imap каждые 5 мин
- Добавлен `node-cron` в package.json
- Обновлён `docker-compose.yml`: команда `node scripts/bot/index.js`, добавлен port mapping `5678:5678`

---

## Архитектура бота

```
Telegram message
    ↓
https://n8n.webvibe-lead.fun/webhook/telegram (Caddy HTTPS → port 5678)
    ↓
Express POST /webhook/telegram
    ↓
telegram.handleUpdate(req.body)
    ↓
switch(cmd) → handler function
    ↓
runScript('parser/index.js', ['--niche=1'])  ← child_process.execFile
    ↓
sendMessage(chatId, result)
```

```
Cron (node-cron)
├── 09:00 daily   → parser/index.js --auto
├── */30 * * * *  → filter/index.js --batch=10 (если файл существует)
├── 15,45 * * * * → audit/index.js --batch=5 (если файл существует)
├── 10:00 daily   → email/followup.js (если файл существует)
└── */5 * * * *   → email/imap.js (если файл существует)
```

Нереализованные скрипты (filter, audit, followup, imap) — пропускаются тихо через `fs.existsSync` проверку.

---

## Следующий конкретный шаг — деплой на VPS

```bash
# Подключиться к VPS
ssh root@178.104.253.76

# Перейти в папку проекта
cd /opt/leadgen

# Получить последние изменения
git pull origin main

# Пересобрать и перезапустить
docker compose down
docker compose up -d --build

# Проверить логи
docker logs -f leadgen_node
```

Ожидаемый вывод в логах:
```
[bot] Express сервер запущен на порту 5678
[bot] Webhook зарегистрирован: https://n8n.webvibe-lead.fun/webhook/telegram
[cron] Cron планировщик запущен (5 задач)
[bot] Бот запущен, webhook зарегистрирован, cron активен
```

После этого написать `/help` в Telegram — бот должен ответить.

---

## Тестирование команд

После деплоя проверить последовательно:
1. `/help` — должен показать список команд
2. `/status` — должен показать статистику из БД
3. `/niches` — должен показать список ниш
4. `/parse 1` — должен запустить парсинг ниши #1

---

## Важные файлы

**Актуальные:**
- `scripts/bot/index.js` — точка входа
- `scripts/bot/telegram.js` — команды бота
- `scripts/bot/cron.js` — расписание
- `scripts/shared/` — db.js, logger.js, config.js
- `scripts/parser/` — полностью реализован
- `docker-compose.yml` — postgres + node (port 5678)

---

## Блокеры

- `scripts/filter/index.js` — не реализован (День 5-6)
- `scripts/audit/index.js` — не реализован (День 7-8)
- `scripts/email/followup.js` — не реализован (День 9)
- `scripts/email/imap.js` — не реализован (День 12)

Cron для этих скриптов тихо пропускает если файл не существует — бот не падает.

---

## Осторожно

- Не возвращаться к n8n — убран полностью
- Caddy уже настроен: `https://n8n.webvibe-lead.fun → localhost:5678`
- Webhook URL зарегистрируется автоматически при старте бота
- PORT по умолчанию 5678 (берётся из `process.env.PORT || 5678`)

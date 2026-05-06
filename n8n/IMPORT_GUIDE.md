# n8n Import Guide — Импорт всех 6 воркфлоу

## Быстрый импорт (рекомендуется)

### Шаг 1: Скачай файлы
Все JSON файлы находятся в `n8n/` папке:
```
n8n/
├── 01-telegram-bot.json
├── 02-parser.json
├── 03-filter.json
├── 04-audit-email.json
├── 05-followup-email.json
└── 06-imap-listener.json
```

### Шаг 2: Импортируй в n8n

1. Зайди в n8n: http://178.104.253.76:5678
2. Нажми меню **Dashboard** (левая сторона)
3. Нажми **+ New** → **Import from URL** или **Import from file**
4. Выбери файл `01-telegram-bot.json`
5. Нажми **Import**
6. Повтори для остальных файлов (02, 03, 04, 05, 06)

### Шаг 3: Настрой Credentials

Для каждого воркфлоу, если нужны credentials:

1. Открой воркфлоу
2. Найди ноду **Telegram** (если есть)
3. Нажми на **Credentials** → **Create New** или выбери существующие
4. Введи:
   - **Bot Token**: `8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A`

### Шаг 4: Активируй воркфлоу

Для каждого воркфлоу нажми кнопку **Activate** (вверху справа)

---

## Альтернатива: Создавай вручную через UI

Если импорт не работает, смотри инструкции в:
```
docs/N8N_WORKFLOWS_COMPLETE.md
```

Там пошагово описано как создавать каждый воркфлоу через UI.

---

## Проверка после импорта

### 1. Telegram Webhook

Установи webhook для Telegram Bot:

```bash
# PowerShell
$token = "8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A"
curl.exe -X POST "https://api.telegram.org/bot$token/setWebhook?url=http://178.104.253.76:5678/webhook/telegram-bot"

# BASH
curl -X POST "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook?url=http://178.104.253.76:5678/webhook/telegram-bot"
```

### 2. Тест Telegram Bot

Отправь команду:
```
/help
```

В ответ должен прийти список команд.

### 3. Тест Parser

В n8n откройте **Workflow 2 (Parser)**, нажмите **Manual Trigger** и посмотри результат.

Или в Telegram:
```
/parse 1
```

### 4. Проверь логи n8n

```bash
docker logs -f leadgen_n8n | tail -50
```

---

## Структура воркфлоу

```
Workflow 1: Telegram Bot
  ├─ Webhook (получает сообщения из Telegram)
  ├─ Switch (распознаёт команду: /parse, /status, /help)
  ├─ Execute Command (запускает скрипт)
  └─ Send Telegram (отправляет результат обратно)

Workflow 2: Parser (ручной запуск парсинга)
  ├─ Manual Trigger
  ├─ Execute Command: parser/index.js
  └─ Send Telegram

Workflow 3: Filter (ручной запуск фильтрации)
  ├─ Manual Trigger
  ├─ Execute Command: filter/index.js
  └─ Send Telegram

Workflow 4: Audit & Email (автоматический в 09:00)
  ├─ Cron 09:00
  ├─ Execute Command: audit/index.js
  └─ Send Telegram

Workflow 5: Follow-up Email (автоматический в 10:00)
  ├─ Cron 10:00
  ├─ Execute Command: email/followup.js
  └─ Send Telegram

Workflow 6: IMAP Listener (автоматический каждые 30 мин)
  ├─ Cron */30
  ├─ Execute Command: email/imap.js
  └─ (Telegram алерты отправляются изнутри скрипта)
```

---

## Команды для тестирования в Telegram

```
/help                    # Справка
/parse                   # Список ниш
/parse 1                 # Парсить нишу #1
/parse 2                 # Парсить нишу #2
/parse auto              # Автопарсинг (если < 100 qualified)
/status                  # Статус системы
/stats                   # Статистика по нишам
```

---

## Troubleshooting

### Webhook не работает

1. Проверь доступность n8n:
```bash
curl http://178.104.253.76:5678
```

2. Проверь статус webhook'а в Telegram:
```bash
curl -X GET "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/getWebhookInfo"
```

3. Смотри логи n8n:
```bash
docker logs -f leadgen_n8n
```

### Команда не выполняется

Проверь, что скрипты находятся на месте:
```bash
docker exec leadgen_node ls -la /app/scripts/
```

### Ответ не приходит в Telegram

1. Проверь Chat ID в воркфлоу (должна быть цифра: `5900706320`)
2. Проверь, что бот добавлен в чат (@leadgenbot или как назовешь)
3. Проверь токен бота

---

## Дальнейшие шаги

После импорта и тестирования:

1. ✅ Все 6 воркфлоу активированы
2. ✅ Telegram бот отвечает на команды
3. 📋 Начинай разработку остальных модулей:
   - День 5-6: Filter
   - День 7-8: Audit + Letter
   - День 9: Email Sender
   - День 13-14: Админ-панель Web UI

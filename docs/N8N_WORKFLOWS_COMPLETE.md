# n8n Workflows — Полная конфигурация (6 воркфлоу)

## Обзор всех воркфлоу

| № | Название | Триггер | Действие |
|---|----------|---------|----------|
| 1 | **Telegram Bot** | Webhook от Telegram | Обработка команд (/parse, /status и т.д.) |
| 2 | **Parser** | Telegram /parse или Manual | Запуск scraper.js с поиском на rekvizitai.lt |
| 3 | **Filter** | Manual или Cron | Запуск filter/index.js для проверки качества |
| 4 | **Audit & Email** | Cron 09:00 ежедневно | Запуск audit/index.js + отправка писем |
| 5 | **Follow-up Email** | Cron 10:00 ежедневно | Повторные письма (через 3 дня) |
| 6 | **IMAP Listener** | Cron каждые 30 мин | Проверка входящих писем, Telegram алерты |

---

# Workflow 1: Telegram Bot (основной роутер)

## Логика:
```
Webhook (Telegram) 
  → Распознай команду
  → Роутируй к нужной функции
  → Отправь результат в Telegram
```

## Ноды n8n:

### 1.1 Webhook
- **Type**: Webhook
- **Path**: `telegram-bot`
- **Method**: POST
- **Auth**: None (для тестирования)

### 1.2 Extract Message
- **Type**: Function
- **Code**:
```javascript
const msg = $input.first().json.message;
return {
  json: {
    text: msg.text || '',
    chatId: msg.chat.id,
    userId: msg.from.id,
    messageId: msg.message_id
  }
};
```

### 1.3 Switch - Command Router
- **Type**: Switch
- **Условия**:
  - `text` contains `/parse` → Output 1
  - `text` contains `/status` → Output 2
  - `text` contains `/stats` → Output 3
  - `text` contains `/help` → Output 4
  - Default → Output 5

### 1.4a Execute - Parse Command
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/parser/index.js --list`

### 1.4b Execute - Status
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/parser/index.js --status`

### 1.4c Execute - Stats
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/parser/index.js --stats`

### 1.4d Function - Help Message
- **Type**: Function
- **Code**:
```javascript
return {
  json: {
    message: `🤖 *Leadgen Bot* — управление системой

*Команды:*
📊 /parse — показать топ 5 ниш
📊 /parse 1 — парсить нишу #1
🔄 /parse auto — автопарсинг
📈 /status — статус всех процессов
📋 /stats — статистика по нишам
❓ /help — эта справка`
  }
};
```

### 1.5 Function - Format Response
- **Type**: Function
- **Code**:
```javascript
let result = $input.first().json;
let text = '';

if (typeof result === 'string') {
  text = result;
} else if (result.message) {
  text = result.message;
} else if (result.error) {
  text = `❌ ${result.error}`;
} else {
  text = JSON.stringify(result, null, 2);
}

return {
  json: {
    text: text,
    chatId: $node["Extract Message"].json.chatId
  }
};
```

### 1.6 Telegram - Send Message
- **Type**: Telegram
- **Resource**: Message
- **Chat ID**: `{{ $node["Format Response"].json.chatId }}`
- **Text**: `{{ $node["Format Response"].json.text }}`
- **Parse Mode**: Markdown

---

# Workflow 2: Parser (запуск парсинга)

## Логика:
```
Manual Trigger
  → Получи аргументы (niche_id)
  → Execute Command: parser/index.js --niche=X
  → Отправь результат в Telegram
```

## Ноды:

### 2.1 Manual Trigger
- **Type**: Manual Trigger
- (Для быстрого тестирования из n8n UI)

### 2.2 Execute - Parser Script
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/parser/index.js --niche={{$node["Manual Trigger"].json.nicheId || 1}}`

### 2.3 Parse JSON
- **Type**: Function
- **Code**:
```javascript
let result = {};
try {
  result = JSON.parse($input.first().json.stdout || '{}');
} catch (e) {
  result = { message: $input.first().json.stdout };
}
return { json: result };
```

### 2.4 Telegram - Notify
- **Type**: Telegram
- **Chat ID**: `{{ $env.TELEGRAM_CHAT_ID }}`
- **Text**: `{{ $node["Parse JSON"].json.message || "Парсинг завершён" }}`

---

# Workflow 3: Filter (фильтрация компаний)

## Логика:
```
Manual Trigger или Cron (если нужно)
  → Execute Command: filter/index.js --limit=100
  → Отправь статус в Telegram
```

## Ноды:

### 3.1 Manual Trigger
- **Type**: Manual Trigger

### 3.2 Execute - Filter Script
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/filter/index.js --limit=100`

### 3.3 Parse JSON
- **Type**: Function
- **Code**:
```javascript
let result = {};
try {
  result = JSON.parse($input.first().json.stdout || '{}');
} catch (e) {
  result = { message: $input.first().json.stdout };
}
return { json: result };
```

### 3.4 Telegram - Notify
- **Type**: Telegram
- **Chat ID**: `{{ $env.TELEGRAM_CHAT_ID }}`
- **Text**: `✅ Фильтрация завершена: {{ $node["Parse JSON"].json.companiesFiltered || 0 }} qualified`

---

# Workflow 4: Audit & Email (ежедневный аудит в 09:00)

## Логика:
```
Cron 09:00 ежедневно
  → Execute Command: audit/index.js --batch=15
  → Отправь результат в Telegram
  → Письма автоматически отправляются изнутри скрипта
```

## Ноды:

### 4.1 Cron Trigger
- **Type**: Cron
- **Cron Expression**: `0 9 * * *` (09:00 каждый день)
- **Timezone**: Europe/Vilnius

### 4.2 Execute - Audit Script
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/audit/index.js --batch=15`

### 4.3 Parse JSON
- **Type**: Function
- **Code**:
```javascript
let result = {};
try {
  result = JSON.parse($input.first().json.stdout || '{}');
} catch (e) {
  result = { message: $input.first().json.stdout };
}
return { json: result };
```

### 4.4 Telegram - Notify
- **Type**: Telegram
- **Chat ID**: `{{ $env.TELEGRAM_CHAT_ID }}`
- **Text**: `📧 Аудит завершён: отправлено {{ $node["Parse JSON"].json.emailsSent || 0 }} писем, VIP: {{ $node["Parse JSON"].json.vipCount || 0 }}`

---

# Workflow 5: Follow-up Email (повторные письма в 10:00)

## Логика:
```
Cron 10:00 ежедневно
  → Execute Command: email/followup.js
  → Отправь статус в Telegram
```

## Ноды:

### 5.1 Cron Trigger
- **Type**: Cron
- **Cron Expression**: `0 10 * * *` (10:00 каждый день)
- **Timezone**: Europe/Vilnius

### 5.2 Execute - Followup Script
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/email/followup.js`

### 5.3 Parse JSON
- **Type**: Function
- **Code**:
```javascript
let result = {};
try {
  result = JSON.parse($input.first().json.stdout || '{}');
} catch (e) {
  result = { message: $input.first().json.stdout };
}
return { json: result };
```

### 5.4 Telegram - Notify
- **Type**: Telegram
- **Chat ID**: `{{ $env.TELEGRAM_CHAT_ID }}`
- **Text**: `📧 Повторные письма: отправлено {{ $node["Parse JSON"].json.followupsSent || 0 }} шт`

---

# Workflow 6: IMAP Listener (проверка входящих каждые 30 минут)

## Логика:
```
Cron каждые 30 минут
  → Execute Command: email/imap.js
  → Скрипт сам отправляет Telegram алерты при ответах
```

## Ноды:

### 6.1 Cron Trigger
- **Type**: Cron
- **Cron Expression**: `*/30 * * * *` (каждые 30 минут)
- **Timezone**: Europe/Vilnius

### 6.2 Execute - IMAP Script
- **Type**: Execute Command
- **Command**: `cd /opt/leadgen && node scripts/email/imap.js`

### 6.3 Parse JSON
- **Type**: Function
- **Code**:
```javascript
let result = {};
try {
  result = JSON.parse($input.first().json.stdout || '{}');
} catch (e) {
  result = { message: $input.first().json.stdout };
}
return { json: result };
```

### 6.4 Telegram - Debug (опционально)
- **Type**: Telegram (если есть ошибка)
- **Condition**: `stdout` contains "error"
- **Chat ID**: `{{ $env.TELEGRAM_CHAT_ID }}`
- **Text**: `⚠️ IMAP ошибка: {{ $node["Parse JSON"].json.message }}`

---

## Установка Webhook'а для Telegram

После создания **Workflow 1 (Telegram Bot)**, установи webhook:

```bash
# PowerShell
$token = "8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A"
$webhook_url = "http://178.104.253.76:5678/webhook/telegram-bot"

curl.exe -X POST "https://api.telegram.org/bot$token/setWebhook?url=$webhook_url"

# Или BASH
curl -X POST "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook?url=http://178.104.253.76:5678/webhook/telegram-bot"
```

Проверь статус:
```bash
curl -X GET "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/getWebhookInfo"
```

---

## Активация воркфлоу

1. Зайди в n8n: http://178.104.253.76:5678
2. Для каждого воркфлоу нажми **Activate** (кнопка вверху)
3. Проверь, что все имеют зелёный статус

---

## Тестирование

### Workflow 1 (Telegram Bot)
```
Отправь в Telegram: /help
Должен прийти ответ с командами
```

### Workflow 2 (Parser)
```
В n8n: Manual Trigger для Workflow 2
Или в Telegram: /parse 1
Должен начаться парсинг Stomatologija
```

### Workflow 3 (Filter)
```
В n8n: Manual Trigger для Workflow 3
Должна начаться фильтрация
```

### Workflow 4-6 (Cron)
```
Будут выполняться по расписанию
Смотри логи n8n: docker logs leadgen_n8n
```

---

## Troubleshooting

**Webhook не работает:**
```bash
# Проверь доступность n8n
curl http://178.104.253.76:5678

# Проверь логи
docker logs leadgen_n8n | tail -100
```

**Команда не выполняется:**
```bash
# Проверь, что скрипты существуют
docker exec leadgen_node ls -la /app/scripts/parser/
docker exec leadgen_node ls -la /app/scripts/filter/
```

**Ответ не приходит в Telegram:**
- Проверь, что Chat ID правильный (должна быть цифра)
- Проверь, что бот добавлен в чат
- Проверь токен в n8n Telegram credentials

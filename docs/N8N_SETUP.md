# n8n Setup — Telegram Bot Workflow

## Быстрый старт

Зайди в n8n: http://178.104.253.76:5678

---

## Workflow 1: Telegram Bot (основной)

### Шаг 1: Создай Webhook

1. **+ Add node** → выбери **Webhook**
2. Настройка:
   - **Webhook path**: `telegram-bot`
   - **Authentication**: Basic auth (или оставь пусто для тестирования)
   - **HTTP method**: POST

**Скопируй URL webhook'а** (нужен для Telegram)

### Шаг 2: Set Webhook в Telegram Bot API

Выполни в PowerShell:
```powershell
$token = "8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A"
$webhook_url = "http://178.104.253.76:5678/webhook/telegram-bot"

Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/setWebhook?url=$webhook_url" -Method Post
```

**Или через curl:**
```bash
curl -X POST "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook?url=http://178.104.253.76:5678/webhook/telegram-bot"
```

---

### Шаг 3: Роутер команд

После **Webhook** добавь **Switch** ноду:

1. **+ Add node** → **Switch**
2. **Данные для switch'а:**

```
Condition 1: message.text contains "/parse"
  → Output 1

Condition 2: message.text contains "/status"
  → Output 2

Condition 3: message.text contains "/help"
  → Output 3

Default:
  → Output 4 (неизвестная команда)
```

---

### Шаг 4: Execute Command для /parse

Для каждого вывода из Switch добавь **Execute Command**:

#### Output 1: /parse → Extract Args

Добавь **Function** ноду после switch output 1:
```javascript
const text = $input.first().json.message.text;
const match = text.match(/\/parse\s*(\d+)?\s*(auto)?/);
const nicheId = match?.[1];
const isAuto = match?.[2] === 'auto';

return {
  json: {
    command: 'parse',
    nicheId: nicheId ? parseInt(nicheId) : null,
    isAuto: !!isAuto,
    chatId: $input.first().json.message.chat.id
  }
};
```

Потом **Switch** по `nicheId`:

**Case 1:** nicheId is empty & isAuto is false
```
Execute Command: cd /opt/leadgen && node scripts/parser/index.js --list
```

**Case 2:** nicheId is set
```
Execute Command: cd /opt/leadgen && node scripts/parser/index.js --niche={{$node["extract-parse-args"].json.nicheId}}
```

**Case 3:** isAuto is true
```
Execute Command: cd /opt/leadgen && node scripts/parser/index.js --auto
```

---

#### Output 2: /status

**Execute Command**:
```
cd /opt/leadgen && node scripts/parser/index.js --status
```

---

#### Output 3: /help

**Function** ноду:
```javascript
return {
  json: {
    message: `🤖 *Leadgen Bot*

*Команды:*
📊 /parse — топ 5 ниш
📊 /parse 1 — парсить нишу #1
🔄 /parse auto — автопарсинг
📈 /status — статус
❓ /help — справка`
  }
};
```

---

### Шаг 5: Объедини все в Format + Send

Перед отправкой в Telegram добавь **Function** для форматирования:

```javascript
const result = $input.first().json;
const chatId = $node["Webhook"].json.message.chat.id;

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
    chatId: chatId,
    text: text
  }
};
```

Потом добавь **Telegram** ноду:
1. **+ Add node** → **Telegram**
2. **Resource**: Message
3. **Chat ID**: `{{ $node["Function"].json.chatId }}`
4. **Text**: `{{ $node["Function"].json.text }}`
5. **Parse Mode**: Markdown

---

## Тестирование

1. **Activata** воркфлоу (кнопка вверху)
2. Отправь команду в Telegram: `/help`
3. Должен прийти ответ с командами

---

## Проверка Webhook'а

После установки webhook'а проверь:
```bash
curl -X GET "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/getWebhookInfo"
```

Должно вернуть:
```json
{
  "ok": true,
  "result": {
    "url": "http://178.104.253.76:5678/webhook/telegram-bot",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "ip_address": "...",
    "last_error_date": 0
  }
}
```

---

## Команды для тестирования

```
/help          — справка
/parse         — список ниш
/parse 1       — парсить нишу #1
/parse auto    — автопарсинг
/status        — статус системы
```

---

## Troubleshooting

**Webhook не работает:**
- Проверь, что n8n доступна по IP: `curl http://178.104.253.76:5678`
- Проверь, что воркфлоу **активирована** (зелёная кнопка)
- Проверь логи n8n: `docker logs leadgen_n8n`

**Команда не выполняется:**
- Проверь, что скрипт существует: `ls /opt/leadgen/scripts/parser/index.js`
- Проверь, что путь к скрипту правильный в Execute Command
- Смотри логи парсера в БД: `SELECT * FROM logs WHERE module='parser' ORDER BY created_at DESC LIMIT 10`

**Ответ не приходит в Telegram:**
- Проверь Chat ID: должна быть цифра, не строка
- Проверь, что бот добавлен в чат
- Проверь токен бота в n8n credentials

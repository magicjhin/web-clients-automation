# n8n Workflow Manual Setup Guide

Поскольку API не копирует структуру, создаём workflow'ы вручную. Всего 6 workflow'ов, каждый занимает 2-3 минуты.

## Workflow 1: Telegram Bot - Command Router

### Узлы:
1. **Webhook - Telegram** (trigger)
   - Type: Webhook
   - Path: `telegram-bot`
   - Method: POST

2. **Extract Message** (function)
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

3. **Switch - Command Router** (switch)
   - Mode: Expression
   - Expression: ={{"/parse": ($json.text.includes("/parse")), "/status": ($json.text.includes("/status")), "/stats": ($json.text.includes("/stats")), "/help": ($json.text.includes("/help"))}}

4. **Execute - Parse List** (execute-command-plus)
   - Command: `cd /opt/leadgen && node scripts/parser/index.js --list`

5. **Execute - Status** (execute-command-plus)
   - Command: `cd /opt/leadgen && node scripts/parser/index.js --status`

6. **Execute - Stats** (execute-command-plus)
   - Command: `cd /opt/leadgen && node scripts/parser/index.js --stats`

7. **Format - Help Message** (function)
   ```javascript
   return { json: { text: '🤖 *Leadgen Bot*\n\n*Команды:*\n📊 /parse\n📊 /parse 1\n🔄 /parse auto\n📈 /status\n📋 /stats\n❓ /help' } };
   ```

8. **Format - Response** (function)
   ```javascript
   let result = $input.first().json;
   let text = '';
   if (typeof result === 'string') { text = result; }
   else if (result.message) { text = result.message; }
   else if (result.error) { text = 'Error: ' + result.error; }
   else { text = JSON.stringify(result, null, 2); }
   return { json: { text: text, chatId: $node['Extract Message'].json.chatId } };
   ```

9. **Send - Telegram Message** (telegram)
   - Chat ID: `5900706320`
   - Text: `{{ $node['Format - Response'].json.text }}`
   - Parse Mode: Markdown

### Connections:
Webhook → Extract Message → Switch
Switch (4 branches) → [Parse List, Status, Stats, Help]
All 4 → Format Response → Send Telegram

---

## Workflow 2: Parser - Manual Trigger

1. **Manual Trigger**
2. **Execute - Parser** - Command: `cd /opt/leadgen && node scripts/parser/index.js --list`
3. **Parse JSON** - Parse stdout to JSON
4. **Send Telegram** - Chat: 5900706320

Connection: Manual → Execute → Parse → Send

---

## Workflow 3: Filter - Manual Trigger

1. **Manual Trigger**
2. **Execute - Filter** - Command: `cd /opt/leadgen && node scripts/filter/index.js --limit=100`
3. **Parse JSON** - Parse stdout
4. **Send Telegram** - Text: `✅ Filter completed\n...`

Connection: Manual → Execute → Parse → Send

---

## Workflow 4: Audit - Cron 09:00

1. **Cron** - Mode: Cron, Expression: `0 9 * * *`, Timezone: Europe/Vilnius
2. **Execute - Audit** - Command: `cd /opt/leadgen && node scripts/audit/index.js --batch=15`
3. **Parse JSON**
4. **Send Telegram** - Text: `📧 Audit completed (09:00)\n...`

Connection: Cron → Execute → Parse → Send

---

## Workflow 5: Followup - Cron 10:00

1. **Cron** - Mode: Cron, Expression: `0 10 * * *`, Timezone: Europe/Vilnius
2. **Execute - Followup** - Command: `cd /opt/leadgen && node scripts/email/followup.js`
3. **Parse JSON**
4. **Send Telegram** - Text: `📧 Followup emails sent (10:00)\n...`

Connection: Cron → Execute → Parse → Send

---

## Workflow 6: IMAP - Every 30 Min

1. **Cron** - Mode: Every, Interval: 30
2. **Execute - IMAP** - Command: `cd /opt/leadgen && node scripts/email/imap.js`
3. **Parse JSON** - Check for hasError field
4. **If Error** - Condition: hasError == true
5. **Send Error Alert** - Text: `⚠️ IMAP Error\n...`

Connection: Cron → Execute → Parse → If → Send

---

## Telegram Credentials
Bot Token: `8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A`

## Webhook URL (for Telegram Bot workflow)
After creating Workflow 1, copy webhook URL and run:
```bash
curl -X POST https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook \
  -d "url=<WEBHOOK_URL>"
```

## Activate All Workflows
Publish and toggle ON each workflow after creation.

# Workflows — n8n воркфлоу и Telegram

## Telegram команды

| Команда | Что делает | Скрипт |
|---------|-----------|--------|
| /status | Сводка воронки: кол-во по статусам | SELECT status, COUNT(*) |
| /niches | Список ниш с ai_score | SELECT name_ru, ai_score, status |
| /parse `<ниша>` | Запуск парсинга ниши | scripts/parser/index.js --niche=X |
| /filter | Запуск фильтрации raw компаний | scripts/filter/index.js |
| /run | Аудит + письмо для 15 qualified | scripts/audit/index.js --batch=15 |
| /pause | Пауза системы (флаг в БД) | UPDATE system_flags SET paused=true |
| /resume | Возобновление | UPDATE system_flags SET paused=false |
| /history | Последние 10 запусков парсинга | SELECT * FROM parse_history |
| /logs | Последние 10 ошибок | SELECT * FROM logs WHERE level='error' |
| /calls | Компании для звонков | SELECT * WHERE call_required=true |

## Telegram уведомления (автоматические)

**VIP алерт** (при обнаружении VIP компании):
```
🔥 VIP КОМПАНИЯ НАЙДЕНА
Компания: [name]
Сайт: [website]
VIP score: [score]
Причина: [reasons]
📞 Рекомендуется позвонить!
Email: [email] | Телефон: [phone]
```

**Ответ клиента** (при обнаружении через IMAP):
```
💬 ОТВЕТ ОТ КЛИЕНТА
Компания: [name]
Ответ: [reply_text]
Аудит: [краткое резюме]
[кнопка: Открыть полный аудит] [кнопка: Написать ответ]
```

**Системная ошибка** (critical level):
```
🚨 СИСТЕМНАЯ ОШИБКА
Модуль: [module]
Ошибка: [message]
Система остановлена. Требуется вмешательство.
```

---

## n8n Воркфлоу 1: Парсинг

```
Trigger: Telegram Webhook (/parse <niche>)
    ↓
Extract niche slug from message
    ↓
Execute Command: node /opt/leadgen/scripts/parser/index.js --niche={{slug}}
    ↓
Send Telegram message: "Парсинг завершён. Найдено: X компаний"
```

## n8n Воркфлоу 2: Фильтрация

```
Trigger: Webhook или Manual
    ↓
Execute Command: node /opt/leadgen/scripts/filter/index.js --limit=100
    ↓
Send Telegram message: "Фильтрация завершена. Qualified: X"
```

## n8n Воркфлоу 3: Аудит и письма

```
Trigger: Cron 09:00 ежедневно (по рабочим дням)
    ↓
Execute Command: node /opt/leadgen/scripts/audit/index.js --batch=15
    ↓
Send Telegram message: "Отправлено писем: X. VIP: Y"
```

## n8n Воркфлоу 4: Повторные письма

```
Trigger: Cron ежедневно 10:00
    ↓
Execute Command: node /opt/leadgen/scripts/email/followup.js
    ↓
Send Telegram message: "Повторных писем отправлено: X"
```

## n8n Воркфлоу 5: Telegram бот

```
Trigger: Webhook (Telegram Bot API)
    ↓
Switch по тексту команды:
    /status → Execute Command: node scripts/telegram/bot.js --cmd=status
    /niches → Execute Command: node scripts/telegram/bot.js --cmd=niches
    /parse  → Execute Command: node scripts/parser/index.js --niche={{arg}}
    /filter → Execute Command: node scripts/filter/index.js
    /run    → Execute Command: node scripts/audit/index.js --batch=15
    /pause  → Execute Command: node scripts/telegram/bot.js --cmd=pause
    /resume → Execute Command: node scripts/telegram/bot.js --cmd=resume
    /history→ Execute Command: node scripts/telegram/bot.js --cmd=history
    /logs   → Execute Command: node scripts/telegram/bot.js --cmd=logs
    /calls  → Execute Command: node scripts/telegram/bot.js --cmd=calls
    ↓
Send response to Telegram
```

## n8n Воркфлоу 6: IMAP проверка

```
Trigger: Cron каждые 30 минут
    ↓
Execute Command: node /opt/leadgen/scripts/email/imap.js
    ↓
(Telegram уведомление отправляется изнутри imap.js если найден ответ)
```

---

## IMAP логика (scripts/email/imap.js)

```
1. Подключиться к IMAP (imapflow)
2. Выбрать папку INBOX
3. Найти непрочитанные письма
4. Для каждого письма:
   a. Извлечь From адрес
   b. SELECT * FROM companies WHERE email = fromAddress AND status = 'sent'
   c. Если найдена:
      - UPDATE companies SET status='replied', replied_at=NOW(), reply_text=body, reply_count=reply_count+1
      - Отправить Telegram уведомление с текстом ответа
   d. Отметить письмо как прочитанное
5. Отключиться
```

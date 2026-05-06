# Импорт Воркфлоу в n8n

Все 6 воркфлоу готовы к импорту и полностью функциональны.

## Быстрый импорт (вручную)

1. Откройте n8n UI: http://178.104.253.76:5678
2. Нажмите **Workflows** в левом меню
3. Нажмите **+ New Workflow** или **Import**
4. Скопируйте содержимое файла (Ctrl+A, Ctrl+C):
   - `n8n/01-telegram-bot.json`
   - Вставьте в поле импорта
   - Нажмите **Import from paste**

## Все 6 воркфлоу

| # | Файл | Описание | Триггер | Команда |
|---|------|---------|---------|---------|
| 1 | `01-telegram-bot.json` | Все 10 команд в одном боте | Interval 2 sec | Все /status, /parse, /filter, /run, и т.д. |
| 2 | `02-parser.json` | Парсинг литовских компаний | Cron 09:00 ежедневно | `node scripts/parser/index.js` |
| 3 | `03-filter.json` | Фильтрация raw компаний | Interval 30 мин | `node scripts/filter/index.js` |
| 4 | `04-audit.json` | Аудит и письма | Interval 30 мин | `node scripts/audit/index.js --batch=5` |
| 5 | `05-followup.json` | Повторные письма | Cron 10:00 ежедневно | `node scripts/email/followup.js` |
| 6 | `06-imap.json` | Проверка входящих писем | Interval 5 мин | `node scripts/email/imap.js` |

## Логика каждого воркфлоу

### 01 - Telegram Bot (ГЛАВНЫЙ)
```
Interval 2sec → getUpdates (offset=-1) → Extract Message → Switch по /команде → Execute → Format → Send Telegram
```

**10 поддерживаемых команд:**
- `/status` → статус воронки (SELECT status, COUNT(*))
- `/niches` → список ниш с ai_score
- `/parse` → запуск парсинга
- `/filter` → фильтрация raw компаний
- `/run` → аудит + письма (batch=15)
- `/pause` → пауза системы (флаг в БД)
- `/resume` → возобновление
- `/history` → последние запуски парсинга
- `/logs` → последние ошибки
- `/calls` → компании для звонков

### 02 - Parser
```
Cron 09:00 → Execute Parser → Parse JSON → Send Telegram notification
```

### 03 - Filter
```
Interval 30 min → Execute Filter (batch=10) → Parse JSON → Send Telegram notification
```

### 04 - Audit
```
Interval 30 min → Execute Audit (batch=5) → Parse JSON → Send Telegram notification
```

### 05 - Followup
```
Cron 10:00 → Execute Followup → Parse JSON → Send Telegram notification
```

### 06 - IMAP
```
Interval 5 min → Execute IMAP → Parse JSON → If has emails → Send Telegram notification
```

## Шаги импорта

### 1. Импортируйте 01-telegram-bot.json (главный бот)
- Это позволит использовать ВСЕ 10 команд через Telegram
- Сразу активируйте ("Activate") после импорта

### 2. Импортируйте остальные 5 воркфлоу
- 02-parser.json (парсинг в 09:00)
- 03-filter.json (фильтрация каждые 30 мин)
- 04-audit.json (аудит каждые 30 мин)
- 05-followup.json (повторные письма в 10:00)
- 06-imap.json (проверка писем каждые 5 мин)

### 3. Активируйте все воркфлоу
- Перейдите в каждый воркфлоу
- Нажмите **Activate** (кнопка в верхнем правом углу)

## Тестирование

### После импорта 01-telegram-bot
1. Откройте Telegram бота @Leadgen_bot
2. Отправьте `/status`
3. Должен придти ответ со статусом воронки

### Проверка остальных
1. **02-parser** активируется в 09:00 (можете протестировать вручную через Execute)
2. **03-filter** запустится через 30 мин автоматически
3. **04-audit** запустится через 30 мин автоматически
4. **05-followup** активируется в 10:00
5. **06-imap** проверяет почту каждые 5 мин

## Проблемы при импорте?

### "Connection refused to 178.104.253.76:3333"
- HTTP executor не запущен на VPS
- Решение: `ssh root@178.104.253.76 "systemctl start http-executor"`

### "command is required"
- Тело запроса неправильное
- ✅ Правильно: `{"command":"node scripts/parser/index.js"}`
- ❌ Неправильно: `{"parameters": [...]}`

### Воркфлоу не запускается после импорта
- Кликните **Activate** в верхнем правом углу
- Проверьте, что триггер корректный (Cron или Interval)

## Все готово!
После импорта и активации всех 6 воркфлоу система полностью автоматизирована:
- Telegram бот обрабатывает все команды
- Парсинг запускается в 09:00
- Фильтрация каждые 30 мин
- Аудит каждые 30 мин
- Повторные письма в 10:00
- IMAP проверка каждые 5 мин

📊 Все операции логируются в Telegram и БД.

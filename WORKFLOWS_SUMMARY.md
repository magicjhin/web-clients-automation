# ✅ Все 6 n8n воркфлоу готовы к импорту

## Что было переделано

Все воркфлоу переписаны с нуля с правильной логикой:

### Ошибка → Решение
- ❌ `bodyParameters` (старый формат n8n) → ✅ JSON `body` с `contentType: application/json`
- ❌ `n8n-nodes-base.telegram` (требует credentials) → ✅ Прямые HTTP POST к Telegram API
- ❌ Единственная команда `/parse` → ✅ Все 10 команд в одном боте
- ❌ Дублирование сообщений в боте → ✅ Использование `offset=-1` в getUpdates

## Файлы

### n8n Воркфлоу (JSON для импорта)
```
n8n/01-telegram-bot.json    ← ГЛАВНЫЙ БОТ (10 команд)
n8n/02-parser.json          ← Парсинг в 09:00
n8n/03-filter.json          ← Фильтрация каждые 30 мин
n8n/04-audit.json           ← Аудит каждые 30 мин
n8n/05-followup.json        ← Повторные письма в 10:00
n8n/06-imap.json            ← Проверка писем каждые 5 мин
```

### Документация
```
docs/N8N_IMPORT.md          ← Инструкция импорта и тестирования
docs/HTTP_EXECUTOR_SETUP.md ← Как запустить HTTP executor на VPS
```

### Утилиты
```
scripts/import-workflows.js  ← Скрипт для импорта всех 6 воркфлоу (опционально)
```

## Главный бот (01-telegram-bot.json)

**Поддерживает 10 команд:**

| Команда | Что делает | Скрипт |
|---------|-----------|--------|
| `/status` | Статус воронки | `scripts/telegram/bot.js --cmd=status` |
| `/niches` | Список ниш | `scripts/telegram/bot.js --cmd=niches` |
| `/parse` | Парсинг | `scripts/parser/index.js` |
| `/filter` | Фильтрация | `scripts/filter/index.js` |
| `/run` | Аудит + письма | `scripts/audit/index.js --batch=15` |
| `/pause` | Пауза системы | `scripts/telegram/bot.js --cmd=pause` |
| `/resume` | Возобновление | `scripts/telegram/bot.js --cmd=resume` |
| `/history` | История парсинга | `scripts/telegram/bot.js --cmd=history` |
| `/logs` | Последние ошибки | `scripts/telegram/bot.js --cmd=logs` |
| `/calls` | Компании для звонков | `scripts/telegram/bot.js --cmd=calls` |

**Логика:**
```
Interval 2 сек
  ↓
Get Updates (offset=-1 ← только новые сообщения!)
  ↓
Extract Message (достаёт text, chatId, messageId)
  ↓
Switch по команде (зависит от /xxx в начале)
  ↓
10 параллельных Execute узлов (по команде)
  ↓
Format Response (преобразует результат в текст)
  ↓
Send Telegram (отправляет в чат)
```

## Остальные 5 воркфлоу (2-6)

Все следуют одному паттерну:
```
Триггер (Cron или Interval)
  ↓
Execute Command (HTTP POST к executor)
  ↓
Parse JSON (извлекает текст из результата)
  ↓
Send Telegram (уведомляет о результате)
```

## Как импортировать

**Вручную в n8n UI (рекомендуется):**
1. Откройте http://178.104.253.76:5678
2. Нажмите **Workflows** → **Import**
3. Скопируйте содержимое JSON файла
4. Нажмите **Import from paste**
5. Повторите для всех 6 файлов
6. Нажмите **Activate** на каждом воркфлоу

**Или через скрипт (требует N8N_API_KEY):**
```bash
cd /opt/leadgen
N8N_URL=http://178.104.253.76:5678 node scripts/import-workflows.js
```

## Проверка после импорта

### 1. Telegram бот (01)
```
Отправьте боту: /status
Должен вернуть: статус воронки
```

### 2. Остальные 5
- Запустятся автоматически по расписанию
- Или кликните **Execute** в n8n UI для ручного теста

## Что дальше?

- ✅ Воркфлоу готовы
- 📋 Импортировать в n8n UI
- 📋 Активировать все 6
- 📋 Тестировать через Telegram

Детали см. в `docs/N8N_IMPORT.md`

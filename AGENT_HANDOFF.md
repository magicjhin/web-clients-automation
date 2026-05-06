# Agent Handoff

## Текущий статус
День 11 из 14. Telegram n8n workflow перепроектирован с polling на webhook, чтобы убрать бесконечную отправку сообщений. Локальные файлы подготовлены, но HTTPS-домен и импорт на VPS еще не завершены.

## Что сделано в этой сессии
- Разобрана причина бесконечных Telegram-сообщений: старый workflow использовал `Interval` + `getUpdates`, что приводило к повторной обработке сообщений.
- Создан новый webhook workflow: `n8n/Telegram Bot - Command Router.json`.
- Добавлен CLI-обработчик коротких Telegram-команд: `scripts/telegram/command.js`.
- Настроен `docker-compose.yml` для будущего HTTPS n8n URL: `https://n8n.webvibe-lead.fun`.
- Обновлена быстрая инструкция: `docs/SIMPLE_IMPORT.md`.
- Переписан `.claude/commands/done.md`: теперь агент сам формирует итог сессии, обновляет `TASKS.md` и `AGENT_HANDOFF.md`, а не спрашивает пользователя.
- Переписан `TASKS.md` в читаемом UTF-8 с актуальными статусами.

## Текущая архитектура Telegram workflow
Новый workflow должен работать так:

```text
Telegram message
  -> Telegram Webhook
  -> Extract Message
  -> Route Command
  -> HTTP Executor
  -> Format Response
  -> Send Telegram
```

Polling через `Interval`, `getUpdates` и `/tmp/telegram_offset.txt` больше не нужен.

## Важные файлы
- `n8n/Telegram Bot - Command Router.json` - новый workflow для импорта в n8n.
- `scripts/telegram/command.js` - CLI для `/status`, `/niches`, `/pause`, `/resume`, `/history`, `/logs`, `/calls`, `/help`.
- `docs/SIMPLE_IMPORT.md` - короткая инструкция для домена `webvibe-lead.fun`.
- `docker-compose.yml` - n8n env переменные для HTTPS URL.
- `.claude/commands/done.md` - обновленная команда закрытия сессии.
- `TASKS.md` - актуальный прогресс.

## Проверки
Выполнено локально:

```bash
node -e "const fs=require('fs'); const wf=JSON.parse(fs.readFileSync('n8n/Telegram Bot - Command Router.json','utf8')); for (const n of wf.nodes) if (n.parameters && n.parameters.functionCode) new Function(n.parameters.functionCode); console.log('workflow ok')"
node --check scripts/telegram/command.js
docker compose config
```

Результат: workflow JSON валиден, Function-ноды компилируются, `command.js` проходит syntax check, compose config собирается.

## Последняя ошибка / блокер
Telegram webhook требует публичный HTTPS URL. У пользователя есть домен `webvibe-lead.fun`, но DNS/Caddy/SSL еще не настроены. Без HTTPS workflow webhook не сможет стабильно принимать сообщения от Telegram.

Также `scripts/filter/index.js` и `scripts/audit/index.js` пока отсутствуют, поэтому `/filter` и `/run` в новом CLI возвращают заглушки.

## Следующий конкретный шаг
1. В DNS панели домена создать запись:

```text
Type: A
Name: n8n
Value: 178.104.253.76
TTL: Auto
```

2. Проверить DNS:

```bash
nslookup n8n.webvibe-lead.fun
```

3. Залить измененные файлы на VPS:

```bash
scp docker-compose.yml root@178.104.253.76:/opt/leadgen/docker-compose.yml
scp "n8n/Telegram Bot - Command Router.json" root@178.104.253.76:/opt/leadgen/n8n/
scp scripts/telegram/command.js root@178.104.253.76:/opt/leadgen/scripts/telegram/
```

4. На VPS поставить Caddy и перезапустить проект:

```bash
ssh root@178.104.253.76
apt update
apt install -y caddy
cat >/etc/caddy/Caddyfile <<'EOF'
n8n.webvibe-lead.fun {
    reverse_proxy 127.0.0.1:5678
}
EOF
systemctl reload caddy
cd /opt/leadgen
docker compose up -d
```

5. Открыть:

```text
https://n8n.webvibe-lead.fun
```

6. В n8n удалить или деактивировать старые Telegram workflows с `Interval` / `Get Updates`.

7. Импортировать `n8n/Telegram Bot - Command Router.json`, активировать workflow и установить Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/setWebhook?url=https://n8n.webvibe-lead.fun/webhook/telegram-bot"
curl "https://api.telegram.org/bot8695961256:AAFoN0toAyHFKVWo611iVDAa8IkOrfwga3A/getWebhookInfo"
```

8. Очистить старый polling:

```bash
rm -f /tmp/telegram_offset.txt
pkill -f "scripts/telegram/bot.js" || true
```

## Осторожно
- Не возвращаться к `Interval` для Telegram команд.
- Не запускать `scripts/telegram/bot.js` параллельно с webhook workflow: это polling-бот, он может конфликтовать.
- В рабочем дереве есть удаление старого `n8n/01-telegram-bot.json`; перед commit нужно решить, включать ли это удаление или оставить вне commit.

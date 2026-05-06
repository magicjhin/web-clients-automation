# HTTP Executor Setup

HTTP Executor — простой Express сервер, который n8n использует для выполнения команд на VPS.

## Быстрый старт

### На VPS (178.104.253.76)

1. Подключись к VPS:
```bash
ssh root@178.104.253.76
```

2. Перейди в директорию проекта:
```bash
cd /opt/leadgen
```

3. Убедись, что Express установлен:
```bash
npm list express
# Если нет: npm install express
```

4. Запусти HTTP executor вручную (для теста):
```bash
node scripts/http-executor.js
# Вывод: HTTP Executor listening on port 3333
```

5. Тест в другом терминале:
```bash
curl -X POST http://localhost:3333/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"echo test"}'
```

## Запуск как systemd сервис (рекомендуется)

1. Создай файл сервиса:
```bash
sudo nano /etc/systemd/system/http-executor.service
```

2. Скопируй содержимое:
```ini
[Unit]
Description=Leadgen HTTP Executor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/leadgen
ExecStart=/usr/bin/node /opt/leadgen/scripts/http-executor.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
Environment="HTTP_EXECUTOR_PORT=3333"

[Install]
WantedBy=multi-user.target
```

3. Активируй сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable http-executor
sudo systemctl start http-executor
```

4. Проверь статус:
```bash
sudo systemctl status http-executor
```

5. Просмотр логов:
```bash
sudo journalctl -u http-executor -f
```

## Переменные окружения

- `HTTP_EXECUTOR_PORT` — порт (по умолчанию 3333)
- Другие переменные загружаются из `.env` (config.js)

## Тестирование из n8n

После запуска HTTP executor:

1. Перезагрузи все workflow'ы в n8n (http://178.104.253.76:5678)
2. Нажми "Execute" на любом workflow
3. В Telegram должны прийти результаты

## Структура запроса

```json
{
  "command": "node scripts/parser/index.js",
  "args": {
    "batch": 10,
    "niche": "IT"
  }
}
```

Сервер выполнит:
```bash
cd /opt/leadgen && node scripts/parser/index.js --batch=10 --niche=IT
```

## Troubleshooting

### "Connection refused"
- Проверь, запущен ли сервис: `sudo systemctl status http-executor`
- Проверь порт: `netstat -tlnp | grep 3333`

### "Timeout"
- Проверь, можно ли достучаться с локальной машины: `curl http://178.104.253.76:3333/health`
- Может быть firewall: `sudo ufw allow 3333/tcp`

### Логи
```bash
# Systemd
sudo journalctl -u http-executor -f

# Или логи приложения (если используется logger)
tail -f /opt/leadgen/logs/error.log
```

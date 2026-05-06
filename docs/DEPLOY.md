# Deploy — VPS, Docker, GitHub Actions

## VPS информация
- IP: 178.104.253.76
- Провайдер: Hetzner CX23
- ОС: Ubuntu
- SSH: `ssh root@178.104.253.76`
- Папка проекта на VPS: `/opt/leadgen`

---

## Первоначальная настройка VPS (один раз)

```bash
# Подключиться
ssh root@178.104.253.76

# Установить Docker
apt update && apt install -y docker.io docker-compose git

# Склонировать репо
git clone https://github.com/magicjhin/web-clients-automation.git /opt/leadgen
cd /opt/leadgen

# Загрузить .env (с локальной машины)
# Выполнить с локального компьютера:
scp .env root@178.104.253.76:/opt/leadgen/.env

# Запустить сервисы
docker-compose up -d postgres n8n

# Проверить
docker ps
```

---

## GitHub Actions — Автодеплой

Файл: `.github/workflows/deploy.yml`

При каждом push в ветку `main`:
1. GitHub Actions подключается к VPS по SSH
2. Делает `git pull origin main`
3. Перезапускает Node контейнер если нужно

**GitHub Secrets (добавить в репо → Settings → Secrets → Actions):**
| Secret | Значение |
|--------|---------|
| VPS_HOST | 178.104.253.76 |
| VPS_USER | root |
| VPS_SSH_KEY | приватный SSH ключ (содержимое ~/.ssh/id_rsa) |
| VPS_PORT | 22 |

**Как получить SSH ключ для GitHub:**
```bash
# На локальной машине (если ключа нет):
ssh-keygen -t ed25519 -C "github-actions"

# Скопировать публичный ключ на VPS:
ssh-copy-id root@178.104.253.76

# Содержимое приватного ключа добавить в GitHub Secret VPS_SSH_KEY:
cat ~/.ssh/id_ed25519
```

---

## docker-compose.yml структура

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres

  node:
    image: node:20
    working_dir: /app
    volumes:
      - ./scripts:/app/scripts
      - ./node_modules:/app/node_modules
      - /tmp/screenshots:/tmp/screenshots
    env_file:
      - .env
    command: tail -f /dev/null  # держим контейнер живым

volumes:
  postgres_data:
  n8n_data:
```

---

## Инициализация БД (один раз)

```bash
# На VPS после первого деплоя:
docker exec -i leadgen_postgres psql -U leadgen leadgen < /opt/leadgen/db/init.sql

# Проверить таблицы:
docker exec -it leadgen_postgres psql -U leadgen leadgen -c "\dt"
```

---

## Полезные команды на VPS

```bash
# Статус контейнеров
docker ps

# Логи n8n
docker logs leadgen_n8n -f

# Логи postgres
docker logs leadgen_postgres -f

# Подключиться к БД
docker exec -it leadgen_postgres psql -U leadgen leadgen

# Запустить Node скрипт вручную
docker exec -it leadgen_node node scripts/parser/index.js --niche=restoranas

# Перезапустить все сервисы
docker-compose restart

# Обновить код вручную (без GitHub Actions)
cd /opt/leadgen && git pull origin main

# Посмотреть использование ресурсов
docker stats
```

---

## .gitignore

```
.env
node_modules/
/tmp/
*.log
.DS_Store
```

---

## .env.example (шаблон, в git)

```
# База данных
POSTGRES_USER=leadgen
POSTGRES_PASSWORD=
POSTGRES_DB=leadgen
DATABASE_URL=postgresql://leadgen:PASSWORD@postgres:5432/leadgen

# Claude API
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Email исходящий (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
FROM_NAME=

# Email входящий (IMAP)
IMAP_HOST=imap.gmail.com
IMAP_USER=
IMAP_PASS=

# Внешние API
GOOGLE_MAPS_API_KEY=
PAGESPEED_API_KEY=

# Настройки системы
BATCH_SIZE=15
FOLLOWUP_DAYS=3
VIP_SCORE_THRESHOLD=80
```

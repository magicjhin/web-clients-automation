# TASKS — Прогресс разработки (14 дней)

Статусы: ✅ сделано / 🔄 в процессе / 📋 не начато / ❌ заблокировано

---

## День 1 — VPS + Git + Docker
✅ Установить Docker + Docker Compose + Git на VPS
✅ git clone репо на VPS в /opt/leadgen
✅ Загрузить .env на VPS вручную (scp)
✅ Добавить SSH ключ в GitHub Secrets
✅ Создать docker-compose.yml
✅ Создать .github/workflows/deploy.yml
✅ docker-compose up -d postgres n8n node
✅ Проверить n8n: http://178.104.253.76:5678
✅ Dockerfile с npm ci, npm установлен успешно

## День 2 — База данных
✅ Написать db/init.sql (4 таблицы: niches, companies, parse_history, logs)
✅ Выполнить init.sql на VPS
✅ Проверка: 4 таблицы созданы в leadgen_app БД

## День 3 — Общие утилиты
✅ scripts/shared/db.js — pg Pool, query helper
✅ scripts/shared/logger.js — запись в logs + console
✅ scripts/shared/config.js — загрузка .env
✅ Тест: конфиг загружается, БД доступна

## День 4 — Парсер (rekvizitai.lt)
📋 scripts/parser/scraper.js — Puppeteer, пагинация
📋 scripts/parser/normalizer.js — очистка данных
📋 scripts/parser/index.js — оркестрация + фильтры при парсинге
📋 Тест: распарсить одну небольшую нишу

## День 5 — Фильтр часть 1
📋 scripts/filter/pagespeed.js — PageSpeed API
📋 scripts/filter/screenshot.js — Puppeteer скриншот
📋 Тест: проверить оба модуля независимо

## День 6 — Фильтр часть 2
📋 scripts/filter/design.js — Claude API оценка дизайна
📋 scripts/filter/activity.js — Google Maps API
📋 scripts/filter/vip.js — расчёт VIP score
📋 scripts/filter/index.js — полный пайплайн
📋 Тест: 5 raw компаний через фильтр

## День 7 — Краулер + Аудит
📋 scripts/audit/crawler.js — Puppeteer краулинг
📋 scripts/audit/claude.js — вызов 1: аудит → JSON, вызов 2: перепроверка → финальный JSON
📋 Логика: если audit_confidence < 6 → статус pending, Telegram уведомление
📋 Тест: аудит одной qualified компании, проверить оба вызова Claude

## День 8 — Генерация писем
📋 scripts/audit/letterTemplates.js — 3 шаблона на литовском
📋 Расширить claude.js — генерация письма
📋 scripts/audit/index.js — оркестрация аудита
📋 Тест: сгенерировать письмо, проверить литовский текст

## День 9 — Email отправка
📋 scripts/email/sender.js — Nodemailer
📋 Расширить audit/index.js — отправка + обновление статуса
📋 Тест: отправить письмо себе

## День 10 — Telegram бот
📋 scripts/telegram/bot.js — все команды + VIP уведомления
📋 Тест: все команды возвращают ожидаемый ответ

## День 11 — n8n воркфлоу
📋 Воркфлоу 1: Парсинг (Telegram → Execute Command)
📋 Воркфлоу 2: Фильтрация (Schedule → Execute Command)
📋 Воркфлоу 3: Аудит и письма (Cron 09:00 → Execute Command)
📋 Воркфлоу 4: Повторные письма (Cron daily → Execute Command)
📋 Воркфлоу 5: Telegram бот (Webhook → роутинг)
📋 Воркфлоу 6: IMAP (Cron 30 мин → Execute Command)
📋 scripts/email/followup.js

## День 12 — IMAP входящие
📋 scripts/email/imap.js — imapflow + сопоставление + Telegram уведомление
📋 Тест: ответить на тестовое письмо, проверить уведомление

## День 13 — Тестирование
📋 End-to-end тест с 1 нишей (parse → filter → audit → email → reply)
📋 Тест: сайт недоступен → VIP статус
📋 Тест: несуществующий email → email_failed
📋 Тест: убить postgres → Telegram алерт
📋 Исправить найденные баги

## День 14 — Запуск
📋 Добавить 10-15 реальных ниш в БД
📋 /parse первых 2-3 ниш
📋 Фильтрация
📋 /run первый батч 15 компаний
📋 Мониторинг Telegram

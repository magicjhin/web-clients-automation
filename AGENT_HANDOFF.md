# Agent Handoff

## Текущий статус

День 11 из 14. Парсер работает, компании записываются в БД корректно. Активная проблема — IP-блокировка на странице 21+. Применено решение: задержка 30-60 сек между страницами + крон в 00:00. Тест запустится сегодня ночью автоматически.

---

## Что сделано в этой сессии

### Диагностика и исправление записи компаний
- Подтверждено: компании записываются корректно — 300 фирм из 20 страниц ниши 1 (Akmens gaminiai)
- URL-ы правильные (`https://rekvizitai.vz.lt/imone/...`), статус `raw`, `niche_id` корректный
- БД: `leadgen`, таблица `companies`, уникальный индекс по `rekvizitai_url`

### IP-блокировка
- Сайт стабильно банит VPS IP на странице 21 при задержке 2-4 сек между страницами
- Смена User-Agent не помогает — бан по IP, не по UA
- 3-минутная пауза тоже не помогла (страница 21 и 22 заблокированы после всех 3 попыток)
- **Решение (тестируется)**: задержка 30-60 сек между каждой страницей

### Изменённые файлы
- `scripts/parser/scraper.js` — задержка между страницами изменена с 2-4 сек на 30-60 сек
- `scripts/bot/cron.js` — автопарсинг перенесён с 09:00 на **00:00 по Вильнюсу**; вызов парсера напрямую через `parser.parseAuto()` (не через `execFile` с 5-мин таймаутом)
- `AGENT_HANDOFF.md` — добавлен план подключения прокси

### Коммит
`d649322` — запушен, задеплоен на VPS через GitHub Actions

---

## Состояние VPS

- Контейнеры: `leadgen_postgres` + `leadgen_node` запущены
- БД: 232 ниши, 300 компаний в нише 1 (Akmens gaminiai, стр. 1-20)
- Ниша 1 сейчас: `status='parsing'`, `last_parsed_page=21` (застряла на блокировке)
- Бот: работает, код актуальный (commit d649322)

**Перед следующим парсингом нужно сбросить нишу 1:**
```
/reset_niche 1
```

---

## Следующий конкретный шаг

**Проверить результат ночного парсинга (утром):**
```
/parse_status        <- статус текущего парсинга
```
Или в БД:
```sql
SELECT last_parsed_page, total_pages, companies_found FROM niches WHERE id = 1;
SELECT COUNT(*) FROM companies;
```

Если страница 21+ прошла без блокировки → задержка 30-60 сек работает, продолжаем парсить ниши.

Если снова заблокировало → подключаем прокси (план ниже).

---

## Прокси — план на случай если 30-60 сек задержки не помогут

Сайт rekvizitai.vz.lt банит IP VPS после ~20 страниц. Смена User-Agent не помогает — бан по IP.

**Когда подключать**: если после тестирования с задержкой 30-60 сек парсинг по-прежнему блокируется на стр. 21+.

**Что купить**: residential прокси с ротацией IP. Например Webshare или Proxies.fo (~$5-10/мес).

**Как реализовать в `scraper.js`**:

1. Добавить список прокси в `.env`: `PROXY_LIST=http://user:pass@ip1:port,http://user:pass@ip2:port`
2. В `launchBrowser()` передавать текущий прокси в args:
   ```js
   args: ['--proxy-server=http://ip:port', ...]
   ```
3. При блокировке (страница не появилась) — **не ждать 3 мин**, а сразу взять следующий прокси из списка и перезапустить браузер. Продолжать с той же страницы `pageNum` (не инкрементировать).
4. Если все прокси исчерпаны — тогда уже ждать и повторить цикл прокси.

**Ключевое**: при блокировке `continue` не нужен — нужно повторить `goto` без `continue`, чтобы страница не пропускалась.

---

## После успешного парсинга — следующий этап (День 5-6)

После накопления 500+ raw компаний реализовать фильтрацию:
- `scripts/filter/pagespeed.js` — PageSpeed Insights API
- `scripts/filter/screenshot.js` — Puppeteer скриншот
- `scripts/filter/design.js` — Claude API оценка дизайна
- `scripts/filter/index.js` — полный pipeline

---

## Архитектура бота

```
Telegram → https://n8n.webvibe-lead.fun/webhook/telegram (Caddy HTTPS → port 5678)
    → Express POST /webhook/telegram
    → telegram.handleUpdate(req.body)
    → switch(cmd) → handler
```

Команды парсинга вызывают `parser.parseNiche()` / `discoverNiches()` напрямую в процессе (не через execFile — нет таймаута).

---

## Важные файлы

| Файл | Статус |
|------|--------|
| `scripts/bot/index.js` | ✅ точка входа, порт 5678 |
| `scripts/bot/telegram.js` | ✅ все команды |
| `scripts/bot/cron.js` | ✅ автопарсинг в 00:00, прямой вызов |
| `scripts/parser/scraper.js` | ✅ задержка 30-60 сек между страницами |
| `scripts/parser/index.js` | ✅ оркестратор |
| `scripts/parser/discover-niches.js` | ✅ поиск ниш |
| `scripts/shared/db.js` | ✅ pg Pool |
| `scripts/shared/logger.js` | ✅ логгер |
| `scripts/filter/index.js` | 📋 не реализован |
| `scripts/audit/index.js` | 📋 не реализован |
| `scripts/email/sender.js` | 📋 не реализован |

---

## Важные детали

- `docker-compose restart node` — правильная команда (не `restart leadgen_node`)
- `docker-compose down && docker-compose up -d` — если контейнер завис
- logger.js — фабрика: `require('./shared/logger')('module')` возвращает `{info, warn, error}`
- `db.one()` возвращает `null` если не найдено (не бросает исключение)
- Puppeteer требует Chrome libs в Docker (уже установлены в Dockerfile)
- VPS: 178.104.253.76, папка `/opt/leadgen`
- БД: `leadgen` (не `leadgen_app` — старое имя, уже исправлено в `.env`)

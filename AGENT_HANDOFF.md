# Agent Handoff

## Текущий статус

День 11→12. Парсер работает в режиме **«ширина»**: каждая ниша собирает бесплатные ~20 страниц (~300 фирм) и аккуратно завершается на капче. Инфраструктура переведена на Docker Compose v2, Puppeteer стабилен. Следующий этап — **реализация фильтров (День 5-6)**.

⚠️ Главное открытие сессии: «IP-блокировка на стр.21+» из прошлого хендоффа — **неверный диагноз**. Это не бан, а намеренная капча-защита глубоких страниц. См. ниже и memory `rekvizitai-deep-page-block`.

---

## Что сделано в этой сессии

### Инфраструктура (закоммичено + запушено)
- **Docker Compose v1 → v2** (плагин `/usr/libexec/docker/cli-plugins/docker-compose`) — обошли баг v1 `KeyError: 'ContainerConfig'`.
- Лимиты сервиса `node`: `pids_limit=16384`, `shm_size=1gb`, ulimits — фикс падения Puppeteer `pthread_create: Resource temporarily unavailable`. Закоммичены в `docker-compose.yml`.
- `deploy.yml` → v2, только node: `docker compose up -d --no-deps node` (postgres не трогается, без `--build`).
- Коммиты `b4edc84`, `a431642` — **запушены, задеплоены**.

### Парсер (НЕ закоммичено — см. блок «Git»)
- Убран баг «потолок ~20 страниц» (старый код считал totalPages по пагинации первой страницы). Теперь идём инкрементально до конца (2 пустые страницы подряд = конец).
- Задержка между страницами возвращена к **8-15 сек** (30-60 сек был костыль от мнимого IP-бана).
- Разобрана защита глубоких страниц: стр.21+ закрыты **капчей** (`#formFirmsCaptcha`, 3-значный код-картинка). Проверено исчерпывающе — submit капчи из датацентр-IP **всегда редиректит на стр.1**, независимо от кода (ZZZ == верный код), cookie-согласия, тайминга, стелса (`navigator.webdriver`). Вывод: блок по **клиенту/IP** (Hetzner-датацентр), не по ответу капчи. Домашний LT-IP пользователя проходит.
- **Капча-решалка реализована** (на будущее, под резидентный прокси): `shared/captcha.js` (мост бот↔парсер), `shared/ocr.js` (OCR-задел, tesseract опционально), команда `/code`, `sendPhoto` в боте. Берёт картинку капчи через canvas (не fetch — fetch меняет код). Включается `PARSE_CAPTCHA_MODE=ask`.
- **Режим «ширина» по умолчанию** (`CAPTCHA_MODE=skip`): на капче ниша завершается (`stoppedReason='capped'` → статус `completed`), парсер идёт к следующей. Без зависаний.
- **Новая команда `/parse_all`**: парсит все pending-ниши подряд, пауза 60-120с между нишами, в фоне (хоть весь день). Прогресс — `/parse_status`, стоп — `/pause`. Защита от двойного запуска + cron не лезет, пока идёт parseAll.

### Изменённые/новые файлы (этой сессии, в working tree)
- `scripts/parser/scraper.js` — инкрементальный обход, классификация (companies/captcha/empty), решалка капчи, `CAPTCHA_MODE`, лимит pids уже применён в контейнере
- `scripts/parser/index.js` — `parseAll`/`getParseAllState`/`stopParseAll`, guard от параллельного парсинга, статус `paused`/`completed` по `stoppedReason`, CLI `--all`
- `scripts/bot/telegram.js` — `/parse_all`, `/code`, `sendPhoto`, прогресс parseAll в `/parse_status`
- `scripts/bot/index.js` — регистрация отправки картинки капчи в мост
- `scripts/shared/captcha.js` (новый), `scripts/shared/ocr.js` (новый)
- `scripts/parser/scraper.js.bak` — локальный бэкап, **в git не добавлять**

### Проверки
- `node -c` по всем изменённым файлам — OK (локально и в контейнере).
- CLI-тест ниши #4: старт со стр.21 → капча → `capped` → статус `completed`, без зависания. ✅
- Полный цикл капчи (детект → картинка в Telegram → `/code` → ввод в форму) технически работает, но из серверного IP бесполезен (редирект на стр.1).
- `/parse_all` экспортируется, бот стартует без ошибок.

---

## Состояние VPS

- Контейнеры: `leadgen_postgres` (Up, не трогать, том `postgres_data`), `leadgen_node` (Up, перезапущен с новым кодом).
- БД `leadgen`: ниша #4 (Apranga, drabužiai) — `completed`, 301 компания (стр.1-20). Остальные — `pending`.
- Cron в 00:00 (parseAuto, одна ниша) активен; пропускается, если идёт `/parse_all`.
- **Файлы `scripts/*` на сервере обновлены через scp** (bind-mount), бот перезапущен → ночной cron и `/parse_all` уже работают на новом коде.

---

## Git — ВАЖНО

Изменения парсера/бота **закоммичены только локально не были** — лежат в working tree (`git status` покажет M/??). На сервере те же файлы лежат как **scp-правки, в git сервера их нет** (расходятся с origin).

При следующем `git push` в main автодеплой сделает `git pull` на сервере и **упрётся в конфликт** (локальные scp-правки). Перед/после пуша свести сервер:
```bash
ssh root@178.104.253.76
cd /opt/leadgen
git stash -u            # спрятать scp-правки (они идентичны коммиту)
git reset --hard origin/main
git stash drop          # содержимое идентично, не нужно
```
(новые файлы `shared/captcha.js`, `shared/ocr.js` придут из git; `scraper.js.bak` можно удалить вручную.)

---

## Следующий конкретный шаг

**Сегодня ночью / по запросу** — собрать базу вширь:
```
/parse_all        # в Telegram — пойдёт по всем нишам, ~300 фирм с каждой
/parse_status     # прогресс
```

**Следующая сессия — фильтры (День 5-6):**
- `scripts/filter/pagespeed.js` — PageSpeed Insights API
- `scripts/filter/screenshot.js` — Puppeteer скриншот
- `scripts/filter/design.js` — Claude API оценка дизайна
- `scripts/filter/activity.js`, `vip.js`, `index.js` — полный pipeline
- Тест: прогнать raw-компании через фильтр, замерить **долю qualified** (это решит, нужен ли потом глубокий добор стр.21+ через прокси).

---

## Стратегия по данным (решено в этой сессии)

- **Сейчас:** ширина — ~20 стр/нишу × ~230 ниш = десятки тысяч raw. Бесплатно, без капчи/прокси.
- **Глубина (стр.21+):** только если после фильтра упрёмся в нехватку лидов, и только по нишам-победителям — через **резидентный LT-прокси** (датацентр-IP не годится) + готовая капча-решалка (`PARSE_CAPTCHA_MODE=ask`). Туннель через домашний IP/Pi — бесплатная альтернатива прокси, но требует включённого устройства.
- Купить выгрузку rekvizitai (xls/API) — отклонено: дорого (€198+/год за 2000 фирм).

---

## Важные детали

- Команда compose теперь **`docker compose`** (v2, без дефиса). `docker compose restart node` / `up -d --no-deps node`.
- SSH на VPS — по ключу, без пароля (см. memory `vps-ssh-access`).
- БД: `leadgen` (НЕ `leadgen_app` — это старая БД, в ней мусор; приложение по `.env` смотрит в `leadgen`).
- `db.one()` возвращает `null` если не найдено.
- logger.js — фабрика: `require('../shared/logger')('module')` → `{info, warn, error}`; пишет в таблицу `logs` + console.
- Puppeteer: `headless:'new'`, `--no-sandbox` (Docker).
- Капча rekvizitai: форма `#formFirmsCaptcha`, поле `#security_code` (3 символа), картинка `#security_code_image`, кнопка `#ok`. Картинку брать через canvas, НЕ через fetch (fetch генерит новый код).
- Memory: `rekvizitai-deep-page-block`, `vps-runtime-compose-v2`, `vps-ssh-access`.

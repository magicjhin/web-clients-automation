# RC API — Registrų centras / data.gov.lt (ПРОВЕРЕНО вживую)

Проверено 2026-06-04 прямыми запросами. Это рабочая истина, не предположения из спека.

## База
- Хост: `https://get.data.gov.lt`
- Формат: REST, JSON. Заголовок `Accept: application/json`.
- Платформа: Spinta (UDTS). Навигация по дереву: суффикс `/:ns`.
- Бесплатно, без ключа, без лимита на забор.

## Главный датасет — компании
```
GET https://get.data.gov.lt/datasets/gov/lsd/cl/ja_asmenys/JuridinisAsmuo
```
Модель: **`JuridinisAsmuo`** (внутри namespace `ja_asmenys`).

### Объёмы (проверено)
- Всего записей: **544 063**
- Действующих (`veikiantis=1`): **160 536** ← наш рабочий набор
- Неактивных/исторических: ~383 500 (НЕ качаем, см. решение в CLAUDE.md)

### Поля строки (реальный ответ)
| Поле | Тип | Назначение |
|---|---|---|
| `kodas` | string | RC-код юрлица (уникальный идентификатор компании) |
| `pavadinimas` | string | название компании |
| `veikiantis` | int | **1 = действующая**, null/0 = нет ← фильтр активности |
| `evrk_2_1` | ref `{_id}` | ссылка на классификатор EVRK2.1 (UUID, НЕ код) |
| `evrk_2_1_pavadinimas` | string | название ниши на литовском |
| `evrk_2_1_data` | date | дата присвоения EVRK |
| `veiklos_pavadinimas` | string | название деятельности (текст) |
| `sektorius` | ref `{_id}` | институциональный сектор |
| `nuosavybes_forma` | int | код формы собственности |
| `nuosavybes_forma_pavadinimas` | string | форма собственности (текст) |
| `iregistruotas` | date | дата регистрации |
| `isregistruotas` | date/null | дата исключения (null = ещё в реестре) |
| `_id`, `_revision` | uuid | служебные Spinta-поля |

> ⚠️ В строке компании EVRK приходит как **название** (`evrk_2_1_pavadinimas`) и UUID-ссылка,
> но НЕ как чистый код «41». Чистый код берём из классификатора (ниже) по UUID-карте.

## Классификатор ниш EVRK2.1
```
GET https://get.data.gov.lt/datasets/gov/lsd/cl/evrk2_1/EkonominesVeiklosRusis
```
- Всего: **1771** код (включает все уровни иерархии: раздел/группа/класс).
- Поля: `_id` (uuid), `kodas` ("01", "41", "43.2"...), `pavadinimas_lt`, `pavadinimas_en`, `pastabos_lt`.

### Как получить чистый код EVRK у компании
1. Один раз скачать весь классификатор (1771 строка).
2. Построить карту `evrk_2_1._id (UUID) → kodas`.
3. При сохранении компании подставить код в колонку `evrk2_code`.

## Синтаксис запросов (Spinta)
- Лимит: `?limit(2)`
- Count: `?count()` → `{"_data":[{"count()": N}]}`
- Фильтр: `?veikiantis=1` (работает ✅)
- Комбинация: `?count()&veikiantis=1` (работает ✅)
- Пагинация: ответ содержит `"_page":{"next":"<cursor>"}` — курсорная, для полного забора листаем по курсору.

### ⚠️ Что НЕ работает / медленно (проверено)
- `evrk_2_1_pavadinimas.contains('Statyb')` на 544k — **висит/таймаут**. Не использовать.
- Фильтр `kodas=...` на федеративном классификаторе вернул пусто (ограничение модели).
- **Вывод:** фильтрацию по нише делаем НЕ на API, а в нашем Postgres по индексу
  `WHERE evrk2_code LIKE '41%' AND veikiantis=1`. На API — только забор активных + забор классификатора.

## Стратегия забора (rc-sync)
1. Скачать классификатор `evrk2_1` (1771 строка) → карта UUID→kodas.
2. Листать `JuridinisAsmuo?veikiantis=1` по курсору `_page.next`, порциями `limit(N)`.
3. На каждой строке: подставить `evrk2_code` из карты, upsert в `companies` по `kodas`.
4. Cron: раз в неделю/месяц (список действующих обновляется RC раз в год — срез на 1 января, лаг до года).

## Сопутствующие датасеты (на будущее)
- `gov/rc/jar/...` — реестр юрлиц: `balanso_ataskaitos` (балансы), `buveines` (адреса). Финансы = атрибут.
- Финданные устаревают на 1–2 года — годятся как атрибут, не для оценки «сейчас».

## Обогащение — ПЕРЕСМОТРЕНО 2026-06-04 (проверено на живых данных)

> Google Places оказался слаб для LT B2B (76% `not_in_places`). Основной источник обогащения теперь — **rekvizitai.vz.lt по коду компании**. Полный контекст — `AGENT_HANDOFF.md`.

### rekvizitai.vz.lt — основной источник (ПАРСИНГ карточек, бан НЕ ловится с VPS)
1. **Поиск по коду** (надёжно, ~100%):
   ```
   GET https://rekvizitai.vz.lt/imones/1/?scrollTo=searchForm&name=&company_code=<rc_code>
       &search_word=&industry=&search_terms=&location=&catUrlKey=&resetFilter=0&order=1&redirected=1
   ```
   В ответе: `Rasta įmonių: <strong>N</strong>` + первая ссылка `/imone/<slug>/` в результатах.
2. **Карточка**: `GET https://rekvizitai.vz.lt/imone/<slug>/` — оттуда за один проход:
   - **Сайт**: `svetainė <url>` (поле «Tinklalapis»). НЕТ поля → нет сайта (ветка B).
   - **Телефон/мобильный**: числа `+370…` (в textarea-блоке `Tel.: +370…`).
   - **Кредит-риск**: `prescore-risk` → `<span class="<цвет>">Žemiausia|Žema|Vidutinė|Aukšta|Aukščiausia</span>`
     → грейд A/B/C/D/E. **Главный фильтр мусора (A/B/C keep, D/E drop).**
   - **Адрес+город**: плейн-текст `Adresas: <улица>, <индекс> <Город>` (в textarea-блоке).
   - El. paštas — НЕТ (email тут не показывают).
- ⚠️ Бан только на СПИСКАХ-пагинации (стр. 21+). Карточки `/imone/` с датацентрового IP открыты (0 блоков на 12k+).
- Rate-limit + детектор блока (429/403/503) обязательны. Эталонный скрипт-прогон: `/tmp/enrich_full.py` на VPS.

### Финансы — API реестра (бесплатно, traversal по коду, ПРОВЕРЕНО)
```
GET https://get.data.gov.lt/datasets/gov/rc/jar/pelno_ataskaitos/PelnoAtaskaita?juridinis_asmuo.ja_kodas=<rc_code>&limit(400)
```
Построчная отчётность. Берём последний год (`laikotarpis_iki`): `line_name='PARDAVIMO PAJAMOS'` → выручка (`reiksme`);
строка с `GRYNAS…PELN/NUOSTOL` → прибыль. Покрытие ~66–87%.

### Контакты — где что есть (проверено)
| | Сайт | Телефон | Email | Кредит-риск | Финансы |
|---|---|---|---|---|---|
| Реестр data.gov.lt | ❌ | ❌ | ❌ | ❌ | ✅ (API) |
| rekvizitai карточка | ✅ | ✅ | ❌ | ✅ | (есть отдельно по API) |
| Сайт компании | — | — | ✅ ~85% (ветка A) | — | — |
> Email: только с сайта компании (ветка A). No-site компании = телефонные лиды. scoris=Cloudflare-блок; visalietuva=cf-обфускация.

### Вторичное / на будущее
- **Google Places API** — устарел как основной, годится для ниш с витриной (магазины/агентства). Ключ `GOOGLE_MAPS_API_KEY` (работает с локалки).
- **PageSpeed Insights API** — скорость для аудита (ветка A). Ключ `PAGESPEED_API_KEY` ограничен по IP (работает только с VPS).

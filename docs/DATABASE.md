# Схема БД — Leadgen LT (PostgreSQL + Prisma)

Мультитенант заложен с фазы 1: `subscriber_id` присутствует с самого начала, на фазе 1 — один subscriber.
ORM — Prisma (миграции). Источник истины по реализации — техспек §4.

## Данные компаний (общие, не привязаны к подписчику)

### `companies` — сырьё из RC (только действующие)
```
id              uuid pk
rc_code         varchar unique        -- kodas (RC-код)
name            varchar               -- pavadinimas
evrk2_code      varchar               -- чистый код EVRK ("41", "43.2"), из карты UUID→kodas
evrk2_name      varchar               -- evrk_2_1_pavadinimas
status          enum(active,inactive,unknown)  -- veikiantis; качаем только active
sector          varchar
legal_form      varchar               -- nuosavybes_forma_pavadinimas
address         varchar
city            varchar
reg_date        date                  -- iregistruotas
financials      jsonb                 -- баланс/прибыль (атрибут, не фильтр)
rc_synced_at    timestamp
created_at      timestamp
```
Индексы: `evrk2_code`, `status`, составной `(evrk2_code, status)`.

### `enrichment` — результаты обогащения (1:1 к company)
```
id                  uuid pk
company_id          uuid fk → companies
enrich_status       enum(pending, places_done, fallback_done, skipped_limit)

website_status      enum(not_checked, candidate_found, verified_own_website,
                         no_own_website, external_profile_only, ambiguous, wrong_match)
                    default not_checked
website_url         varchar null
phone               varchar null
google_rating       numeric null
pagespeed_mobile    int null
pagespeed_desktop   int null
audit_issues        jsonb null
lead_branch         enum(A_bad_site, B_no_site, not_lead) null
enriched_at         timestamp null
recheck_at          timestamp null

-- контроль матчинга Places:
places_query_count          int default 0
places_second_query_used    boolean default false
places_match_confidence     enum(high, medium, low) null
places_match_score          int null
places_match_reason         jsonb null
verification_method         enum(rc_code_on_site, phone_match, address_match,
                                 strong_name_city_match, manual_review, none) null
review_status               enum(auto_approved, needs_review, manually_approved, rejected)
                            default needs_review
```

**Правила выдачи:** high→auto_approved; medium/ambiguous→needs_review; low/wrong_match→не выдавать.

### `places_usage` — учёт лимита Places (биллинг Google = календарный месяц)
```
id            uuid pk
period        varchar          -- 'YYYY-MM'
used          int default 0
limit_max     int default 5000
updated_at    timestamp
```
Перед каждым Places-запросом: проверка `used < limit_max`. Достигли → `skipped_limit`, стоп. Сброс на новый период.

### `lead_state` — динамика (три ведра)
```
company_id    uuid fk
bucket        enum(active_lead, recheck_later, dead)
last_change   timestamp
```

## Мультитенант (закладывается в фазе 1, активируется в фазе 2)

### `subscribers`
```
id, email, name, company, tier, resend_api_key, resend_domain_verified,
profile (jsonb)         -- имя/компания/услуги/тон/портфолио (для генерации писем)
price_policy (jsonb)    -- вилка цен (язык письма/аудита под прайс)
selected_niches (jsonb) -- выбранные EVRK
legal_form              -- физлицо/ИП/UAB/самозанятый (форма реквизитов при регистрации)
status, trial_ends_at, created_at
```

### `lead_delivery` — выдача лидов подписчику + дедупликация
```
id, subscriber_id, company_id, delivered_at,
blocked_until           -- дедупликация 1–2 дня после выдачи
lead_outcome   enum(sent, in_progress, won, no_response, lost)  -- исход (из CRM, фаза 1 личная)
won_at         timestamp null
deal_value     numeric null    -- сумма сделки (статистика €)
lost_reason    varchar null
```

### `generated_content` — аудит/письмо
```
id, subscriber_id, company_id, audit_text, email_text,
status enum(draft, confirmed, sent), generated_at, sent_at
```

### `subscriptions` — биллинг (активен в фазе 2)
```
id, subscriber_id, tier, status, current_period_end, ...
```

## Изоляция данных
Все таблицы лидов/контента несут `subscriber_id`. Запросы всегда фильтруют по нему.
На фазе 1 — один subscriber (я); схему не переделывать при переходе на фазу 2.

## Дедупликация
Блокировка лида на 1–2 дня после выдачи (`blocked_until`). При разных нишах у подписчиков
пересечений почти нет (235 ниш). Блокировка нужна только внутри одной ниши при 2+ подписчиках.
Отказники (lost/no_response) → длинная пауза (месяцы) через `recheck_at`.

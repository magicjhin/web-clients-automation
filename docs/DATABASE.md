# Database — Схема базы данных

## Подключение
- Host: postgres (внутри Docker сети) / 178.104.253.76:5432 (снаружи)
- DB: leadgen
- User: leadgen (из .env)
- Connection string: `DATABASE_URL` из .env

---

## Таблица: niches

| Колонка | Тип | Описание |
|---------|-----|---------|
| id | SERIAL PK | |
| name_lt | VARCHAR(255) | Название ниши на литовском |
| name_ru | VARCHAR(255) | Название на русском |
| url_slug | VARCHAR(255) | Slug для rekvizitai.lt |
| total_companies | INT | Всего компаний в нише |
| ai_score | INT | Оценка перспективности 1-10 (Claude) |
| ai_reasoning | TEXT | Объяснение оценки |
| status | VARCHAR(50) | pending / parsed / exhausted |
| parsed_at | TIMESTAMP | Последний парсинг |
| companies_found | INT | Найдено компаний в последнем парсинге |
| companies_qualified | INT | Квалифицировано компаний |

---

## Таблица: companies

| Колонка | Тип | Описание |
|---------|-----|---------|
| id | SERIAL PK | |
| name | VARCHAR(255) | Название компании |
| website | VARCHAR(512) | URL сайта |
| email | VARCHAR(255) | Email компании |
| phone | VARCHAR(50) | Телефон |
| niche_id | INT FK | → niches.id |
| company_status | VARCHAR(50) | active / liquidating / bankrupt |
| has_tax_debt | BOOLEAN | Есть налоговые долги |
| reports_submitted | BOOLEAN | Сдаёт отчётность |
| registered_years | INT | Сколько лет работает |
| is_active | BOOLEAN | Активен по Google Maps |
| google_maps_rating | DECIMAL(2,1) | Рейтинг Google Maps |
| google_maps_reviews | INT | Кол-во отзывов |
| last_site_update | DATE | Последнее обновление сайта |
| status | VARCHAR(50) | Статус в воронке (см. ниже) |
| vip_score | INT | VIP score 0-100+ |
| is_vip | BOOLEAN | VIP score > 80 |
| pagespeed_score | INT | PageSpeed Insights score |
| design_score | INT | Оценка дизайна Claude 1-10 |
| processing_step | VARCHAR(50) | Текущий шаг обработки |
| processing_error | TEXT | Последняя ошибка |
| retry_count | INT | Кол-во попыток |
| audit | JSONB | JSON аудита от Claude |
| audit_confidence | INT | Уверенность Claude 1-10 |
| letter_first | TEXT | Текст первого письма |
| letter_second | TEXT | Текст повторного письма |
| first_email_sent_at | TIMESTAMP | Когда отправлено первое письмо |
| second_email_sent_at | TIMESTAMP | Когда отправлено второе письмо |
| call_required | BOOLEAN | Нужен звонок |
| called_at | TIMESTAMP | Когда позвонили |
| call_result | TEXT | Результат звонка |
| replied_at | TIMESTAMP | Когда ответил клиент |
| reply_text | TEXT | Текст ответа клиента |
| reply_count | INT | Кол-во ответов |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

### Статусы компании (поле status)

```
raw         — только что спарсена, не обработана
no_website  — нет сайта → письмо тип 2
site_down   — сайт не работает → VIP → письмо тип 3
rejected    — не прошла фильтрацию (pagespeed/дизайн/активность)
qualified   — прошла все фильтры, готова к аудиту
pending     — аудит в процессе
sent        — письмо отправлено
replied     — клиент ответил
ignored     — не ответил после двух писем
email_failed — email не доставлен
```

---

## Таблица: parse_history

| Колонка | Тип | Описание |
|---------|-----|---------|
| id | SERIAL PK | |
| niche_id | INT FK | → niches.id |
| started_at | TIMESTAMP | Начало парсинга |
| finished_at | TIMESTAMP | Конец парсинга |
| companies_found | INT | Всего найдено |
| companies_new | INT | Новых (не было в БД) |
| companies_skipped | INT | Пропущено (уже есть) |
| status | VARCHAR(50) | running / done / failed |
| error | TEXT | Текст ошибки если failed |

---

## Таблица: logs

| Колонка | Тип | Описание |
|---------|-----|---------|
| id | SERIAL PK | |
| level | VARCHAR(20) | info / warning / error / critical |
| module | VARCHAR(50) | parser / filter / audit / email / telegram |
| message | TEXT | Текст лога |
| stack_trace | TEXT | Stack trace если ошибка |
| company_id | INT | Связанная компания (опционально) |
| niche_id | INT | Связанная ниша (опционально) |
| created_at | TIMESTAMP | |

---

## Полезные запросы

```sql
-- Сводка по статусам
SELECT status, COUNT(*) FROM companies GROUP BY status;

-- VIP компании для звонков
SELECT name, website, email, vip_score FROM companies
WHERE is_vip = true AND call_required = true
ORDER BY vip_score DESC;

-- Компании для повторного письма
SELECT id, name, email FROM companies
WHERE status = 'sent'
AND first_email_sent_at < NOW() - INTERVAL '3 days'
AND second_email_sent_at IS NULL;

-- Последние ошибки
SELECT module, message, created_at FROM logs
WHERE level IN ('error', 'critical')
ORDER BY created_at DESC LIMIT 20;
```

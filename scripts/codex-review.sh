#!/usr/bin/env bash
# Codex review gate — прогоняет реализованный модуль через OpenAI Codex (codex CLI).
# Запускается ПОСЛЕ реализации каждого модуля по спеке. Находки blocker/major чинятся до «готово».
#
# Использование:
#   scripts/codex-review.sh "<модуль / на что смотреть>"          # ревью незакоммиченных изменений
#   scripts/codex-review.sh "<модуль>" --base main                # ревью против main
#   scripts/codex-review.sh "<модуль>" --commit <sha>             # ревью конкретного коммита
set -euo pipefail

FOCUS="${1:?Укажи модуль/фокус ревью первым аргументом}"

read -r -d '' INSTRUCTIONS <<EOF || true
Ты ревьюишь код проекта Leadgen LT — система B2B-лидогенерации для Литвы (Next.js + Node воркеры + Postgres).
ОБЛАСТЬ РЕВЬЮ: текущие НЕзакоммиченные изменения рабочего дерева (новые и изменённые файлы; node_modules игнорируй).
ФОКУС РЕВЬЮ: ${FOCUS}

Проверь СТРОГО по спеке и правилам проекта (контекст: CLAUDE.md, docs/ARCHITECTURE.md, docs/DATABASE.md, docs/API_RC.md, leadgen-techspec.md):

БЕЗОПАСНОСТЬ (критично — был инцидент BSI с открытым Postgres):
- Порт Postgres НЕ публикуется наружу; в docker-compose у БД нет 'ports' (или только 127.0.0.1).
- Секреты только из env (src/lib/config), нигде не захардкожены, не логируются, не попадают в git.

СООТВЕТСТВИЕ СПЕКЕ:
- RC API: качаем только veikiantis=1; фильтр по нише — в Postgres по индексу evrk2_code, НЕ на API.
- Google Places: РОВНО 1 Text Search запрос на компанию; перед запросом проверка places_usage.used < 5000;
  жёсткий стоп на лимите; НЕТ доп. запросов как fallback; FieldMask присутствует.
- Выдача по уверенности: high→auto_approved, medium/ambiguous→needs_review, low/wrong_match→не выдавать.
- Письма: отправка ТОЛЬКО после статуса confirmed (подтверждение человеком, GDPR). Нет авто-рассылки.
- Мультитенант: каждый запрос лидов/контента фильтруется по subscriber_id.
- Финансы — атрибут, не фильтр.

КАЧЕСТВО КОДА:
- Корректность, обработка ошибок, идемпотентность (upsert по rc_code/company_id), отсутствие явных багов.
- TypeScript строгий; БД через Prisma; логи через общий logger; CLI-аргументы у воркеров (--niche/--limit/--batch).

Выдай находки списком с уровнем (BLOCKER / MAJOR / MINOR) и конкретным предложением фикса.
Если всё чисто по пункту — так и скажи коротко.
EOF

echo ">> codex review — focus: ${FOCUS}"
codex review "$INSTRUCTIONS"

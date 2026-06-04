/**
 * Модуль: email-gen
 * Что делает: генерирует персонализированные письма на литовском языке.
 *   - Берёт записи из generated_content с audit_text и status=draft
 *   - Использует subscriber.profile (имя, услуги, тон, портфолио) + audit
 *   - Генерирует email_text (тема + тело на литовском)
 *   - Письмо НЕ отправляется автоматически — нужно подтверждение (GDPR)
 *   - Обновляет generated_content.status = confirmed (после апрува через UI)
 * Как запустить:
 *   npx tsx workers/email-gen/index.ts --limit=20 --batch=5
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts (OPENAI/ANTHROPIC keys)
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'email-gen', ...args });
  log.info('email-gen stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'email-gen fatal error');
  process.exit(1);
});

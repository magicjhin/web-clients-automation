/**
 * Модуль: audit-gen
 * Что делает: генерирует аудит сайта через LLM (GPT-4o / Claude).
 *   - Берёт лиды из lead_delivery с отсутствующим audit_text
 *   - Краулит сайт компании (title, description, speed, контент)
 *   - Генерирует персонализированный аудит для subscriber (из subscribers.profile)
 *   - Пишет в generated_content.audit_text, status=draft
 *   - Prompt caching для системного промпта (снижает стоимость)
 * Как запустить:
 *   npx tsx workers/audit-gen/index.ts --limit=20 --batch=5
 *
 * Зависит от: src/lib/db.ts, src/lib/logger.ts, src/lib/config.ts (OPENAI/ANTHROPIC keys)
 * Реализация: агент backend-pipeline
 */

import { logger } from '../../src/lib/logger';
import { parseArgs } from '../_runner';

async function main() {
  const args = parseArgs();
  const log = logger.child({ module: 'audit-gen', ...args });
  log.info('audit-gen stub — awaiting backend-pipeline implementation');
}

main().catch((err) => {
  logger.error(err, 'audit-gen fatal error');
  process.exit(1);
});

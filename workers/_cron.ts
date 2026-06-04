/**
 * _cron.ts — точка входа сервиса `workers` (node-cron).
 *
 * Что делает: по расписанию запускает воркеры, спавня их как отдельные процессы
 * (`tsx workers/<name>/index.ts`). Так каждый воркер остаётся самостоятельным CLI
 * (можно гонять вручную с --niche/--limit), а cron лишь дёргает их по времени.
 *
 * Как запустить:
 *   npx tsx workers/_cron.ts        # локально
 *   docker compose up -d workers    # в проде (сервис workers)
 *
 * Расписание — заготовка; backend-pipeline уточняет cron-выражения и аргументы по мере реализации воркеров.
 */

import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { logger } from '../src/lib/logger';

const log = logger.child({ module: 'cron' });

interface Job {
  name: string; // имя папки воркера в workers/
  cron: string; // cron-выражение
  args?: string[]; // CLI-аргументы воркера
}

// Расписание воркеров. Триггерные (audit-gen/email-gen/enrich-fallback) запускаются пайплайном, не по cron.
const SCHEDULE: Job[] = [
  { name: 'rc-sync', cron: '0 3 * * 1' }, // еженедельно, Пн 03:00 (срез RC обновляется редко)
  { name: 'enrich', cron: '0 2 * * *' }, // ежедневно 02:00 (порциями под лимит Places 5000/мес)
  { name: 'lead-select', cron: '0 6 * * *' }, // ежедневно 06:00 (дневная выдача лидов)
  { name: 'recheck', cron: '0 4 * * *' }, // ежедневно 04:00 (динамика базы)
];

function runWorker(job: Job): void {
  const wlog = log.child({ worker: job.name });
  wlog.info({ args: job.args ?? [] }, 'spawning worker');

  const child = spawn('npx', ['tsx', `workers/${job.name}/index.ts`, ...(job.args ?? [])], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code === 0) wlog.info('worker finished ok');
    else wlog.error({ code }, 'worker exited with error');
  });
  child.on('error', (err) => wlog.error(err, 'failed to spawn worker'));
}

for (const job of SCHEDULE) {
  if (!cron.validate(job.cron)) {
    log.error({ job }, 'invalid cron expression — skipped');
    continue;
  }
  cron.schedule(job.cron, () => runWorker(job));
  log.info({ worker: job.name, cron: job.cron }, 'scheduled');
}

log.info({ jobs: SCHEDULE.length }, 'cron service started');

process.on('SIGTERM', () => {
  log.info('SIGTERM received — shutting down cron');
  process.exit(0);
});

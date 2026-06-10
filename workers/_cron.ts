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

// Расписание воркеров. Триггерные (email-gen/enrich-fallback) запускаются пайплайном, не по cron.
// lead-select/recheck — фаза 2 / позже, добавим в расписание, когда будут готовы.
const SCHEDULE: Job[] = [
  { name: 'rc-sync', cron: '0 3 * * 1' }, // еженедельно, Пн 03:00 (срез RC обновляется редко)
  // Самообогащение: каждые 5 минут по 800 компаний, 10 потоков. Anti-overlap пропускает запуск,
  // если предыдущий ещё идёт → почти непрерывная работа без наложения потоков.
  { name: 'enrich', cron: '*/5 * * * *', args: ['--limit=800', '--batch=10'] },
  // Дренаж очереди аудита: каждые 3 минуты, по 10 записей.
  // Обрабатывает ТОЛЬКО то, что оператор поставил в queued кнопкой в дашборде — не автоматизирует аудит.
  // Anti-overlap: если предыдущий прогон ещё идёт (PageSpeed может быть медленным) — пропускаем.
  { name: 'audit-gen', cron: '*/3 * * * *', args: ['--limit=10'] },
];

// Воркеры, которые сейчас выполняются. Защита от наложения: если прошлый прогон
// ещё идёт (enrich на медленных компаниях может выйти за интервал cron), новый НЕ стартуем —
// иначе удвоится параллелизм и можно словить бан rekvizitai.
const running = new Set<string>();

function runWorker(job: Job): void {
  const wlog = log.child({ worker: job.name });
  if (running.has(job.name)) {
    wlog.warn('предыдущий прогон ещё идёт — пропускаю этот запуск (anti-overlap)');
    return;
  }
  running.add(job.name);
  wlog.info({ args: job.args ?? [] }, 'spawning worker');

  const child = spawn('npx', ['tsx', `workers/${job.name}/index.ts`, ...(job.args ?? [])], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    running.delete(job.name);
    if (code === 0) wlog.info('worker finished ok');
    else wlog.error({ code }, 'worker exited with error');
  });
  child.on('error', (err) => {
    running.delete(job.name);
    wlog.error(err, 'failed to spawn worker');
  });
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

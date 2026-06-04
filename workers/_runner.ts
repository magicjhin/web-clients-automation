/**
 * _runner.ts — общий CLI-парсер для всех воркеров
 *
 * Парсит аргументы командной строки и возвращает типизированные опции.
 * Каждый воркер импортирует parseArgs() и использует нужные поля.
 *
 * Поддерживаемые флаги:
 *   --niche=<evrk_code>   EVRK-код ниши (например, 41, 43.2)
 *   --limit=<n>           Максимум записей за запуск (default: 100)
 *   --batch=<n>           Размер пачки (default: 50)
 *   --dry-run             Не писать в БД, только логировать
 *
 * Пример:
 *   npx tsx workers/rc-sync/index.ts --niche=41 --limit=500 --batch=100
 */

export interface RunnerArgs {
  niche: string | null;
  limit: number;
  batch: number;
  dryRun: boolean;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): RunnerArgs {
  const args: RunnerArgs = {
    niche: null,
    limit: 100,
    batch: 50,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--niche=')) {
      args.niche = arg.split('=')[1] ?? null;
    } else if (arg.startsWith('--limit=')) {
      const v = parseInt(arg.split('=')[1] ?? '', 10);
      if (!isNaN(v) && v > 0) args.limit = v;
    } else if (arg.startsWith('--batch=')) {
      const v = parseInt(arg.split('=')[1] ?? '', 10);
      if (!isNaN(v) && v > 0) args.batch = v;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

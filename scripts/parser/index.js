// МОДУЛЬ: parser/index.js
// ЧТО: Оркестратор парсинга — выбор ниши и запуск scraper.js
// КАК ЗАПУСТИТЬ:
//   node scripts/parser/index.js --list          # показать топ 5 ниш
//   node scripts/parser/index.js --niche=1       # парсить нишу #1
//   node scripts/parser/index.js --auto          # автоматический выбор если < 100 qualified
//   (или через Telegram /parse, /parse 1, /parse auto)

const db = require('../shared/db');
const log = require('../shared/logger')('parser');
const scraper = require('./scraper');

async function getTopNiches(limit = 5) {
  const query = `
    SELECT id, ai_rank, name, search_term, companies_found, companies_qualified, status
    FROM niches
    WHERE status = 'pending'
    ORDER BY ai_rank ASC
    LIMIT $1
  `;
  return db.many(query, [limit]);
}

async function getNicheById(id) {
  const query = `
    SELECT id, name, search_term, companies_found, status
    FROM niches
    WHERE id = $1
  `;
  return db.one(query, [id]);
}

async function getNicheByName(name) {
  const query = `
    SELECT id, name, search_term, companies_found, status
    FROM niches
    WHERE LOWER(name) LIKE LOWER($1)
    ORDER BY ai_rank ASC
    LIMIT 1
  `;
  return db.one(query, [`%${name}%`]);
}

async function countQualifiedInQueue() {
  const result = await db.one(
    `SELECT COUNT(*) as count FROM companies WHERE status = 'qualified'`,
    []
  );
  return parseInt(result.count) || 0;
}

async function updateNicheStatus(nicheId, status) {
  const query = `
    UPDATE niches SET status = $1, updated_at = NOW() WHERE id = $2
  `;
  return db.query(query, [status, nicheId]);
}

async function listNiches() {
  const niches = await getTopNiches(5);

  if (niches.length === 0) {
    return { error: 'Нет доступных ниш для парсинга. Все ниши уже распарсены.' };
  }

  let message = '📊 *Топ 5 ниш для парсинга:*\n\n';
  niches.forEach((niche) => {
    const emoji = ['⭐', '✨', '🌟', '💫', '🔥'][niche.ai_rank - 1] || '📌';
    message += `[${niche.id}] ${emoji} *${niche.name}*\n`;
    message += `    ${niche.search_term}\n`;
    message += `    Найдено: ${niche.companies_found} | Qualified: ${niche.companies_qualified}\n\n`;
  });

  message += '_Выбери нишу: /parse 1, /parse 2, ..._\n';
  message += '_Или автопарсинг: /parse auto_';

  return { message, niches };
}

async function parseNiche(nicheId) {
  try {
    const niche = await getNicheById(nicheId);

    if (!niche) {
      return { error: `Ниша #${nicheId} не найдена` };
    }

    if (niche.status === 'parsing') {
      return { error: `Ниша "${niche.name}" уже парсится` };
    }

    if (scraper.getParseState().active) {
      return { error: 'Парсинг уже выполняется — дождись завершения (/parse_status)' };
    }

    // Обновляю статус на 'parsing'
    await updateNicheStatus(nicheId, 'parsing');
    await log.info(`Запуск парсинга нише: ${niche.name} (search_term: ${niche.search_term})`);

    // Запускаю scraper
    const result = await scraper.scrapeNiche(niche.search_term, nicheId, niche.name);

    // Если остановились на капче — ниша 'paused' (можно продолжить /parse),
    // иначе 'completed'
    const finalStatus = result.stoppedReason === 'captcha' ? 'paused' : 'completed';
    await updateNicheStatus(nicheId, finalStatus);
    await log.info(`Парсинг нише ${niche.name}: статус ${finalStatus}. Найдено: ${result.companiesFound}`);

    return {
      success: true,
      niche: niche.name,
      companiesFound: result.companiesFound,
      companiesNew: result.companiesNew,
      stoppedReason: result.stoppedReason || null
    };
  } catch (error) {
    await log.error(`Ошибка при парсинге нише #${nicheId}: ${error.message}`);
    await updateNicheStatus(nicheId, 'pending'); // вернуть статус на pending при ошибке
    return { error: error.message };
  }
}

// Состояние массового парсинга всех ниш
const parseAllState = {
  active: false,
  total: 0,
  done: 0,
  currentId: null,
  currentName: null,
  startedAt: null,
  companiesNew: 0,
  companiesFound: 0,
};

function getParseAllState() {
  return { ...parseAllState };
}

function stopParseAll() {
  if (!parseAllState.active) return false;
  parseAllState.active = false; // цикл прервётся после текущей ниши
  return true;
}

// Парсинг ВСЕХ pending-ниш подряд (в фоне). Пауза 1-2 мин между нишами.
// onDone(summary) вызывается по завершении (например, уведомить в Telegram).
async function parseAll(onDone) {
  if (parseAllState.active) {
    return { error: 'Парсинг всех ниш уже запущен. Прогресс: /parse_status' };
  }
  if (scraper.getParseState().active) {
    return { error: 'Сейчас идёт парсинг ниши — дождись завершения.' };
  }

  const niches = await db.many(
    `SELECT id, name FROM niches WHERE status = 'pending' ORDER BY ai_rank ASC NULLS LAST, id ASC`,
    []
  );
  if (niches.length === 0) {
    return { error: 'Нет ниш со статусом pending для парсинга' };
  }

  parseAllState.active = true;
  parseAllState.total = niches.length;
  parseAllState.done = 0;
  parseAllState.currentId = null;
  parseAllState.currentName = null;
  parseAllState.startedAt = new Date();
  parseAllState.companiesNew = 0;
  parseAllState.companiesFound = 0;

  // Фоновый цикл — не await, чтобы вызвавший (webhook) ответил сразу
  (async () => {
    await log.info(`parseAll: старт, ниш в очереди: ${niches.length}`);
    for (const n of niches) {
      if (!parseAllState.active || global.systemPaused) {
        await log.info('parseAll: остановлено (pause/stop)');
        break;
      }
      parseAllState.currentId = n.id;
      parseAllState.currentName = n.name;
      try {
        const res = await parseNiche(n.id);
        if (res && res.companiesNew) parseAllState.companiesNew += res.companiesNew;
        if (res && res.companiesFound) parseAllState.companiesFound += res.companiesFound;
      } catch (e) {
        await log.error(`parseAll: ниша #${n.id} (${n.name}) упала: ${e.message}`);
      }
      parseAllState.done++;
      // пауза 60-120с между нишами (кроме последней)
      if (parseAllState.active && !global.systemPaused && parseAllState.done < parseAllState.total) {
        await new Promise(r => setTimeout(r, 60000 + Math.floor(Math.random() * 60000)));
      }
    }
    const summary = getParseAllState();
    parseAllState.active = false;
    parseAllState.currentId = null;
    parseAllState.currentName = null;
    await log.info(`parseAll: завершено. Обработано ${summary.done}/${summary.total}, новых компаний: ${summary.companiesNew}`);
    if (onDone) { try { await onDone(summary); } catch (_) {} }
  })();

  return { started: true, total: niches.length };
}

async function parseAuto() {
  try {
    if (parseAllState.active) {
      return { message: 'Идёт парсинг всех ниш (/parse_all), автопарсинг пропущен' };
    }
    const qualifiedCount = await countQualifiedInQueue();

    if (qualifiedCount >= 100) {
      return {
        message: `В очереди уже ${qualifiedCount} qualified компаний. Парсинг отменён. Запусти фильтрацию!`,
        currentQualified: qualifiedCount
      };
    }

    const niches = await getTopNiches(1);

    if (niches.length === 0) {
      return { error: 'Нет доступных ниш для парсинга' };
    }

    const niche = niches[0];
    const result = await parseNiche(niche.id);

    if (result.success) {
      return {
        success: true,
        message: `✅ Автопарсинг завершён!\nНиша: ${niche.name}\nНайдено: ${result.companiesFound}\nНовых: ${result.companiesNew}`,
        nicheId: niche.id
      };
    } else {
      return { error: result.error };
    }
  } catch (error) {
    await log.error(`Ошибка при автопарсинге: ${error.message}`);
    return { error: error.message };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const listCmd = args.includes('--list');
  const nicheArg = args.find(arg => arg.startsWith('--niche='));
  const autoCmd = args.includes('--auto');

  if (listCmd) {
    const result = await listNiches();
    console.log(result.message || JSON.stringify(result, null, 2));
  } else if (nicheArg) {
    const nicheId = parseInt(nicheArg.split('=')[1]);
    const result = await parseNiche(nicheId);
    console.log(JSON.stringify(result, null, 2));
  } else if (autoCmd) {
    const result = await parseAuto();
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--all')) {
    const result = await parseAll();
    console.log(JSON.stringify(result, null, 2));
    // фоновый цикл продолжит работу, процесс завершится сам по окончании
  } else {
    console.log('Usage:');
    console.log('  node scripts/parser/index.js --list                 # список ниш');
    console.log('  node scripts/parser/index.js --niche=1              # парсить нишу #1');
    console.log('  node scripts/parser/index.js --auto                 # автопарсинг');
    console.log('  node scripts/parser/index.js --all                  # парсить все pending-ниши подряд');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { listNiches, parseNiche, parseAuto, parseAll, getParseAllState, stopParseAll, getNicheById, getNicheByName, getParseState: scraper.getParseState };

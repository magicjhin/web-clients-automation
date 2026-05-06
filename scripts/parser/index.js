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

    // Обновляю статус на 'parsing'
    await updateNicheStatus(nicheId, 'parsing');
    await log.info(`Запуск парсинга нише: ${niche.name} (search_term: ${niche.search_term})`);

    // Запускаю scraper
    const result = await scraper.scrapeNiche(niche.search_term, nicheId, niche.name);

    // Обновляю статус на 'completed'
    await updateNicheStatus(nicheId, 'completed');
    await log.info(`Завершен парсинг нише: ${niche.name}. Найдено: ${result.companiesFound}`);

    return {
      success: true,
      niche: niche.name,
      companiesFound: result.companiesFound,
      companiesNew: result.companiesNew
    };
  } catch (error) {
    await log.error(`Ошибка при парсинге нише #${nicheId}: ${error.message}`);
    await updateNicheStatus(nicheId, 'pending'); // вернуть статус на pending при ошибке
    return { error: error.message };
  }
}

async function parseAuto() {
  try {
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
  } else {
    console.log('Usage:');
    console.log('  node scripts/parser/index.js --list                 # список ниш');
    console.log('  node scripts/parser/index.js --niche=1              # парсить нишу #1');
    console.log('  node scripts/parser/index.js --auto                 # автопарсинг');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { listNiches, parseNiche, parseAuto, getNicheById, getNicheByName, getParseState: scraper.getParseState };

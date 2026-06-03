// МОДУЛЬ: bot/telegram.js
// ЧТО: Обработчик Telegram webhook — маршрутизация команд и отправка ответов
// КАК ИСПОЛЬЗОВАТЬ: const telegram = require('./telegram'); telegram.handleUpdate(req.body)

const https = require('https');
const { execFile } = require('child_process');
const path = require('path');
const config = require('../shared/config');
const db = require('../shared/db');
const log = require('../shared/logger')('bot');

const SCRIPTS_DIR = path.join(__dirname, '..');

function sendMessage(chatId, text, parseMode = 'Markdown') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${config.telegram.token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Отправка картинки (multipart/form-data) — для капчи
function sendPhoto(chatId, imageBuffer, caption = '', parseMode = 'Markdown') {
  return new Promise((resolve, reject) => {
    const boundary = '----LeadgenBoundary' + Date.now().toString(16);
    const parts = [];
    const pushField = (name, value) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };
    pushField('chat_id', String(chatId));
    if (caption) { pushField('caption', caption); pushField('parse_mode', parseMode); }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="captcha.png"\r\nContent-Type: image/png\r\n\r\n`));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${config.telegram.token}/sendPhoto`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_) { resolve({ ok: false, raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const fullPath = path.join(SCRIPTS_DIR, scriptPath);
    execFile('node', [fullPath, ...args], { timeout: 120000 }, (error, stdout, stderr) => {
      if (error && error.code !== 0) {
        resolve({ error: stderr || error.message, stdout });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function cmdStatus(chatId) {
  await sendMessage(chatId, '⏳ Получаю статус системы...');
  try {
    const [companies, niches, logs] = await Promise.all([
      db.one(`SELECT
        COUNT(*) FILTER (WHERE status = 'raw') AS raw,
        COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE status = 'no_website') AS no_website,
        COUNT(*) FILTER (WHERE status = 'site_down') AS site_down,
        COUNT(*) AS total
        FROM companies`, []),
      db.one(`SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) AS total FROM niches`, []),
      db.one(`SELECT COUNT(*) FILTER (WHERE level = 'error' AND created_at > NOW() - INTERVAL '24 hours') AS errors_24h FROM logs`, []),
    ]);

    const text = `📊 *Статус системы*

🏢 *Компании (всего: ${companies.total})*
• Raw: ${companies.raw}
• Qualified: ${companies.qualified}
• Sent: ${companies.sent}
• Rejected: ${companies.rejected}
• No website: ${companies.no_website}
• Site down: ${companies.site_down}

📁 *Ниши (всего: ${niches.total})*
• Pending: ${niches.pending}
• Completed: ${niches.completed}

⚠️ Ошибок за 24ч: ${companies.errors_24h || logs.errors_24h}`;

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка получения статуса: ${err.message}`);
  }
}

async function cmdNiches(chatId, arg) {
  const PAGE_SIZE = 50;
  const page = Math.max(1, parseInt(arg) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const total = await db.one(`SELECT COUNT(*) as count FROM niches`, []);
    const totalCount = parseInt(total.count);

    if (totalCount === 0) {
      await sendMessage(chatId, '📭 Нет ниш в БД. Запусти /discover');
      return;
    }

    const rows = await db.many(`
      SELECT id, name, search_term, companies_found, companies_qualified, status
      FROM niches
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const statusIcon = { pending: '🟢', parsing: '🔄', completed: '✅', paused: '⏸' };

    let text = `📊 *Ниши (${page}/${totalPages}, всего ${totalCount}):*\n\n`;
    rows.forEach((n) => {
      const icon = statusIcon[n.status] || '📌';
      const stats = n.companies_found > 0 ? ` — ${n.companies_found} компаний` : '';
      text += `${icon} \`${n.id}\` ${n.name}${stats}\n`;
    });

    const nav = [];
    if (page > 1) nav.push(`/niches ${page - 1}`);
    if (page < totalPages) nav.push(`/niches ${page + 1}`);
    if (nav.length > 0) text += `\n_${nav.join('  |  ')}_`;
    text += `\n\n_Парсить: /parse <id>_`;

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdParse(chatId, arg) {
  if (!arg) {
    await sendMessage(chatId, '📋 Использование:\n`/parse 1` — парсить нишу по ID\n`/parse Стоматологи` — парсить по названию\n\nСписок ниш: /niches');
    return;
  }

  const parser = require('../parser/index');
  let niche;
  try {
    const nicheId = parseInt(arg);
    if (!isNaN(nicheId)) {
      niche = await parser.getNicheById(nicheId);
    } else {
      niche = await parser.getNicheByName(arg);
    }
  } catch (err) {
    await sendMessage(chatId, `❌ Ниша не найдена: "${arg}"\n\nПосмотри список: /niches`);
    return;
  }

  if (!niche) {
    await sendMessage(chatId, `❌ Ниша не найдена: "${arg}"\n\nПосмотри список: /niches`);
    return;
  }

  await sendMessage(chatId, `🔄 Парсю нишу *${niche.name}* (ID: ${niche.id})...\n\nЭто может занять 10-20 минут. Пришлю результат когда закончу.`);

  // Запускаем парсер напрямую в том же процессе (без execFile — нет таймаута)
  try {
    const result = await parser.parseNiche(niche.id);
    if (result.error) {
      await sendMessage(chatId, `❌ ${result.error}`);
      return;
    }
    const paused = result.stoppedReason === 'captcha';
    await sendMessage(chatId,
      `${paused ? '⏸ *Парсинг приостановлен (капча)*' : '✅ *Парсинг завершён!*'}\n\n` +
      `📁 Ниша: *${result.niche || niche.name}*\n` +
      `🏢 Найдено компаний: *${result.companiesFound || 0}*\n` +
      `🆕 Новых в БД: *${result.companiesNew || 0}*` +
      (paused ? `\n\n_Код капчи не получен. Прогресс сохранён — продолжить с той же страницы: /parse ${niche.id}_` : '')
    );
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка парсинга: ${err.message.slice(0, 500)}`);
  }
}

async function cmdFilter(chatId, arg) {
  await sendMessage(chatId, '⏳ Запускаю фильтрацию...');
  const args = arg ? [`--batch=${arg}`] : ['--batch=10'];
  const result = await runScript('filter/index.js', args);
  if (result.error && !result.stdout) {
    await sendMessage(chatId, `❌ Фильтр ещё не реализован. Придёт в День 5-6.`);
    return;
  }
  const output = result.stdout || result.error || 'Нет вывода';
  await sendMessage(chatId, `✅ Фильтрация завершена:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\``);
}

async function cmdRun(chatId, arg) {
  await sendMessage(chatId, '⏳ Запускаю аудит и отправку писем...');
  const args = arg ? [`--batch=${arg}`] : ['--batch=5'];
  const result = await runScript('audit/index.js', args);
  if (result.error && !result.stdout) {
    await sendMessage(chatId, `❌ Аудит ещё не реализован. Придёт в День 7-8.`);
    return;
  }
  const output = result.stdout || result.error || 'Нет вывода';
  await sendMessage(chatId, `✅ Аудит завершён:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\``);
}

async function cmdHistory(chatId) {
  try {
    const rows = await db.many(`
      SELECT ph.id, n.name as niche_name, ph.companies_found, ph.companies_new, ph.started_at, ph.finished_at
      FROM parse_history ph
      LEFT JOIN niches n ON n.id = ph.niche_id
      ORDER BY ph.started_at DESC
      LIMIT 10
    `, []);

    if (rows.length === 0) {
      await sendMessage(chatId, '📭 История парсинга пуста');
      return;
    }

    let text = '📜 *История парсинга (последние 10):*\n\n';
    rows.forEach((row) => {
      const date = new Date(row.started_at).toLocaleDateString('ru-RU');
      const dur = row.finished_at
        ? `${Math.round((new Date(row.finished_at) - new Date(row.started_at)) / 60000)} мин`
        : 'в процессе';
      text += `• ${date} — *${row.niche_name || 'Нет данных'}*\n`;
      text += `  Найдено: ${row.companies_found}, Новых: ${row.companies_new} (${dur})\n\n`;
    });

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdLogs(chatId) {
  try {
    const rows = await db.many(`
      SELECT level, module, message, created_at
      FROM logs
      ORDER BY created_at DESC
      LIMIT 20
    `, []);

    if (rows.length === 0) {
      await sendMessage(chatId, '📭 Логи пусты');
      return;
    }

    let text = '📋 *Последние 20 записей лога:*\n\n';
    rows.forEach((row) => {
      const time = new Date(row.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const icon = row.level === 'error' ? '❌' : row.level === 'warn' ? '⚠️' : 'ℹ️';
      text += `${icon} \`${time}\` [${row.module}] ${row.message}\n`;
    });

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdCalls(chatId) {
  try {
    const rows = await db.many(`
      SELECT name, email, phone, website, niche_id, vip_score
      FROM companies
      WHERE call_required = true AND status != 'called'
      ORDER BY vip_score DESC NULLS LAST
      LIMIT 10
    `, []);

    if (rows.length === 0) {
      await sendMessage(chatId, '📭 Нет компаний для звонка');
      return;
    }

    let text = `📞 *Компании для звонка (топ ${rows.length}):*\n\n`;
    rows.forEach((row, i) => {
      text += `${i + 1}. *${row.name}*\n`;
      if (row.phone) text += `   📱 ${row.phone}\n`;
      if (row.email) text += `   📧 ${row.email}\n`;
      if (row.website) text += `   🌐 ${row.website}\n`;
      if (row.vip_score) text += `   ⭐ VIP: ${row.vip_score}\n`;
      text += '\n';
    });

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdDiscover(chatId, arg) {
  const { getDiscoverState } = require('../parser/discover-niches');
  if (getDiscoverState().active) {
    await sendMessage(chatId, '⚠️ Поиск ниш уже запущен. Используй /discover\\_status для статуса.');
    return;
  }

  const min = arg ? parseInt(arg) : 500;
  if (isNaN(min)) {
    await sendMessage(chatId, '📋 Использование: `/discover` или `/discover 1000` (минимум компаний)');
    return;
  }

  await sendMessage(chatId,
    `🔍 *Запускаю поиск ниш...*\n\n` +
    `Минимум компаний: *${min}*\n` +
    `Проверяю ~291 категорию на rekvizitai.vz.lt\n\n` +
    `Это займёт ~10-15 минут. Пришлю результат когда закончу.\n` +
    `Статус: /discover\\_status`
  );

  const { discoverNiches } = require('../parser/discover-niches');
  discoverNiches(min).then(async (result) => {
    await sendMessage(chatId,
      `✅ *Поиск ниш завершён!*\n\n` +
      `🔍 Проверено категорий: *${result.total}*\n` +
      `✅ Подходящих (> ${min} фирм): *${result.found}*\n` +
      `➕ Добавлено новых ниш: *${result.added}*\n\n` +
      `Посмотреть: /niches`
    );
  }).catch(async (err) => {
    await sendMessage(chatId, `❌ Ошибка поиска ниш: ${err.message.slice(0, 300)}`);
  });
}

async function cmdDiscoverStatus(chatId) {
  const { getDiscoverState } = require('../parser/discover-niches');
  const state = getDiscoverState();

  if (!state.active) {
    await sendMessage(chatId, '💤 Поиск ниш не запущен.\n\nЗапустить: /discover');
    return;
  }

  const elapsed = Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = state.total > 0 ? Math.round((state.checked / state.total) * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  await sendMessage(chatId,
    `🔍 *Поиск ниш активен*\n\n` +
    `📌 Текущая: *${state.currentCategory}*\n` +
    `📊 Прогресс: ${bar} ${pct}%\n` +
    `🔢 Проверено: *${state.checked}* из *${state.total}*\n` +
    `✅ Найдено подходящих: *${state.found}*\n` +
    `➕ Добавлено в БД: *${state.added}*\n` +
    `⏱ Время: ${mins}м ${secs}с`
  );
}

async function cmdParseAll(chatId) {
  const parser = require('../parser/index');
  const result = await parser.parseAll(async (summary) => {
    await sendMessage(chatId,
      `🏁 *Парсинг всех ниш завершён*\n\n` +
      `Обработано ниш: *${summary.done}/${summary.total}*\n` +
      `Новых компаний: *${summary.companiesNew}*`
    );
  });
  if (result.error) {
    await sendMessage(chatId, `❌ ${result.error}`);
    return;
  }
  await sendMessage(chatId,
    `🚀 *Запущен парсинг ВСЕХ ниш*\n\n` +
    `В очереди: *${result.total}* ниш\n` +
    `Между нишами пауза 1-2 мин — процесс надолго (может идти весь день).\n\n` +
    `📊 Прогресс: /parse\\_status\n⏸ Остановить: /pause`
  );
}

async function cmdParseStatus(chatId) {
  const parser = require('../parser/index');
  const state = parser.getParseState();

  const allState = parser.getParseAllState();
  if (allState.active) {
    const el = Math.round((Date.now() - new Date(allState.startedAt)) / 60000);
    let t = `🔁 *Парсинг ВСЕХ ниш*\n\n` +
      `Прогресс: *${allState.done}/${allState.total}* ниш\n` +
      `Текущая: *${allState.currentName || '...'}*\n` +
      `🆕 Новых компаний: *${allState.companiesNew}*\n` +
      `⏱ Идёт: ${el} мин\n\n_Остановить: /pause_`;
    if (state.active) {
      t += `\n\n📄 Текущая ниша: стр *${state.currentPage}*, найдено ${state.companiesFound}`;
    }
    await sendMessage(chatId, t);
    return;
  }

  if (!state.active) {
    try {
      const rows = await db.many(`
        SELECT id, name, status, companies_found, last_parsed_page, total_pages, updated_at
        FROM niches
        WHERE status IN ('parsing', 'completed')
        ORDER BY updated_at DESC
        LIMIT 5
      `, []);

      if (rows.length === 0) {
        await sendMessage(chatId, '💤 Парсинг не запущен. Нет активных или завершённых ниш.');
        return;
      }

      let text = '💤 *Парсинг не активен.*\n\n📜 Последние ниши:\n\n';
      rows.forEach(r => {
        const icon = r.status === 'completed' ? '✅' : '🔄';
        const pages = r.total_pages > 0 ? `${r.last_parsed_page}/${r.total_pages} стр` : `${r.last_parsed_page} стр`;
        text += `${icon} [${r.id}] *${r.name}*\n   Компаний: ${r.companies_found} | ${pages}\n\n`;
      });

      text += `_Сбросить нишу: /reset\\_niche <id>_`;
      await sendMessage(chatId, text);
    } catch (err) {
      await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
    }
    return;
  }

  const elapsed = Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pagesLeft = state.totalPages > 0 ? state.totalPages - state.currentPage : '?';
  const pct = state.totalPages > 0 ? Math.round((state.currentPage / state.totalPages) * 100) : 0;

  const bar = state.totalPages > 0
    ? '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
    : '░░░░░░░░░░';

  const text = `🔄 *Парсинг активен*

📁 Ниша: *${state.nicheName || state.categoryKey}*
📄 Страница: *${state.currentPage}* из *${state.totalPages || '?'}*
📊 Прогресс: ${bar} ${pct}%
🏢 Найдено: *${state.companiesFound}* (новых: *${state.companiesNew}*)
⏱ Время: ${mins}м ${secs}с
📌 Осталось страниц: ~${pagesLeft}${state.waitingCaptcha ? '\n\n🔐 *Ожидаю код капчи* — пришли `/code КОД`' : ''}`;

  await sendMessage(chatId, text);
}

async function cmdResetNiche(chatId, arg) {
  if (!arg) {
    await sendMessage(chatId, '📋 Использование: `/reset_niche 67` — сбросить прогресс ниши по ID\n\nСписок ниш: /niches');
    return;
  }

  const nicheId = parseInt(arg);
  if (isNaN(nicheId)) {
    await sendMessage(chatId, `❌ Неверный ID: "${arg}". Укажи числовой ID ниши.`);
    return;
  }

  try {
    const niche = await db.one('SELECT id, name, companies_found FROM niches WHERE id = $1', [nicheId]);
    if (!niche) {
      await sendMessage(chatId, `❌ Ниша #${nicheId} не найдена`);
      return;
    }

    // Удаляем компании этой ниши
    const deleted = await db.one(
      'WITH del AS (DELETE FROM companies WHERE niche_id = $1 RETURNING id) SELECT COUNT(*) as count FROM del',
      [nicheId]
    );

    // Сбрасываем прогресс ниши
    await db.query(
      `UPDATE niches SET status = 'pending', companies_found = 0, companies_qualified = 0,
       last_parsed_page = 0, total_pages = 0, parsed_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [nicheId]
    );

    await sendMessage(chatId,
      `✅ *Ниша сброшена*\n\n` +
      `📁 Ниша: *${niche.name}* (ID: ${nicheId})\n` +
      `🗑 Удалено компаний: *${deleted.count}*\n` +
      `📌 Статус: pending (готова к повторному парсингу)\n\n` +
      `Запусти: /parse ${nicheId}`
    );
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdPause(chatId) {
  try {
    await db.query(`INSERT INTO logs (level, module, message) VALUES ('warn', 'bot', 'System paused by user')`, []);
    await sendMessage(chatId, '⏸ Система поставлена на паузу. Cron задачи остановлены.\n\nИспользуй /resume для возобновления.');
    global.systemPaused = true;
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

async function cmdResume(chatId) {
  try {
    await db.query(`INSERT INTO logs (level, module, message) VALUES ('info', 'bot', 'System resumed by user')`, []);
    await sendMessage(chatId, '▶️ Система возобновлена. Cron задачи активны.');
    global.systemPaused = false;
  } catch (err) {
    await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
}

function deleteMessage(chatId, messageId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, message_id: messageId });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${config.telegram.token}/deleteMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

async function cmdClear(chatId, messageId) {
  // Удаляем последние 100 сообщений (Telegram хранит ID последовательно)
  const tasks = [];
  for (let i = 0; i <= 100; i++) {
    tasks.push(deleteMessage(chatId, messageId - i));
  }
  await Promise.all(tasks);
}

async function cmdHelp(chatId) {
  const text = `🤖 *Leadgen Bot — Команды*

📁 *Ниши и парсинг*
/niches — список всех ниш
/discover — найти все ниши с 500+ фирм
/discover\\_status — прогресс поиска ниш
/parse 1 — парсить нишу по ID
/parse Стоматологи — парсить по названию
/parse\_all — парсить ВСЕ ниши подряд (надолго)
/code ABC — ввести код капчи (когда бот попросит)

📊 *Информация*
/status — статистика БД
/parse\\_status — прогресс текущего парсинга
/history — история парсинга
/logs — последние логи
/calls — компании для звонка

🔧 *Управление данными*
/reset\\_niche <id> — сбросить нишу (удалить компании, начать заново)

🚀 *Pipeline _(скоро)_*
/filter — запустить фильтрацию
/run — аудит + генерация писем

⚙️ *Система*
/pause — поставить на паузу
/resume — возобновить
/clear — очистить чат`;

  await sendMessage(chatId, text);
}

async function cmdCode(chatId, arg) {
  const captcha = require('../shared/captcha');
  const code = (arg || '').trim();
  if (!code) {
    await sendMessage(chatId, '📋 Использование: `/code ABC` — ввести код с картинки капчи');
    return;
  }
  if (!captcha.isPending()) {
    await sendMessage(chatId, 'ℹ️ Сейчас код капчи не требуется.');
    return;
  }
  const ok = captcha.submit(code);
  await sendMessage(chatId, ok
    ? `✅ Код принят: \`${code}\` — продолжаю парсинг.`
    : 'ℹ️ Сейчас код капчи не требуется.');
}

async function handleUpdate(update) {
  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  const messageId = update.message.message_id;
  const text = update.message.text.trim();
  const [rawCmd, ...argParts] = text.split(/\s+/);
  const cmd = rawCmd.split('@')[0].toLowerCase();
  const arg = argParts.join(' ').trim();

  await log.info(`Command: ${cmd} ${arg}`.trim());

  switch (cmd) {
    case '/start':
    case '/help':
      return cmdHelp(chatId);
    case '/status':
      return cmdStatus(chatId);
    case '/niches':
      return cmdNiches(chatId, arg);
    case '/parse':
      return cmdParse(chatId, arg);
    case '/parse_status':
      return cmdParseStatus(chatId);
    case '/parse_all':
      return cmdParseAll(chatId);
    case '/code':
      return cmdCode(chatId, arg);
    case '/reset_niche':
      return cmdResetNiche(chatId, arg);
    case '/discover':
      return cmdDiscover(chatId, arg);
    case '/discover_status':
      return cmdDiscoverStatus(chatId);
    case '/filter':
      return cmdFilter(chatId, arg);
    case '/run':
      return cmdRun(chatId, arg);
    case '/history':
      return cmdHistory(chatId);
    case '/logs':
      return cmdLogs(chatId);
    case '/calls':
      return cmdCalls(chatId);
    case '/pause':
      return cmdPause(chatId);
    case '/resume':
      return cmdResume(chatId);
    case '/clear':
      return cmdClear(chatId, messageId);
    default:
      await sendMessage(chatId, `❓ Неизвестная команда: ${cmd}\n\nИспользуй /help`);
  }
}

module.exports = { handleUpdate, sendMessage, sendPhoto };

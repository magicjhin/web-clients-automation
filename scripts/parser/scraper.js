// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.vz.lt — собирает компании по категории
// URL формат: https://rekvizitai.vz.lt/imones/{category_key}/{page}/
// ФИКС: убран расчёт totalPages по пагинации первой страницы (он занижал
//       число страниц до ~20). Идём инкрементально до реального конца.
// КАПЧА: страницы глубже ~20 закрыты капчей (#formFirmsCaptcha, 3-значный код).
//        Решаем: сначала OCR (shared/ocr), иначе — ручной ввод через Telegram
//        (shared/captcha + бот). Браузер при ожидании НЕ пересоздаём — иначе
//        теряется разблокированная сессия.

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');
const captcha = require('../shared/captcha');
const ocr = require('../shared/ocr');

const BASE_URL = 'https://rekvizitai.vz.lt';

// Предохранитель от бесконечного цикла (если сайт начнёт зацикливать страницы)
const HARD_CAP = 500;
// Сколько страниц подряд без НОВЫХ компаний считаем концом списка
const EMPTY_STREAK_LIMIT = 2;
// Сколько раз пытаемся ввести код на одной странице (неверный код / OCR промах)
const CAPTCHA_RETRY_LIMIT = 3;
// Сколько ждём код от человека (Telegram), мс
const CAPTCHA_WAIT_MS = 10 * 60 * 1000;
// Режим капчи:
//  'skip' (по умолчанию) — ширина: на капче завершаем нишу и идём к следующей
//          (бесплатные ~20 страниц собраны; глубже сайт не пускает без капчи).
//  'ask'  — глубокий добор: запрашиваем код у человека через Telegram
//           (имеет смысл только через резидентный прокси/IP, иначе сайт редиректит).
const CAPTCHA_MODE = process.env.PARSE_CAPTCHA_MODE || 'skip';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

// Глобальное состояние активного парсинга (один парсинг за раз)
const parseState = {
  active: false,
  nicheId: null,
  nicheName: null,
  categoryKey: null,
  currentPage: 0,
  totalPages: 0, // теперь информативно: фактически обработанные страницы
  companiesFound: 0,
  companiesNew: 0,
  waitingCaptcha: false, // парсер ждёт ввода кода капчи
  startedAt: null,
  lastPageAt: null,
};

function getParseState() {
  return { ...parseState };
}

function resetParseState() {
  parseState.active = false;
  parseState.nicheId = null;
  parseState.nicheName = null;
  parseState.categoryKey = null;
  parseState.currentPage = 0;
  parseState.totalPages = 0;
  parseState.companiesFound = 0;
  parseState.companiesNew = 0;
  parseState.waitingCaptcha = false;
  parseState.startedAt = null;
  parseState.lastPageAt = null;
}

// Что на странице: компании / капча-гейт / пусто (конец списка)
async function classifyPage(page) {
  return page.evaluate(() => {
    if (document.querySelector('#formFirmsCaptcha') || document.querySelector('#security_code')) return 'captcha';
    if (document.querySelectorAll('div.company a.company-title').length > 0) return 'companies';
    return 'empty';
  });
}

// Получить картинку капчи — пиксели УЖЕ показанной картинки через canvas.
// ВАЖНО: нельзя перезапрашивать src (fetch) — сервер на каждый запрос картинки
// генерирует НОВЫЙ код, и введённый код перестаёт совпадать с тем, что ждёт
// форма (сайт тогда сбрасывает на стр.1 и не открывает сессию). Картинка
// same-origin, поэтому canvas не "портится" (taint) и toDataURL работает.
// Фолбэк — скриншот элемента.
async function grabCaptchaImage(page) {
  try {
    const b64 = await page.evaluate(() => {
      const img = document.querySelector('#security_code_image');
      if (!img || !img.complete || !img.naturalWidth) return null;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const url = c.toDataURL('image/png');
      return (url && url.indexOf(',') > -1) ? url.split(',')[1] : null;
    });
    if (b64) return Buffer.from(b64, 'base64');
  } catch (_) {}
  try {
    const el = await page.$('#security_code_image');
    if (el) return await el.screenshot();
  } catch (_) {}
  return null;
}

// Решение капчи на текущей странице (та же сессия!).
// Возвращает 'companies' | 'empty' (после решения) или false (не смогли).
async function solveCaptchaGate(page, meta) {
  for (let attempt = 1; attempt <= CAPTCHA_RETRY_LIMIT; attempt++) {
    const imgEl = await page.$('#security_code_image');
    if (!imgEl) {
      // картинки нет — возможно, уже не капча
      const st = await classifyPage(page);
      return st === 'captcha' ? false : st;
    }

    const buf = await grabCaptchaImage(page);
    if (!buf) {
      await log.warn(`Капча стр ${meta.page}: не удалось получить картинку`);
      return false;
    }

    // 1) авто-распознавание (OCR / в будущем 2Captcha)
    let code = null;
    let via = 'OCR';
    try { code = await ocr.solve(buf); } catch (_) {}

    // 2) ручной ввод через Telegram
    if (!code) {
      via = 'Telegram';
      try {
        code = await captcha.request(buf, { ...meta, attempt }, CAPTCHA_WAIT_MS);
      } catch (e) {
        await log.warn(`Капча стр ${meta.page}: код не получен (${e.message})`);
        return false;
      }
    }

    code = String(code || '').trim();
    if (!code) {
      await log.warn(`Капча стр ${meta.page}: пустой код, повтор`);
      continue;
    }

    await log.info(`Капча стр ${meta.page}: ввожу код "${code}" (${via}, попытка ${attempt}/${CAPTCHA_RETRY_LIMIT})`);

    try {
      await page.click('#security_code', { clickCount: 3 }).catch(() => {});
      await page.type('#security_code', code, { delay: 60 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
        page.click('#ok'),
      ]);
    } catch (e) {
      await log.warn(`Капча стр ${meta.page}: ошибка отправки формы (${e.message})`);
    }
    // дать странице устаканиться (на случай AJAX-сабмита)
    await new Promise(r => setTimeout(r, 1500));

    const st = await classifyPage(page);
    if (st === 'companies') {
      await log.info(`✅ Капча пройдена (стр ${meta.page})`);
      return 'companies';
    }
    if (st === 'empty') {
      await log.info(`Капча пройдена, но на стр ${meta.page} компаний нет — конец списка`);
      return 'empty';
    }
    await log.warn(`Капча стр ${meta.page}: код не принят (попытка ${attempt}/${CAPTCHA_RETRY_LIMIT})`);
    // освежить капчу для следующей попытки
    try { await page.reload({ waitUntil: 'networkidle2' }); } catch (_) {}
  }
  return false;
}

async function scrapeNiche(categoryKey, nicheId, nicheName = '') {
  let browser;
  let companiesNew = 0;
  let companiesFound = 0;
  let stoppedReason = null; // null=дошли до конца, 'captcha', 'hardcap'

  parseState.active = true;
  parseState.nicheId = nicheId;
  parseState.nicheName = nicheName;
  parseState.categoryKey = categoryKey;
  parseState.currentPage = 0;
  parseState.totalPages = 0;
  parseState.companiesFound = 0;
  parseState.companiesNew = 0;
  parseState.waitingCaptcha = false;
  parseState.startedAt = new Date();
  parseState.lastPageAt = null;

  let uaIndex = 0;

  async function launchBrowser() {
    if (browser) { try { await browser.close(); } catch (_) {} }
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const p = await browser.newPage();
    await p.setViewport({ width: 1366, height: 900 });
    await p.setUserAgent(USER_AGENTS[uaIndex % USER_AGENTS.length]);
    p.setDefaultNavigationTimeout(45000);
    p.setDefaultTimeout(45000);
    uaIndex++;
    return p;
  }

  // Извлечение компаний с текущей страницы
  async function extractCompanies(p) {
    return p.evaluate(() => {
      const result = [];
      const items = Array.from(document.querySelectorAll('div.company'));
      for (const item of items) {
        const link = item.querySelector('a.company-title');
        if (!link) continue;
        const href = link.getAttribute('href') || '';
        const name = (link.getAttribute('title') || link.textContent).trim();
        if (!name || name.length < 2) continue;
        const fullUrl = href.startsWith('http') ? href : `${location.origin}${href}`;
        result.push({ name: name.substring(0, 255), rekvizitai_url: fullUrl });
      }
      return result;
    });
  }

  try {
    let page = await launchBrowser();
    await log.info(`Запуск парсинга категории: "${categoryKey}" (nicheId: ${nicheId})`);

    // С какой страницы продолжать (если парсинг прерывался)
    const nicheData = await db.one(
      'SELECT last_parsed_page, total_pages, companies_found FROM niches WHERE id = $1',
      [nicheId]
    );
    const startPage = (nicheData.last_parsed_page || 0) + 1;
    companiesFound = parseInt(nicheData.companies_found) || 0;
    parseState.companiesFound = companiesFound;

    await log.info(`Начинаем со страницы: ${startPage} (без верхнего лимита, идём до конца)`);

    // Дедупликация по всем страницам этого прогона
    const seenUrls = new Set();

    let pageNum = startPage;
    let emptyStreak = 0;

    while (pageNum <= HARD_CAP) {
      try {
        // Задержка перед каждым переходом (защита от частых запросов)
        if (pageNum > 1) {
          const delay = 8000 + Math.floor(Math.random() * 7000);
          await new Promise(r => setTimeout(r, delay));
        }

        const url = `${BASE_URL}/imones/${categoryKey}/${pageNum}/`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Ждём появления компаний ИЛИ формы капчи
        await page.waitForSelector('div.company, #formFirmsCaptcha, #security_code', { timeout: 15000 }).catch(() => {});

        let pageState = await classifyPage(page);

        // Капча-гейт
        if (pageState === 'captcha') {
          if (CAPTCHA_MODE !== 'ask') {
            // Ширина: капча = граница бесплатных страниц. Завершаем нишу и идём дальше.
            stoppedReason = 'capped';
            await log.info(`Страница ${pageNum}: капча-гейт — бесплатные страницы собраны, завершаю нишу (capped)`);
            break;
          }
          // Глубокий добор: запрашиваем код (OCR / Telegram), решаем в той же сессии
          parseState.waitingCaptcha = true;
          await log.info(`Страница ${pageNum}: капча-гейт, запрашиваю код`);
          const solved = await solveCaptchaGate(page, { nicheName, categoryKey, page: pageNum });
          parseState.waitingCaptcha = false;
          if (!solved) {
            stoppedReason = 'captcha';
            await log.warn(`Страница ${pageNum}: капча не пройдена — останавливаюсь, прогресс сохранён (продолжить: /parse)`);
            break;
          }
          pageState = solved; // 'companies' | 'empty'
        }

        // Пустая страница (без капчи) → конец категории
        if (pageState === 'empty') {
          emptyStreak++;
          await log.info(`Страница ${pageNum}: компаний нет (не капча). emptyStreak=${emptyStreak}`);
          if (emptyStreak >= EMPTY_STREAK_LIMIT) {
            await log.info(`Достигнут конец списка на странице ${pageNum}`);
            break;
          }
          pageNum++;
          continue;
        }

        // Дебаг: сколько div.company реально на странице
        const debugCount = await page.evaluate(() => ({
          total: document.querySelectorAll('div.company').length,
          withTitle: document.querySelectorAll('div.company a.company-title').length,
        }));
        await log.info(`Страница ${pageNum} DOM: div.company=${debugCount.total}, с a.company-title=${debugCount.withTitle}`);

        const rawCompanies = await extractCompanies(page);

        // Фильтруем дубли по всем страницам прогона
        const companies = rawCompanies.filter(c => {
          if (seenUrls.has(c.rekvizitai_url)) return false;
          seenUrls.add(c.rekvizitai_url);
          return true;
        });

        await log.info(`Страница ${pageNum}: найдено ${rawCompanies.length} (новых уникальных: ${companies.length})`);

        // Конец списка определяем по НОВЫМ компаниям, а не по номеру страницы.
        // Если страница вернула только дубли (сайт зациклил на последнюю) —
        // это тоже сигнал конца.
        if (companies.length === 0) {
          emptyStreak++;
          await log.info(`Страница ${pageNum}: 0 новых компаний. emptyStreak=${emptyStreak}`);
          if (emptyStreak >= EMPTY_STREAK_LIMIT) {
            await log.info(`Достигнут конец списка на странице ${pageNum}`);
            break;
          }
          pageNum++;
          continue;
        }

        emptyStreak = 0;
        companiesFound += companies.length;
        parseState.currentPage = pageNum;
        parseState.totalPages = pageNum; // фактически обработано
        parseState.companiesFound = companiesFound;
        parseState.lastPageAt = new Date();

        for (const company of companies) {
          try {
            const res = await db.query(
              `INSERT INTO companies (niche_id, name, rekvizitai_url, status, created_at)
               VALUES ($1, $2, $3, 'raw', NOW())
               ON CONFLICT (rekvizitai_url) WHERE rekvizitai_url IS NOT NULL DO NOTHING`,
              [nicheId, company.name, company.rekvizitai_url]
            );
            if (res.rowCount > 0) {
              companiesNew++;
              parseState.companiesNew = companiesNew;
            }
          } catch (insertError) {
            await log.error(`INSERT failed: ${company.rekvizitai_url} — ${insertError.message}`);
          }
        }

        // Сохраняем прогресс после каждой страницы
        await db.query(
          'UPDATE niches SET last_parsed_page = $1, companies_found = $2, total_pages = $3 WHERE id = $4',
          [pageNum, companiesFound, pageNum, nicheId]
        );

        pageNum++;

      } catch (pageError) {
        await log.warn(`Ошибка при парсинге страницы ${pageNum}: ${pageError.message}`);
        pageNum++; // не зависаем на проблемной странице
      }
    }

    if (pageNum > HARD_CAP && !stoppedReason) stoppedReason = 'hardcap';

    await log.info(`✅ Завершён парсинг "${categoryKey}": ${companiesFound} компаний (${companiesNew} новых), обработано до страницы ${pageNum - 1}${stoppedReason ? ` [stop: ${stoppedReason}]` : ''}`);
    resetParseState();

    return { companiesFound, companiesNew, categoryKey, stoppedReason };

  } catch (error) {
    await log.error(`Критическая ошибка при парсинге "${categoryKey}": ${error.message}`);
    resetParseState();
    throw error;
  } finally {
    captcha.cancel('парсинг завершён');
    if (browser) await browser.close();
  }
}

module.exports = { scrapeNiche, getParseState };

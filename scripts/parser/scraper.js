// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.vz.lt — собирает компании по категории
// URL формат: https://rekvizitai.vz.lt/imones/{category_key}/{page}/

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');

const BASE_URL = 'https://rekvizitai.vz.lt';

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
  totalPages: 0,
  companiesFound: 0,
  companiesNew: 0,
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
  parseState.startedAt = null;
  parseState.lastPageAt = null;
}

async function scrapeNiche(categoryKey, nicheId, nicheName = '') {
  let browser;
  let companiesNew = 0;
  let companiesFound = 0;

  // Обновляем глобальное состояние
  parseState.active = true;
  parseState.nicheId = nicheId;
  parseState.nicheName = nicheName;
  parseState.categoryKey = categoryKey;
  parseState.currentPage = 0;
  parseState.totalPages = 0;
  parseState.companiesFound = 0;
  parseState.companiesNew = 0;
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
    await p.setUserAgent(USER_AGENTS[uaIndex % USER_AGENTS.length]);
    p.setDefaultNavigationTimeout(45000);
    p.setDefaultTimeout(45000);
    uaIndex++;
    return p;
  }

  try {
    let page = await launchBrowser();

    await log.info(`Запуск парсинга категории: "${categoryKey}" (nicheId: ${nicheId})`);

    // Узнаём с какой страницы продолжать (если парсинг прерывался)
    const nicheData = await db.one('SELECT last_parsed_page, total_pages, companies_found FROM niches WHERE id = $1', [nicheId]);
    const startPage = (nicheData.last_parsed_page || 0) + 1;
    companiesFound = parseInt(nicheData.companies_found) || 0;
    parseState.companiesFound = companiesFound;

    // Загружаем первую страницу чтобы узнать сколько страниц всего
    const firstUrl = `${BASE_URL}/imones/${categoryKey}/1/`;
    await page.goto(firstUrl, { waitUntil: 'networkidle2' });
    try {
      await page.waitForSelector('div.company', { timeout: 15000 });
    } catch (e) {
      await log.warn(`Карточки компаний не появились на первой странице: ${e.message}`);
    }

    await log.info(`Финальный URL: ${page.url()}`);

    // Определяем количество страниц (всегда пересчитываем)
    let totalPages = 1;
    try {
      totalPages = await page.evaluate(() => {
        // Ищем последнюю страницу в пагинации по href вида /imones/xxx/N/
        const pagLinks = Array.from(document.querySelectorAll('a[href*="/imones/"]'));
        let maxPage = 1;
        for (const link of pagLinks) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/imones\/[^/]+\/(\d+)\//);
          if (match) {
            const n = parseInt(match[1]);
            if (n > maxPage) maxPage = n;
          }
        }
        return maxPage;
      });
      await db.query('UPDATE niches SET total_pages = $1 WHERE id = $2', [totalPages, nicheId]);
    } catch (e) {
      await log.warn(`Не удалось определить количество страниц: ${e.message}`);
    }

    parseState.totalPages = totalPages;
    await log.info(`Всего страниц: ${totalPages}, начинаем с страницы: ${startPage}`);

    // Глобальный Set для дедупликации по всем страницам
    const seenUrls = new Set();

    // Парсим каждую страницу
    for (let pageNum = startPage; pageNum <= totalPages; pageNum++) {
      try {
        if (pageNum > 1) {
          // Случайная задержка 2-4 сек между страницами
          const delay = 2000 + Math.floor(Math.random() * 2000);
          await new Promise(r => setTimeout(r, delay));
          const url = `${BASE_URL}/imones/${categoryKey}/${pageNum}/`;
          await page.goto(url, { waitUntil: 'networkidle2' });
        }
        let appeared = false;
        try {
          await page.waitForSelector('div.company', { timeout: 20000 });
          appeared = true;
        } catch (_) {}

        if (!appeared) {
          // Сайт заблокировал — ждём 3 минуты, перезапускаем браузер с новым User-Agent
          await log.warn(`Страница ${pageNum}: блокировка, ждём 3 мин и меняем UA (#${uaIndex})`);
          await new Promise(r => setTimeout(r, 180000));
          page = await launchBrowser();
          const url = `${BASE_URL}/imones/${categoryKey}/${pageNum}/`;
          await page.goto(url, { waitUntil: 'networkidle2' });
          try {
            await page.waitForSelector('div.company', { timeout: 20000 });
          } catch (e) {
            // Ещё раз ждём 3 минуты и пробуем последний раз
            await log.warn(`Страница ${pageNum}: снова блокировка, ждём ещё 3 мин`);
            await new Promise(r => setTimeout(r, 180000));
            page = await launchBrowser();
            await page.goto(url, { waitUntil: 'networkidle2' });
            try {
              await page.waitForSelector('div.company', { timeout: 20000 });
            } catch (e2) {
              await log.warn(`Страница ${pageNum}: блокировка после 3 попыток, пропускаем`);
              continue;
            }
          }
        }

        // Дебаг: сколько div.company реально на странице
        const debugCount = await page.evaluate(() => {
          const container = document.querySelector('div.list-item');
          if (!container) return { total: 0, withTitle: 0 };
          return {
            total: container.querySelectorAll('div.company').length,
            withTitle: container.querySelectorAll('div.company a.company-title').length,
          };
        });
        await log.info(`Страница ${pageNum} DOM: div.company=${debugCount.total}, с a.company-title=${debugCount.withTitle}`);

        const rawCompanies = await page.evaluate(() => {
          const result = [];
          // Берём только из основного блока div.list-item, игнорируем повторы внизу страницы
          const container = document.querySelector('div.list-item');
          if (!container) return result;
          const items = Array.from(container.querySelectorAll('div.company'));

          for (const item of items) {
            const link = item.querySelector('a.company-title');
            if (!link) continue;

            const href = link.getAttribute('href') || '';
            const name = (link.getAttribute('title') || link.textContent).trim();
            if (!name || name.length < 2) continue;

            const fullUrl = href.startsWith('http') ? href : `${location.origin}${href}`;

            result.push({
              name: name.substring(0, 255),
              rekvizitai_url: fullUrl
            });
          }
          return result;
        });

        // Фильтруем дубли по всем страницам (боковые блоки повторяются)
        const companies = rawCompanies.filter(c => {
          if (seenUrls.has(c.rekvizitai_url)) return false;
          seenUrls.add(c.rekvizitai_url);
          return true;
        });

        await log.info(`Страница ${pageNum}/${totalPages}: найдено ${rawCompanies.length} (уникальных: ${companies.length})`);
        companiesFound += companies.length;
        parseState.currentPage = pageNum;
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
          'UPDATE niches SET last_parsed_page = $1, companies_found = $2 WHERE id = $3',
          [pageNum, companiesFound, nicheId]
        );

      } catch (pageError) {
        await log.warn(`Ошибка при парсинге страницы ${pageNum}: ${pageError.message}`);
      }
    }

    await log.info(`✅ Завершён парсинг "${categoryKey}": ${companiesFound} компаний (${companiesNew} новых)`);
    resetParseState();

    return { companiesFound, companiesNew, categoryKey };

  } catch (error) {
    await log.error(`Критическая ошибка при парсинге "${categoryKey}": ${error.message}`);
    resetParseState();
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeNiche, getParseState };

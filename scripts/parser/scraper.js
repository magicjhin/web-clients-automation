// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.vz.lt — собирает компании по категории
// URL формат: https://rekvizitai.vz.lt/imones/{category_key}/{page}/

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');

const BASE_URL = 'https://rekvizitai.vz.lt';

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

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);

    await log.info(`Запуск парсинга категории: "${categoryKey}" (nicheId: ${nicheId})`);

    // Узнаём с какой страницы продолжать (если парсинг прерывался)
    const nicheData = await db.one('SELECT last_parsed_page, total_pages, companies_found FROM niches WHERE id = $1', [nicheId]);
    const startPage = (nicheData.last_parsed_page || 0) + 1;
    companiesFound = parseInt(nicheData.companies_found) || 0;
    parseState.companiesFound = companiesFound;

    // Загружаем первую страницу чтобы узнать сколько страниц всего
    const firstUrl = `${BASE_URL}/imones/${categoryKey}/1/`;
    await page.goto(firstUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    await log.info(`Финальный URL: ${page.url()}`);

    // Определяем количество страниц
    let totalPages = nicheData.total_pages || 1;
    if (!nicheData.total_pages) {
      try {
        totalPages = await page.evaluate(() => {
          const pagLinks = Array.from(document.querySelectorAll('.pagination a, [class*="pag"] a'));
          let maxPage = 1;
          for (const link of pagLinks) {
            const num = parseInt(link.textContent.trim());
            if (!isNaN(num) && num > maxPage) maxPage = num;
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/(\d+)\/$/);
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
    }

    parseState.totalPages = totalPages;
    await log.info(`Всего страниц: ${totalPages}, начинаем с страницы: ${startPage}`);

    // Глобальный Set для дедупликации по всем страницам
    const seenUrls = new Set();

    // Парсим каждую страницу
    for (let pageNum = startPage; pageNum <= totalPages; pageNum++) {
      try {
        if (pageNum > 1) {
          const url = `${BASE_URL}/imones/${categoryKey}/${pageNum}/`;
          await page.goto(url, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 1500));
        }

        const rawCompanies = await page.evaluate(() => {
          const result = [];
          const items = Array.from(document.querySelectorAll('div.list-item'));

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

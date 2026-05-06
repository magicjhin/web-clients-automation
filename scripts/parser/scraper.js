// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.vz.lt — собирает компании по категории
// URL формат: https://rekvizitai.vz.lt/imones/{category_key}/{page}/

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');

const BASE_URL = 'https://rekvizitai.vz.lt';

async function scrapeNiche(categoryKey, nicheId) {
  let browser;
  let companiesNew = 0;
  let companiesFound = 0;

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
    const nicheData = await db.one('SELECT last_parsed_page, total_pages FROM niches WHERE id = $1', [nicheId]);
    const startPage = (nicheData.last_parsed_page || 0) + 1;

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

    await log.info(`Всего страниц: ${totalPages}, начинаем с страницы: ${startPage}`);

    // Парсим каждую страницу
    for (let pageNum = startPage; pageNum <= totalPages; pageNum++) {
      try {
        if (pageNum > 1) {
          const url = `${BASE_URL}/imones/${categoryKey}/${pageNum}/`;
          await page.goto(url, { waitUntil: 'networkidle2' });
          await new Promise(r => setTimeout(r, 1500));
        }

        const companies = await page.evaluate(() => {
          const seen = new Set();
          const result = [];
          const links = Array.from(document.querySelectorAll('a[href*="/imone/"]'));

          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (!href.match(/\/imone\/[^/]+\/$/)) continue;
            if (seen.has(href)) continue;

            const name = link.textContent?.trim() || '';
            if (!name || name.length < 2) continue;
            if (name.includes('»') || name.toLowerCase().includes('kontakt')) continue;

            seen.add(href);

            const container = link.closest('li, tr, div.company, div.col, article') || link.parentElement?.parentElement;
            const allText = container?.textContent || '';
            const codeMatch = allText.match(/\b(\d{7,9})\b/);
            const code = codeMatch ? codeMatch[1] : '';
            const fullUrl = href.startsWith('http') ? href : `${location.origin}${href}`;

            result.push({
              name: name.substring(0, 255),
              company_code: code,
              rekvizitai_url: fullUrl
            });
          }
          return result;
        });

        await log.info(`Страница ${pageNum}/${totalPages}: найдено ${companies.length} компаний`);
        companiesFound += companies.length;

        for (const company of companies) {
          try {
            const checkQuery = company.company_code
              ? 'SELECT id FROM companies WHERE company_code = $1'
              : 'SELECT id FROM companies WHERE niche_id = $1 AND name = $2';
            const checkParams = company.company_code
              ? [company.company_code]
              : [nicheId, company.name];

            const exists = await db.one(checkQuery, checkParams);
            if (!exists) {
              await db.query(
                `INSERT INTO companies (niche_id, name, company_code, rekvizitai_url, status, created_at)
                 VALUES ($1, $2, $3, $4, 'raw', NOW())`,
                [nicheId, company.name, company.company_code || null, company.rekvizitai_url || null]
              );
              companiesNew++;
            }
          } catch (insertError) {
            await log.warn(`Не удалось вставить: ${company.name} — ${insertError.message}`);
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

    return { companiesFound, companiesNew, categoryKey };

  } catch (error) {
    await log.error(`Критическая ошибка при парсинге "${categoryKey}": ${error.message}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeNiche };

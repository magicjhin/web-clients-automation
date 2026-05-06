// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.lt — собирает компании по поисковому запросу
// КАК ЗАПУСТИТЬ: используется через parser/index.js

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');

const BASE_URL = 'https://rekvizitai.lt';

async function scrapeNiche(searchTerm, nicheId) {
  let browser;
  const collectedCompanies = [];
  let companiesNew = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);

    await log.info(`Запуск парсинга: "${searchTerm}" (nicheId: ${nicheId})`);

    const searchUrl = `${BASE_URL}/en/search/?search=${encodeURIComponent(searchTerm)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Проверяем финальный URL (сайт может редиректить)
    const finalUrl = page.url();
    const actualBase = new URL(finalUrl).origin;
    await log.info(`Финальный URL: ${finalUrl}`);

    // Дебаг: смотрим что на странице
    const pageInfo = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => h.includes('/company/') || h.includes('/imone/'))
        .slice(0, 5);

      const bodyClasses = document.body?.className || '';
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';

      return { allLinks, bodyClasses, h1, url: window.location.href };
    });

    await log.info(`Дебаг страницы: h1="${pageInfo.h1}", примеры ссылок: ${JSON.stringify(pageInfo.allLinks)}`);

    if (pageInfo.allLinks.length === 0) {
      await log.warn(`Нет ссылок на компании на странице. Возможно, блокировка или другая структура.`);
    }

    // Определяем паттерн ссылок на компании из реальных данных
    const companyLinkPattern = pageInfo.allLinks.length > 0
      ? (pageInfo.allLinks[0].includes('/imone/') ? '/imone/' : '/company/')
      : '/company/';

    // Получаем количество страниц
    let pageCount = 1;
    try {
      pageCount = await page.evaluate(() => {
        // Пробуем разные паттерны пагинации
        const selectors = [
          '.pagination li:last-child a',
          '.pagination .last a',
          'a[aria-label="Last"]',
          '.pages a:last-child',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const num = parseInt(el.textContent.trim());
            if (!isNaN(num) && num > 0) return num;
            const href = el.getAttribute('href') || '';
            const match = href.match(/page=(\d+)/);
            if (match) return parseInt(match[1]);
          }
        }
        // Ищем текст типа "Показано X из Y"
        const text = document.body.innerText;
        const match = text.match(/(\d+)\s*(puslapi|pages?|страниц)/i);
        if (match) return parseInt(match[1]);
        return 1;
      });
    } catch (e) {
      await log.warn(`Не удалось определить количество страниц: ${e.message}`);
    }

    pageCount = Math.min(pageCount, 50);
    await log.info(`Страниц для парсинга: ${pageCount}`);

    // Парсим каждую страницу
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        if (pageNum > 1) {
          const nextUrl = `${searchUrl}&page=${pageNum}`;
          await page.goto(nextUrl, { waitUntil: 'networkidle2' });
        }

        const companies = await page.evaluate((pattern, base) => {
          // Ищем все ссылки на компании
          const links = Array.from(document.querySelectorAll(`a[href*="${pattern}"]`));

          // Дедуплицируем по href
          const seen = new Set();
          const result = [];

          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (seen.has(href)) continue;
            seen.add(href);

            // Пропускаем навигационные ссылки
            if (href.endsWith(pattern.slice(0, -1)) || href === pattern) continue;

            const name = link.textContent?.trim() || '';
            if (!name || name.length < 2) continue;

            // Ищем код компании рядом (в родительском контейнере)
            const container = link.closest('tr, li, div.company, div.row, article') || link.parentElement;
            const allText = container?.textContent || '';
            const codeMatch = allText.match(/\b(\d{7,9})\b/);
            const code = codeMatch ? codeMatch[1] : '';

            const fullUrl = href.startsWith('http') ? href : `${base}${href}`;

            result.push({
              name: name.substring(0, 255),
              company_code: code,
              rekvizitai_url: fullUrl
            });
          }

          return result;
        }, companyLinkPattern, actualBase);

        await log.info(`Страница ${pageNum}/${pageCount}: найдено ${companies.length} компаний`);

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

            collectedCompanies.push(company);
          } catch (insertError) {
            await log.warn(`Не удалось вставить: ${company.name} — ${insertError.message}`);
          }
        }

        // Пауза между страницами чтобы не получить бан
        if (pageNum < pageCount) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (pageError) {
        await log.warn(`Ошибка при парсинге страницы ${pageNum}: ${pageError.message}`);
      }
    }

    await db.query(
      'UPDATE niches SET companies_found = companies_found + $1 WHERE id = $2',
      [collectedCompanies.length, nicheId]
    );

    await log.info(`✅ Завершён парсинг "${searchTerm}": ${collectedCompanies.length} компаний (${companiesNew} новых)`);

    return {
      companiesFound: collectedCompanies.length,
      companiesNew,
      searchTerm
    };
  } catch (error) {
    await log.error(`Критическая ошибка при парсинге "${searchTerm}": ${error.message}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeNiche };

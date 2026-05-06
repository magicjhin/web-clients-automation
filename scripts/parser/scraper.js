// МОДУЛЬ: parser/scraper.js
// ЧТО: Puppeteer парсер для rekvizitai.lt — собирает компании по поисковому запросу
// КАК ЗАПУСТИТЬ: используется через parser/index.js
// Собирает: название, URL сайта, регистрационный номер (company code)

const puppeteer = require('puppeteer');
const db = require('../shared/db');
const log = require('../shared/logger')('scraper');

const REKVIZITAI_BASE_URL = 'https://rekvizitai.lt';
const SEARCH_URL = `${REKVIZITAI_BASE_URL}/en/search/`;

async function scrapeNiche(searchTerm, nicheId) {
  let browser;
  const collectedCompanies = [];
  let companiesNew = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);

    await log.info(`Запуск парсинга: ${searchTerm} (nicheId: ${nicheId})`);

    // Переходим на страницу поиска с поисковым запросом
    const searchUrl = `${SEARCH_URL}?search=${encodeURIComponent(searchTerm)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Получаем количество страниц
    let pageCount = 1;
    try {
      const paginationText = await page.$eval('.pagination', el => el.textContent);
      const match = paginationText.match(/of (\d+)/);
      if (match) {
        pageCount = parseInt(match[1]);
      }
    } catch (e) {
      // Нет пагинации или она не найдена — одна страница
    }

    pageCount = Math.min(pageCount, 50); // лимит 50 страниц = ~1000 компаний
    await log.info(`Найдено ${pageCount} страниц для ${searchTerm}`);

    // Парсим каждую страницу
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        // Если не первая страница — переходим на неё
        if (pageNum > 1) {
          const nextUrl = `${searchUrl}&page=${pageNum}`;
          await page.goto(nextUrl, { waitUntil: 'networkidle2' });
        }

        // Парсим компании на странице
        const companies = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('.company-row, [data-company-id]'));
          return rows.map(row => {
            try {
              // Пробуем разные селекторы в зависимости от структуры rekvizitai.lt
              const nameEl = row.querySelector('.company-name, .name, h2, a[href*="/company/"]');
              const linkEl = row.querySelector('a[href*="/company/"], a[href*="/en/company/"]');
              const codeEl = row.querySelector('.company-code, .code, [data-company-code]');

              if (!nameEl && !linkEl) return null;

              const name = nameEl?.textContent?.trim() || linkEl?.textContent?.trim() || '';
              const companyUrl = linkEl?.getAttribute('href') || '';
              const code = codeEl?.textContent?.trim() || '';

              // Полный URL, если относительный
              const fullUrl = companyUrl.startsWith('http')
                ? companyUrl
                : companyUrl
                  ? `${REKVIZITAI_BASE_URL}${companyUrl}`
                  : '';

              return {
                name: name.substring(0, 255),
                company_code: code.substring(0, 50),
                rekvizitai_url: fullUrl
              };
            } catch (e) {
              return null;
            }
          });
        });

        // Фильтруем null значения и дубликаты
        const validCompanies = companies.filter(c => c && c.name);
        const uniqueCompanies = Array.from(
          new Map(validCompanies.map(c => [c.company_code || c.name, c])).values()
        );

        await log.info(`Страница ${pageNum}/${pageCount}: найдено ${uniqueCompanies.length} компаний для ${searchTerm}`);

        // Вставляем в БД
        for (const company of uniqueCompanies) {
          try {
            const exists = await db.one(
              'SELECT id FROM companies WHERE company_code = $1 OR (niche_id = $2 AND name = $3)',
              [company.company_code || '', nicheId, company.name]
            );

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
      } catch (pageError) {
        await logger.log(
          'warn',
          'scraper',
          `Ошибка при парсинге страницы ${pageNum}: ${pageError.message}`
        );
      }
    }

    // Обновляем счётчик в таблице niches
    await db.query('UPDATE niches SET companies_found = companies_found + $1 WHERE id = $2', [
      collectedCompanies.length,
      nicheId
    ]);

    await log.info(`✅ Завершён парсинг ${searchTerm}: ${collectedCompanies.length} компаний (${companiesNew} новых)`);

    return {
      companiesFound: collectedCompanies.length,
      companiesNew: companiesNew,
      searchTerm: searchTerm
    };
  } catch (error) {
    await log.error(`Критическая ошибка при парсинге ${searchTerm}: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeNiche };

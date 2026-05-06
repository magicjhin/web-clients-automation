// МОДУЛЬ: parser/discover-niches.js
// ЧТО: Проходит все категории rekvizitai.vz.lt, считает фирмы, добавляет в niches если > MIN_COMPANIES
// КАК ЗАПУСТИТЬ: node scripts/parser/discover-niches.js
// ОПЦИИ: --min=500 (по умолчанию 500)

const puppeteer = require('puppeteer');
const db = require('../shared/db');

const BASE_URL = 'https://rekvizitai.vz.lt';
const args = process.argv.slice(2);
const minArg = args.find(a => a.startsWith('--min='));
const MIN_COMPANIES = minArg ? parseInt(minArg.split('=')[1]) : 500;

async function getCompanyCount(page, categoryKey) {
  const url = `${BASE_URL}/imones/${categoryKey}/1/`;
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    const count = await page.evaluate(() => {
      // Ищем текст с количеством результатов — обычно "Rasta: X įmonių" или похожее
      const bodyText = document.body.innerText;

      // Паттерн: число перед словом "įmonių" или "įmonės" или "rezultatų"
      const patterns = [
        /Rasta[:\s]+(\d[\d\s]*)\s*įmoni/i,
        /(\d[\d\s]*)\s*įmoni/i,
        /(\d[\d\s]*)\s*rezultat/i,
        /Iš viso[:\s]+(\d[\d\s]*)/i,
      ];

      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          const num = parseInt(match[1].replace(/\s/g, ''));
          if (!isNaN(num) && num > 0) return num;
        }
      }

      // Запасной вариант: считаем по пагинации
      const pagLinks = Array.from(document.querySelectorAll('.pagination a, [class*="pag"] a'));
      let maxPage = 1;
      for (const link of pagLinks) {
        const num = parseInt(link.textContent.trim());
        if (!isNaN(num) && num > maxPage) maxPage = num;
      }
      // ~50 компаний на страницу
      if (maxPage > 1) return maxPage * 50;

      // Считаем компании на текущей странице
      const links = document.querySelectorAll('a[href*="/imone/"]');
      return links.length;
    });

    return count || 0;
  } catch (e) {
    return -1;
  }
}

async function main() {
  console.log(`=== Поиск ниш с > ${MIN_COMPANIES} компаний ===\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    page.setDefaultNavigationTimeout(30000);

    // Получаем все категории
    console.log('Загружаю список категорий...');
    await page.goto(`${BASE_URL}/imones/`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const categories = await page.evaluate(() => {
      const result = [];
      const seen = new Set();
      const links = Array.from(document.querySelectorAll('a[href*="/imones/"]'));
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/imones\/([^/]+)\//);
        if (!match) continue;
        const key = match[1];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const name = link.textContent.trim();
        if (!name || name.length < 2) continue;
        result.push({ key, name });
      }
      return result;
    });

    console.log(`Найдено ${categories.length} категорий. Проверяю каждую...\n`);

    const qualified = [];
    let checked = 0;

    for (const cat of categories) {
      checked++;
      const count = await getCompanyCount(page, cat.key);
      const status = count >= MIN_COMPANIES ? '✅' : count === -1 ? '❌' : '  ';
      console.log(`${status} [${checked}/${categories.length}] ${cat.key}: ${count === -1 ? 'ошибка' : count}`);

      if (count >= MIN_COMPANIES) {
        qualified.push({ ...cat, count });
      }

      // Пауза чтобы не перегружать сайт
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n=== Найдено ${qualified.length} ниш с > ${MIN_COMPANIES} компаний ===\n`);

    // Добавляем в БД те которых ещё нет
    let added = 0;
    let skipped = 0;

    for (let i = 0; i < qualified.length; i++) {
      const cat = qualified[i];
      const exists = await db.one(
        'SELECT id FROM niches WHERE search_term = $1',
        [cat.key]
      );

      if (exists) {
        console.log(`⏭ Уже есть: ${cat.name} (${cat.key})`);
        skipped++;
      } else {
        await db.query(
          `INSERT INTO niches (name, search_term, ai_rank, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), NOW())`,
          [cat.name, cat.key, 100 + i]
        );
        console.log(`➕ Добавлено: ${cat.name} (${cat.key}) — ${cat.count} компаний`);
        added++;
      }
    }

    console.log(`\n=== Готово ===`);
    console.log(`Добавлено новых ниш: ${added}`);
    console.log(`Уже были в БД: ${skipped}`);

  } finally {
    await browser.close();
    await db.close();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

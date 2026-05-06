// МОДУЛЬ: parser/sync-categories.js
// ЧТО: Парсит все категории с rekvizitai.vz.lt и обновляет search_term в niches
// КАК ЗАПУСТИТЬ: node scripts/parser/sync-categories.js

const puppeteer = require('puppeteer');
const db = require('../shared/db');

const BASE_URL = 'https://rekvizitai.vz.lt';

async function fetchAllCategories() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    page.setDefaultNavigationTimeout(30000);

    console.log('Загружаю страницу категорий...');
    await page.goto(`${BASE_URL}/imones/`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const categories = await page.evaluate(() => {
      const result = [];
      const links = Array.from(document.querySelectorAll('a[href*="/imones/"]'));
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/imones\/([^/]+)\//);
        if (!match) continue;
        const key = match[1];
        if (!key || key === 'imones') continue;
        const name = link.textContent.trim();
        if (!name || name.length < 2) continue;
        result.push({ key, name });
      }
      // убираем дубли по key
      const seen = new Set();
      return result.filter(c => {
        if (seen.has(c.key)) return false;
        seen.add(c.key);
        return true;
      });
    });

    return categories;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Синхронизация категорий rekvizitai.vz.lt ===\n');

  let categories;
  try {
    categories = await fetchAllCategories();
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err.message);
    process.exit(1);
  }

  console.log(`Найдено ${categories.length} категорий на сайте:\n`);
  categories.forEach(c => console.log(`  ${c.key} → ${c.name}`));

  // Получаем все ниши из БД
  const niches = await db.many('SELECT id, name, search_term FROM niches ORDER BY ai_rank', []);
  console.log(`\nВсего ниш в БД: ${niches.length}\n`);

  let updated = 0;
  let notFound = 0;

  for (const niche of niches) {
    // Проверяем что текущий search_term реально существует на сайте
    const currentValid = categories.find(c => c.key === niche.search_term);
    if (currentValid) {
      console.log(`✅ [${niche.id}] ${niche.name} → ${niche.search_term} (OK)`);
      continue;
    }

    // Ищем подходящую категорию по совпадению слов в названии
    const nicheLower = niche.name.toLowerCase();
    const nicheWords = nicheLower.split(/\s+/).filter(w => w.length > 3);

    let bestMatch = null;
    let bestScore = 0;

    for (const cat of categories) {
      const catKeyLower = cat.key.toLowerCase();
      const catNameLower = cat.name.toLowerCase();
      let score = 0;
      for (const word of nicheWords) {
        if (catKeyLower.includes(word) || catNameLower.includes(word)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cat;
      }
    }

    if (bestMatch && bestScore > 0) {
      await db.query(
        'UPDATE niches SET search_term = $1, updated_at = NOW() WHERE id = $2',
        [bestMatch.key, niche.id]
      );
      console.log(`🔄 [${niche.id}] ${niche.name} → ${niche.search_term} ❌ → ${bestMatch.key} ✅`);
      updated++;
    } else {
      console.log(`❓ [${niche.id}] ${niche.name} → ${niche.search_term} (не найдено совпадений)`);
      notFound++;
    }
  }

  console.log(`\n=== Готово ===`);
  console.log(`Обновлено: ${updated}`);
  console.log(`Не найдено: ${notFound}`);
  console.log(`Без изменений: ${niches.length - updated - notFound}`);

  await db.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

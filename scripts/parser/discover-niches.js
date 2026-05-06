// МОДУЛЬ: parser/discover-niches.js
// ЧТО: Проходит все категории rekvizitai.vz.lt, считает фирмы, добавляет в niches если > MIN_COMPANIES
// КАК ЗАПУСТИТЬ: node scripts/parser/discover-niches.js [--min=500]

const puppeteer = require('puppeteer');
const db = require('../shared/db');

const BASE_URL = 'https://rekvizitai.vz.lt';

const discoverState = {
  active: false,
  currentCategory: '',
  checked: 0,
  total: 0,
  found: 0,
  added: 0,
  startedAt: null,
};

function getDiscoverState() {
  return { ...discoverState };
}

function resetDiscoverState() {
  discoverState.active = false;
  discoverState.currentCategory = '';
  discoverState.checked = 0;
  discoverState.total = 0;
  discoverState.found = 0;
  discoverState.added = 0;
  discoverState.startedAt = null;
}

async function getCompanyCount(page, categoryKey) {
  const url = `${BASE_URL}/imones/${categoryKey}/1/`;
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    const count = await page.evaluate(() => {
      const bodyText = document.body.innerText;
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
      // Запасной: пагинация * 50
      const pagLinks = Array.from(document.querySelectorAll('.pagination a, [class*="pag"] a'));
      let maxPage = 1;
      for (const link of pagLinks) {
        const num = parseInt(link.textContent.trim());
        if (!isNaN(num) && num > maxPage) maxPage = num;
      }
      if (maxPage > 1) return maxPage * 50;
      return document.querySelectorAll('a[href*="/imone/"]').length;
    });

    return count || 0;
  } catch (e) {
    return -1;
  }
}

async function discoverNiches(minCompanies = 500) {
  discoverState.active = true;
  discoverState.startedAt = new Date();
  discoverState.checked = 0;
  discoverState.total = 0;
  discoverState.found = 0;
  discoverState.added = 0;
  discoverState.currentCategory = 'загружаю список...';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    page.setDefaultNavigationTimeout(30000);

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

    discoverState.total = categories.length;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      discoverState.currentCategory = cat.name;
      discoverState.checked = i + 1;

      const count = await getCompanyCount(page, cat.key);

      if (count >= minCompanies) {
        discoverState.found++;
        const exists = await db.one('SELECT id FROM niches WHERE search_term = $1', [cat.key]);
        if (!exists) {
          await db.query(
            `INSERT INTO niches (name, search_term, ai_rank, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'pending', NOW(), NOW())`,
            [cat.name, cat.key, 100 + i]
          );
          discoverState.added++;
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const result = {
      total: categories.length,
      found: discoverState.found,
      added: discoverState.added,
    };

    resetDiscoverState();
    return result;

  } catch (err) {
    resetDiscoverState();
    throw err;
  } finally {
    await browser.close();
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const minArg = args.find(a => a.startsWith('--min='));
  const min = minArg ? parseInt(minArg.split('=')[1]) : 500;

  console.log(`=== Поиск ниш с > ${min} компаний ===`);
  const result = await discoverNiches(min);
  console.log(`Проверено: ${result.total}, найдено: ${result.found}, добавлено: ${result.added}`);
  await db.close();
}

if (require.main === module) {
  main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
}

module.exports = { discoverNiches, getDiscoverState };

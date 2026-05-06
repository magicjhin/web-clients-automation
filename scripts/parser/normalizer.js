// МОДУЛЬ: parser/normalizer.js
// ЧТО: Нормализация и очистка данных после парсинга — email, телефон, URL сайта
// КАК ЗАПУСТИТЬ: используется через parser/index.js после scrapeNiche()

const db = require('../shared/db');
const logger = require('../shared/logger');

// Регулярные выражения для валидации и парсинга
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /\+?370\d{8,9}|^[0-9\s\-\+\(\)]{8,20}$/;
const URL_REGEX = /^https?:\/\/|^www\./;

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();
  return EMAIL_REGEX.test(cleaned) ? cleaned : null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = phone
    .replace(/\s+/g, '')
    .replace(/\-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');

  // Проверяем литовский номер или корректный формат
  if (cleaned.startsWith('+370') || cleaned.startsWith('370')) {
    return cleaned.length >= 11 ? cleaned : null;
  }

  // Локальный литовский номер (начинается с 8)
  if (cleaned.startsWith('8') && cleaned.length >= 9) {
    return '370' + cleaned.substring(1);
  }

  return PHONE_REGEX.test(cleaned) ? cleaned : null;
}

function normalizeWebsite(website) {
  if (!website) return null;

  let url = website.trim().toLowerCase();

  // Удаляем протокол для проверки
  const withoutProtocol = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Базовая валидация домена
  if (!withoutProtocol.includes('.')) return null;

  // Добавляем https если нет протокола
  if (!url.startsWith('http')) {
    url = 'https://' + withoutProtocol;
  }

  try {
    new URL(url);
    return url;
  } catch (e) {
    return null;
  }
}

async function normalizeCompanyData(companyId) {
  try {
    const company = await db.one('SELECT * FROM companies WHERE id = $1', [companyId]);

    if (!company) return false;

    const updates = {};
    let changed = false;

    // Нормализуем email
    if (company.email) {
      const normalized = normalizeEmail(company.email);
      if (normalized !== company.email) {
        updates.email = normalized;
        changed = true;
      }
    }

    // Нормализуем телефон
    if (company.phone) {
      const normalized = normalizePhone(company.phone);
      if (normalized !== company.phone) {
        updates.phone = normalized;
        changed = true;
      }
    }

    // Нормализуем сайт
    if (company.website) {
      const normalized = normalizeWebsite(company.website);
      if (normalized !== company.website) {
        updates.website = normalized;
        changed = true;
      }
    }

    // Обновляем, если что-то изменилось
    if (changed) {
      const setClauses = Object.keys(updates)
        .map((key, idx) => `${key} = $${idx + 1}`)
        .join(', ');
      const values = [...Object.values(updates), companyId];

      await db.query(
        `UPDATE companies SET ${setClauses}, updated_at = NOW() WHERE id = $${Object.keys(updates).length + 1}`,
        values
      );

      return true;
    }

    return false;
  } catch (error) {
    await logger.log('error', 'normalizer', `Ошибка при нормализации компании #${companyId}: ${error.message}`);
    return false;
  }
}

async function normalizeNicheCompanies(nicheId, limit = null) {
  try {
    let query = 'SELECT id FROM companies WHERE niche_id = $1 AND status = $2';
    const values = [nicheId, 'raw'];

    if (limit) {
      query += ' LIMIT $3';
      values.push(limit);
    }

    const companies = await db.many(query, values);
    let normalized = 0;

    for (const company of companies) {
      const changed = await normalizeCompanyData(company.id);
      if (changed) normalized++;
    }

    await logger.log('info', 'normalizer', `Нормализовано ${normalized} из ${companies.length} компаний в нише #${nicheId}`);

    return {
      total: companies.length,
      normalized: normalized
    };
  } catch (error) {
    await logger.log('error', 'normalizer', `Ошибка при нормализации ниши #${nicheId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
  normalizeCompanyData,
  normalizeNicheCompanies
};

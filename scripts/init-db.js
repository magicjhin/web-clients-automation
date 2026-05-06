// СКРИПТ: инициализация базы данных с нишами
// КАК ЗАПУСТИТЬ: node scripts/init-db.js
// Выполняется после первого git pull на VPS — создаёт таблицы и загружает seed ниши

const fs = require('fs');
const path = require('path');
const db = require('./shared/db');
const logger = require('./shared/logger');

async function initDatabase() {
  try {
    console.log('🚀 Инициализация базы данных...');

    // 1. Выполняем init.sql (создание таблиц)
    const initSqlPath = path.join(__dirname, '../db/init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf-8');

    console.log('📝 Создание таблиц...');
    const statements = initSql.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.query(statement);
        } catch (e) {
          // Игнорируем ошибки IF NOT EXISTS
          if (!e.message.includes('already exists')) {
            console.error('Error:', e.message);
          }
        }
      }
    }

    console.log('✅ Таблицы созданы/проверены');

    // 2. Загружаем seed ниши
    console.log('📊 Загрузка seed ниш...');

    const nichesCount = await db.one('SELECT COUNT(*) as count FROM niches', []);

    if (nichesCount.count === 0) {
      const nichesData = [
        { name: 'Stomatologija (Odontologija)', search_term: 'stomatologija', ai_rank: 1 },
        { name: 'IT Konsultacijos ir Paslaugos', search_term: 'it konsultacijos', ai_rank: 2 },
        { name: 'Teisininkai ir Teisinės Paslaugos', search_term: 'teisininkai', ai_rank: 3 },
        { name: 'Dirbtuvės ir Techninės Paslaugos', search_term: 'automechanika', ai_rank: 4 },
        { name: 'Statybos Paslaugos', search_term: 'statyba', ai_rank: 5 },
        { name: 'Turizmą ir Apjungtų Paslaugų', search_term: 'turizmą operatoriai', ai_rank: 6 },
        { name: 'Apsaugos Paslaugos', search_term: 'apsaugos paslaugos', ai_rank: 7 },
        { name: 'Valymo Paslaugos', search_term: 'valymo paslaugos', ai_rank: 8 },
        { name: 'Marketingo ir Reklamos Agentūros', search_term: 'marketingo agentūra', ai_rank: 9 },
        { name: 'Grožio Paslaugos (Kirpyklai, Salionai)', search_term: 'grožio paslaugos', ai_rank: 10 }
      ];

      for (const niche of nichesData) {
        await db.query(
          `INSERT INTO niches (name, search_term, ai_rank, status) VALUES ($1, $2, $3, $4)`,
          [niche.name, niche.search_term, niche.ai_rank, 'pending']
        );
      }

      console.log(`✅ Загружено ${nichesData.length} ниш`);
    } else {
      console.log(`✅ Ниши уже загружены (${nichesCount.count} всего)`);
    }

    // 3. Проверяем таблицы
    console.log('🔍 Проверка структуры БД...');

    const tables = await db.many(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
      []
    );

    console.log('📋 Таблицы в БД:');
    tables.forEach(t => console.log(`   ✓ ${t.table_name}`));

    console.log('\n✨ Инициализация завершена успешно!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    await logger.log('error', 'init-db', `Критическая ошибка инициализации: ${error.message}`);
    process.exit(1);
  }
}

initDatabase();

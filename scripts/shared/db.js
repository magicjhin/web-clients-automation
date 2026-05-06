// МОДУЛЬ: shared/db.js
// ЧТО: PostgreSQL pool, query helper, transactions
// КАК ИСПОЛЬЗОВАТЬ: const { query, withTx } = require('./shared/db');

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
    connectionString: config.db.url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err);
});

async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const ms = Date.now() - start;
        if (ms > 1000) console.warn(`[db] slow query ${ms}ms: ${text.slice(0, 80)}`);
        return res;
    } catch (err) {
        console.error(`[db] query failed: ${text.slice(0, 80)}`, err.message);
        throw err;
    }
}

async function one(text, params) {
    const res = await query(text, params);
    return res.rows[0] || null;
}

async function many(text, params) {
    const res = await query(text, params);
    return res.rows;
}

async function withTx(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function close() {
    await pool.end();
}

module.exports = { pool, query, one, many, withTx, close };

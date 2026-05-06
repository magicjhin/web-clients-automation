#!/usr/bin/env node

const fs = require('fs');

const PAUSE_FILE = '/tmp/leadgen_paused.flag';

let db;

function getDb() {
  if (!db) db = require('../shared/db');
  return db;
}

function printMessage(message) {
  console.log(JSON.stringify({ message }));
}

function formatRows(rows, formatter, emptyMessage) {
  if (!rows.length) return emptyMessage;
  return rows.map(formatter).join('\n');
}

async function status() {
  const database = getDb();
  const stats = await database.one(`
    SELECT
      (SELECT COUNT(*) FROM niches WHERE status = 'pending') AS pending_niches,
      (SELECT COUNT(*) FROM niches WHERE status = 'parsing') AS parsing_niches,
      (SELECT COUNT(*) FROM niches WHERE status = 'completed') AS completed_niches,
      (SELECT COUNT(*) FROM companies WHERE status = 'raw') AS raw_companies,
      (SELECT COUNT(*) FROM companies WHERE status = 'qualified') AS qualified_companies,
      (SELECT COUNT(*) FROM companies WHERE status = 'vip' OR is_vip = true) AS vip_companies,
      (SELECT COUNT(*) FROM logs WHERE level = 'error' AND created_at > NOW() - INTERVAL '24 hours') AS errors_24h
  `, []);

  const paused = fs.existsSync(PAUSE_FILE);
  printMessage([
    'Leadgen status',
    `Paused: ${paused ? 'yes' : 'no'}`,
    `Niches: pending ${stats.pending_niches}, parsing ${stats.parsing_niches}, completed ${stats.completed_niches}`,
    `Companies: raw ${stats.raw_companies}, qualified ${stats.qualified_companies}, VIP ${stats.vip_companies}`,
    `Errors 24h: ${stats.errors_24h}`,
  ].join('\n'));
}

async function niches() {
  const database = getDb();
  const rows = await database.many(`
    SELECT id, ai_rank, name, search_term, companies_found, companies_qualified, status
    FROM niches
    ORDER BY ai_rank NULLS LAST, id
    LIMIT 10
  `, []);

  printMessage('Top niches\n' + formatRows(
    rows,
    row => `[${row.id}] #${row.ai_rank || '-'} ${row.name} (${row.status}) found=${row.companies_found} qualified=${row.companies_qualified}\n    ${row.search_term}`,
    'No niches found'
  ));
}

async function history() {
  const database = getDb();
  const rows = await database.many(`
    SELECT ph.id, n.name AS niche, ph.started_at, ph.finished_at, ph.companies_found, ph.companies_new, ph.status, ph.error
    FROM parse_history ph
    LEFT JOIN niches n ON n.id = ph.niche_id
    ORDER BY ph.started_at DESC
    LIMIT 5
  `, []);

  printMessage('Parse history\n' + formatRows(
    rows,
    row => `#${row.id} ${row.status} ${row.niche || 'unknown niche'} found=${row.companies_found} new=${row.companies_new}${row.error ? ` error=${row.error}` : ''}`,
    'No parse history yet'
  ));
}

async function logs() {
  const database = getDb();
  const rows = await database.many(`
    SELECT level, module, message, created_at
    FROM logs
    ORDER BY created_at DESC
    LIMIT 8
  `, []);

  printMessage('Latest logs\n' + formatRows(
    rows,
    row => `[${row.level}] ${row.module || '-'}: ${row.message}`,
    'No logs yet'
  ));
}

async function calls() {
  const database = getDb();
  const rows = await database.many(`
    SELECT id, name, phone, email, website, vip_score
    FROM companies
    WHERE call_required = true AND called_at IS NULL
    ORDER BY vip_score DESC NULLS LAST, id
    LIMIT 10
  `, []);

  printMessage('Calls queue\n' + formatRows(
    rows,
    row => `#${row.id} ${row.name} score=${row.vip_score || 0} phone=${row.phone || '-'} email=${row.email || '-'}`,
    'No companies waiting for calls'
  ));
}

async function pause() {
  fs.writeFileSync(PAUSE_FILE, new Date().toISOString());
  printMessage('Paused flag saved. Scheduled scripts should check /tmp/leadgen_paused.flag before processing.');
}

async function resume() {
  if (fs.existsSync(PAUSE_FILE)) fs.unlinkSync(PAUSE_FILE);
  printMessage('Paused flag removed. Leadgen can continue.');
}

async function main() {
  const cmd = (process.argv[2] || 'help').toLowerCase();

  if (cmd === 'status') await status();
  else if (cmd === 'niches') await niches();
  else if (cmd === 'history') await history();
  else if (cmd === 'logs') await logs();
  else if (cmd === 'calls') await calls();
  else if (cmd === 'pause') await pause();
  else if (cmd === 'resume') await resume();
  else printMessage('Commands: /status, /niches, /parse, /parse 1, /parse auto, /filter, /run, /pause, /resume, /history, /logs, /calls');
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (db) return db.close();
  });

#!/usr/bin/env node
// Import n8n workflows via API
// Загружает все 6 воркфлоу в n8n
// Запуск: node scripts/import-workflows.js

const fs = require('fs');
const path = require('path');

const N8N_URL = process.env.N8N_URL || 'http://178.104.253.76:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

const workflows = [
  'n8n/01-telegram-bot.json',
  'n8n/02-parser.json',
  'n8n/03-filter.json',
  'n8n/04-audit.json',
  'n8n/05-followup.json',
  'n8n/06-imap.json'
];

async function importWorkflow(filePath) {
  try {
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`📥 Importing: ${path.basename(filePath)}`);

    const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY && { 'X-N8N-API-KEY': N8N_API_KEY })
      },
      body: JSON.stringify({
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings || { executionOrder: 'v1' },
        active: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ ${workflow.name} (ID: ${result.id})`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to import ${filePath}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`🚀 Starting import to n8n (${N8N_URL})\n`);

  let imported = 0;
  for (const file of workflows) {
    const result = await importWorkflow(file);
    if (result) imported++;
  }

  console.log(`\n✨ Complete: ${imported}/${workflows.length} workflows imported`);
  console.log('💡 Visit n8n UI to activate workflows');
}

main().catch(console.error);

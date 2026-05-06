#!/usr/bin/env node

// МОДУЛЬ: deploy-workflows.js
// ЧТО: Автоматический импорт и активация всех n8n workflow'ов
// КАК ЗАПУСТИТЬ: node scripts/deploy-workflows.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const N8N_URL = process.env.N8N_URL || 'http://178.104.253.76:5678';
const N8N_TOKEN = process.env.N8N_TOKEN;

if (!N8N_TOKEN) {
  console.error('❌ Error: N8N_TOKEN not set in environment variables');
  process.exit(1);
}

const workflows = [
  '01-telegram-bot.json',
  '02-parser.json',
  '03-filter.json',
  '04-audit-email.json',
  '05-followup-email.json',
  '06-imap-listener.json'
];

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : require('http');

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_TOKEN
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function importWorkflow(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = JSON.parse(content);
    const fileName = path.basename(filePath);

    console.log(`📥 Importing ${fileName}...`);

    const response = await makeRequest('POST', '/api/v1/workflows', workflow);

    if (response.status !== 200 && response.status !== 201) {
      console.error(`  ❌ Failed: ${response.status}`, response.data);
      return null;
    }

    const workflowId = response.data.id;
    console.log(`  ✅ Imported as ID: ${workflowId}`);

    // Activate workflow
    console.log(`  🔄 Activating...`);
    const activateResponse = await makeRequest('PATCH', `/api/v1/workflows/${workflowId}`, {
      active: true
    });

    if (activateResponse.status === 200 || activateResponse.status === 201) {
      console.log(`  ✅ Activated`);
    } else {
      console.error(`  ⚠️  Activation response: ${activateResponse.status}`);
    }

    return workflowId;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function deployAllWorkflows() {
  console.log('🚀 Starting n8n workflow deployment...\n');

  const workflowDir = path.join(__dirname, '..', 'n8n');
  const imported = [];

  for (const file of workflows) {
    const filePath = path.join(workflowDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file}`);
      continue;
    }

    const id = await importWorkflow(filePath);
    if (id) imported.push({ file, id });
    console.log('');
  }

  console.log('\n📊 Deployment Summary');
  console.log('='.repeat(50));
  console.log(`✅ Successfully imported: ${imported.length}/${workflows.length}`);

  if (imported.length > 0) {
    console.log('\nWorkflows:');
    imported.forEach(w => console.log(`  • ${w.file} → ID: ${w.id}`));
  }

  console.log('\n🔗 Next steps:');
  console.log('1. Configure Telegram Bot credentials in n8n');
  console.log('2. Set webhook URL in Telegram Bot API');
  console.log('3. Verify workflows in n8n Dashboard');
  console.log('\n✨ Done!');
}

deployAllWorkflows().catch(console.error);

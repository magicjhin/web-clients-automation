#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const N8N_URL = process.env.N8N_URL || 'http://178.104.253.76:5678';
const N8N_TOKEN = process.env.N8N_TOKEN;

if (!N8N_TOKEN) {
  console.error('❌ N8N_TOKEN not set');
  process.exit(1);
}

const workflows = [
  '01-telegram-bot.json',
  '02-parser.json',
  '03-filter.json',
  '04-audit.json',
  '05-followup.json',
  '06-imap.json'
];

function makeRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, N8N_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

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
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    const workflow = JSON.parse(content);
    const fileName = path.basename(filePath);

    console.log(`📥 Importing ${fileName}...`);

    const response = await makeRequest('POST', '/api/v1/workflows', workflow);

    if (response.status !== 200 && response.status !== 201) {
      console.error(`  ❌ Failed: ${response.status}`, JSON.stringify(response.data, null, 2));
      return null;
    }

    const workflowId = response.data.id;
    console.log(`  ✅ Imported as ID: ${workflowId}`);

    console.log(`  🔄 Activating...`);
    const activateResponse = await makeRequest('PATCH', `/api/v1/workflows/${workflowId}`, {
      active: true
    });

    if (activateResponse.status === 200 || activateResponse.status === 201) {
      console.log(`  ✅ Activated`);
    } else {
      console.error(`  ⚠️ Activation failed: ${activateResponse.status}`);
    }

    return workflowId;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function deployAllWorkflows() {
  console.log('🚀 Starting workflow import...\n');

  const workflowDir = path.join(__dirname, '..', 'n8n');
  const imported = [];

  for (const file of workflows) {
    const filePath = path.join(workflowDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${file}`);
      continue;
    }

    const id = await importWorkflow(filePath);
    if (id) imported.push({ file, id });
    console.log('');
  }

  console.log('\n📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Imported: ${imported.length}/${workflows.length}`);

  if (imported.length > 0) {
    console.log('\nWorkflows:');
    imported.forEach(w => console.log(`  • ${w.file} → ID: ${w.id}`));
  }

  console.log('\n✨ Done!');
}

deployAllWorkflows().catch(console.error);

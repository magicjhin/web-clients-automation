#!/usr/bin/env node

// МОДУЛЬ: setup-workflows.js
// ЧТО: Создание и активация всех n8n workflow'ов через API
// КАК ЗАПУСТИТЬ: node scripts/setup-workflows.js

const https = require('https');
const http = require('http');
const url = require('url');

const N8N_URL = process.env.N8N_URL || 'http://178.104.253.76:5678';
const N8N_TOKEN = process.env.N8N_TOKEN;

if (!N8N_TOKEN) {
  console.error('❌ N8N_TOKEN not set');
  process.exit(1);
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new url.URL(path, N8N_URL);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_TOKEN
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data || null });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function deleteWorkflow(id) {
  try {
    await makeRequest('DELETE', `/api/v1/workflows/${id}`);
    console.log(`  ✓ Deleted old workflow ${id}`);
  } catch (e) {
    // ignore
  }
}

async function listWorkflows() {
  try {
    const res = await makeRequest('GET', '/api/v1/workflows?limit=100');
    return res.data.data || [];
  } catch (e) {
    console.error('Failed to list workflows:', e.message);
    return [];
  }
}

// Workflow definitions
const workflows = {
  'telegram-bot': {
    name: 'Telegram Bot - Command Router',
    description: 'Main Telegram command interface',
    nodes: [
      {
        id: 'webhook-telegram',
        name: 'Webhook - Telegram',
        type: 'n8n-nodes-base.webhook',
        position: [250, 300],
        parameters: {
          path: 'telegram-bot',
          authentication: 'headerAuth',
          options: {}
        }
      },
      {
        id: 'extract-msg',
        name: 'Extract Message',
        type: 'n8n-nodes-base.function',
        position: [450, 300],
        parameters: {
          functionCode: `const msg = $input.first().json.message;
return {
  json: {
    text: msg.text || '',
    chatId: msg.chat.id,
    userId: msg.from.id,
    messageId: msg.message_id
  }
};`
        }
      },
      {
        id: 'switch-cmd',
        name: 'Switch - Command Router',
        type: 'n8n-nodes-base.switch',
        position: [650, 300],
        parameters: {
          mode: 'expression',
          expression: `={{
  "/parse": ($json.text.includes("/parse")),
  "/status": ($json.text.includes("/status")),
  "/stats": ($json.text.includes("/stats")),
  "/help": ($json.text.includes("/help"))
}}`
        }
      },
      {
        id: 'exec-parse',
        name: 'Execute - Parse List',
        type: 'n8n-nodes-execute-command-plus',
        position: [850, 100],
        parameters: {
          command: 'cd /opt/leadgen && node scripts/parser/index.js --list'
        }
      },
      {
        id: 'exec-status',
        name: 'Execute - Status',
        type: 'n8n-nodes-execute-command-plus',
        position: [850, 250],
        parameters: {
          command: 'cd /opt/leadgen && node scripts/parser/index.js --status'
        }
      },
      {
        id: 'exec-stats',
        name: 'Execute - Stats',
        type: 'n8n-nodes-execute-command-plus',
        position: [850, 400],
        parameters: {
          command: 'cd /opt/leadgen && node scripts/parser/index.js --stats'
        }
      },
      {
        id: 'format-help',
        name: 'Format - Help Message',
        type: 'n8n-nodes-base.function',
        position: [850, 550],
        parameters: {
          functionCode: `return {
  json: {
    text: '🤖 *Leadgen Bot*\\n\\n*Команды:*\\n📊 /parse\\n📊 /parse 1\\n🔄 /parse auto\\n📈 /status\\n📋 /stats\\n❓ /help'
  }
};`
        }
      },
      {
        id: 'format-response',
        name: 'Format - Response',
        type: 'n8n-nodes-base.function',
        position: [1050, 300],
        parameters: {
          functionCode: `let result = $input.first().json;
let text = '';
if (typeof result === 'string') {
  text = result;
} else if (result.message) {
  text = result.message;
} else if (result.error) {
  text = 'Error: ' + result.error;
} else {
  text = JSON.stringify(result, null, 2);
}
return {
  json: {
    text: text,
    chatId: $node['Extract Message'].json.chatId
  }
};`
        }
      },
      {
        id: 'send-telegram',
        name: 'Send - Telegram Message',
        type: 'n8n-nodes-base.telegram',
        position: [1250, 300],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '{{ $node[\'Format - Response\'].json.text }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Webhook - Telegram': [[{ node: 'Extract Message', type: 'main', index: 0 }]],
      'Extract Message': [[{ node: 'Switch - Command Router', type: 'main', index: 0 }]],
      'Switch - Command Router': [
        [{ node: 'Execute - Parse List', type: 'main', index: 0 }],
        [{ node: 'Execute - Status', type: 'main', index: 0 }],
        [{ node: 'Execute - Stats', type: 'main', index: 0 }],
        [{ node: 'Format - Help Message', type: 'main', index: 0 }]
      ],
      'Execute - Parse List': [[{ node: 'Format - Response', type: 'main', index: 0 }]],
      'Execute - Status': [[{ node: 'Format - Response', type: 'main', index: 0 }]],
      'Execute - Stats': [[{ node: 'Format - Response', type: 'main', index: 0 }]],
      'Format - Help Message': [[{ node: 'Format - Response', type: 'main', index: 0 }]],
      'Format - Response': [[{ node: 'Send - Telegram Message', type: 'main', index: 0 }]]
    }
  },
  'parser': {
    name: 'Parser - Manual Trigger',
    nodes: [
      {
        id: 'manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        position: [250, 300],
        parameters: { triggerTip: '' }
      },
      {
        id: 'exec-parser',
        name: 'Execute - Parser',
        type: 'n8n-nodes-execute-command-plus',
        position: [450, 300],
        parameters: { command: 'cd /opt/leadgen && node scripts/parser/index.js --list' }
      },
      {
        id: 'parse-json',
        name: 'Parse JSON',
        type: 'n8n-nodes-base.function',
        position: [650, 300],
        parameters: {
          functionCode: `let result = {};
try {
  const stdout = $input.first().json.stdout;
  if (stdout) {
    result = JSON.parse(stdout);
  } else {
    result = { message: 'Parser completed' };
  }
} catch (e) {
  result = { message: $input.first().json.stdout || 'Error' };
}
return { json: result };`
        }
      },
      {
        id: 'send-telegram',
        name: 'Send Telegram',
        type: 'n8n-nodes-base.telegram',
        position: [850, 300],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '{{ JSON.stringify($node[\'Parse JSON\'].json, null, 2) }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Manual Trigger': [[{ node: 'Execute - Parser', type: 'main', index: 0 }]],
      'Execute - Parser': [[{ node: 'Parse JSON', type: 'main', index: 0 }]],
      'Parse JSON': [[{ node: 'Send Telegram', type: 'main', index: 0 }]]
    }
  },
  'filter': {
    name: 'Filter - Manual Trigger',
    nodes: [
      {
        id: 'manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        position: [250, 300],
        parameters: { triggerTip: '' }
      },
      {
        id: 'exec-filter',
        name: 'Execute - Filter',
        type: 'n8n-nodes-execute-command-plus',
        position: [450, 300],
        parameters: { command: 'cd /opt/leadgen && node scripts/filter/index.js --limit=100' }
      },
      {
        id: 'parse-json',
        name: 'Parse JSON',
        type: 'n8n-nodes-base.function',
        position: [650, 300],
        parameters: {
          functionCode: `let result = {};
try {
  const stdout = $input.first().json.stdout;
  if (stdout) {
    result = JSON.parse(stdout);
  } else {
    result = { message: 'Filter completed' };
  }
} catch (e) {
  result = { message: $input.first().json.stdout || 'Error' };
}
return { json: result };`
        }
      },
      {
        id: 'send-telegram',
        name: 'Send Telegram',
        type: 'n8n-nodes-base.telegram',
        position: [850, 300],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '✅ Filter completed\\n{{ JSON.stringify($node[\'Parse JSON\'].json, null, 2) }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Manual Trigger': [[{ node: 'Execute - Filter', type: 'main', index: 0 }]],
      'Execute - Filter': [[{ node: 'Parse JSON', type: 'main', index: 0 }]],
      'Parse JSON': [[{ node: 'Send Telegram', type: 'main', index: 0 }]]
    }
  },
  'audit': {
    name: 'Audit & Email - Cron 09:00',
    nodes: [
      {
        id: 'cron-09',
        name: 'Cron - 09:00',
        type: 'n8n-nodes-base.cron',
        position: [250, 300],
        parameters: {
          mode: 'cron',
          cronExpression: '0 9 * * *',
          timezone: 'Europe/Vilnius'
        }
      },
      {
        id: 'exec-audit',
        name: 'Execute - Audit',
        type: 'n8n-nodes-execute-command-plus',
        position: [450, 300],
        parameters: { command: 'cd /opt/leadgen && node scripts/audit/index.js --batch=15' }
      },
      {
        id: 'parse-json',
        name: 'Parse JSON',
        type: 'n8n-nodes-base.function',
        position: [650, 300],
        parameters: {
          functionCode: `let result = {};
try {
  const stdout = $input.first().json.stdout;
  if (stdout) {
    result = JSON.parse(stdout);
  } else {
    result = { message: 'Audit completed' };
  }
} catch (e) {
  result = { message: $input.first().json.stdout || 'Error' };
}
return { json: result };`
        }
      },
      {
        id: 'send-telegram',
        name: 'Send Telegram',
        type: 'n8n-nodes-base.telegram',
        position: [850, 300],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '📧 Audit completed (09:00)\\n{{ JSON.stringify($node[\'Parse JSON\'].json, null, 2) }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Cron - 09:00': [[{ node: 'Execute - Audit', type: 'main', index: 0 }]],
      'Execute - Audit': [[{ node: 'Parse JSON', type: 'main', index: 0 }]],
      'Parse JSON': [[{ node: 'Send Telegram', type: 'main', index: 0 }]]
    }
  },
  'followup': {
    name: 'Follow-up Email - Cron 10:00',
    nodes: [
      {
        id: 'cron-10',
        name: 'Cron - 10:00',
        type: 'n8n-nodes-base.cron',
        position: [250, 300],
        parameters: {
          mode: 'cron',
          cronExpression: '0 10 * * *',
          timezone: 'Europe/Vilnius'
        }
      },
      {
        id: 'exec-followup',
        name: 'Execute - Followup',
        type: 'n8n-nodes-execute-command-plus',
        position: [450, 300],
        parameters: { command: 'cd /opt/leadgen && node scripts/email/followup.js' }
      },
      {
        id: 'parse-json',
        name: 'Parse JSON',
        type: 'n8n-nodes-base.function',
        position: [650, 300],
        parameters: {
          functionCode: `let result = {};
try {
  const stdout = $input.first().json.stdout;
  if (stdout) {
    result = JSON.parse(stdout);
  } else {
    result = { message: 'Followup completed' };
  }
} catch (e) {
  result = { message: $input.first().json.stdout || 'Error' };
}
return { json: result };`
        }
      },
      {
        id: 'send-telegram',
        name: 'Send Telegram',
        type: 'n8n-nodes-base.telegram',
        position: [850, 300],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '📧 Followup emails sent (10:00)\\n{{ JSON.stringify($node[\'Parse JSON\'].json, null, 2) }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Cron - 10:00': [[{ node: 'Execute - Followup', type: 'main', index: 0 }]],
      'Execute - Followup': [[{ node: 'Parse JSON', type: 'main', index: 0 }]],
      'Parse JSON': [[{ node: 'Send Telegram', type: 'main', index: 0 }]]
    }
  },
  'imap': {
    name: 'IMAP Listener - Every 30 Min',
    nodes: [
      {
        id: 'cron-30',
        name: 'Cron - Every 30 Min',
        type: 'n8n-nodes-base.cron',
        position: [250, 300],
        parameters: {
          mode: 'every',
          interval: 30,
          triggerTip: ''
        }
      },
      {
        id: 'exec-imap',
        name: 'Execute - IMAP',
        type: 'n8n-nodes-execute-command-plus',
        position: [450, 300],
        parameters: { command: 'cd /opt/leadgen && node scripts/email/imap.js' }
      },
      {
        id: 'parse-json',
        name: 'Parse JSON',
        type: 'n8n-nodes-base.function',
        position: [650, 300],
        parameters: {
          functionCode: `let result = {};
const stdout = $input.first().json.stdout || '';
const stderr = $input.first().json.stderr || '';
try {
  if (stdout) {
    result = JSON.parse(stdout);
  } else if (stderr && stderr.includes('error')) {
    result = { error: stderr, hasError: true };
  } else {
    result = { message: 'IMAP check completed', hasError: false };
  }
} catch (e) {
  result = { message: stdout || 'IMAP completed', hasError: stderr ? true : false };
}
return { json: result };`
        }
      },
      {
        id: 'if-error',
        name: 'If Error',
        type: 'n8n-nodes-base.if',
        position: [850, 300],
        parameters: {
          conditions: {
            conditions: [{ key: 'hasError', condition: 'equals', value: true }]
          }
        }
      },
      {
        id: 'send-error',
        name: 'Send Error Alert',
        type: 'n8n-nodes-base.telegram',
        position: [1050, 200],
        parameters: {
          authentication: 'predefinedCredentialType',
          credentialType: 'telegramBotApi',
          resource: 'message',
          chatId: '5900706320',
          text: '⚠️ IMAP Error\\n{{ JSON.stringify($node[\'Parse JSON\'].json.error) }}',
          parseMode: 'Markdown'
        }
      }
    ],
    connections: {
      'Cron - Every 30 Min': [[{ node: 'Execute - IMAP', type: 'main', index: 0 }]],
      'Execute - IMAP': [[{ node: 'Parse JSON', type: 'main', index: 0 }]],
      'Parse JSON': [[{ node: 'If Error', type: 'main', index: 0 }]],
      'If Error': [[{ node: 'Send Error Alert', type: 'main', index: 0 }]]
    }
  }
};

async function createWorkflow(key, config) {
  try {
    console.log(`\n📝 Creating "${config.name}"...`);

    const workflowData = {
      name: config.name,
      nodes: config.nodes,
      connections: config.connections,
      settings: { executionOrder: 'v1' }
    };

    const res = await makeRequest('POST', '/api/v1/workflows', workflowData);

    if (res.status === 201 || res.status === 200) {
      const id = res.data.id;
      console.log(`✅ Created: ${id}`);

      // Activate it
      setTimeout(async () => {
        const activateRes = await makeRequest('PATCH', `/api/v1/workflows/${id}`, { active: true });
        if (activateRes.status === 200) {
          console.log(`   🟢 Activated`);
        }
      }, 500);

      return id;
    } else {
      console.error(`❌ Failed: ${res.status}`, res.data?.message || res.data);
      return null;
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 n8n Workflow Setup\n');

  // Clean up old workflows
  console.log('🧹 Cleaning up old workflows...');
  const existing = await listWorkflows();
  for (const wf of existing) {
    if (wf.name.includes('Telegram Bot') || wf.name.includes('Parser')) {
      await deleteWorkflow(wf.id);
    }
  }

  // Create new workflows
  const created = [];
  for (const [key, config] of Object.entries(workflows)) {
    const id = await createWorkflow(key, config);
    if (id) created.push({ name: config.name, id });
  }

  console.log('\n📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Created: ${created.length}/${Object.keys(workflows).length}`);
  if (created.length > 0) {
    created.forEach(w => console.log(`  • ${w.name}`));
  }
  console.log('\n✨ Done!');
}

main().catch(console.error);

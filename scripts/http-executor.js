#!/usr/bin/env node
// HTTP Executor — простой Express сервер для выполнения скриптов из n8n
// Принимает POST /execute с command и параметрами, выполняет на VPS
// Запуск: node scripts/http-executor.js

const express = require('express');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.HTTP_EXECUTOR_PORT || 3333;

app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => {
  console.log('[HEALTH] Check');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Execute command via HTTP
app.post('/execute', async (req, res) => {
  try {
    const { command, args = {} } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    console.log(`[EXECUTE] ${command}`, args);

    // Build command with args
    let fullCommand = `cd /opt/leadgen && ${command}`;
    if (Object.keys(args).length > 0) {
      Object.entries(args).forEach(([key, value]) => {
        fullCommand += ` --${key}=${value}`;
      });
    }

    // Execute and capture output
    let stdout = '';
    let stderr = '';

    try {
      stdout = execSync(fullCommand, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 60000 // 60 seconds
      });
    } catch (err) {
      stderr = err.stderr || err.message;
      stdout = err.stdout || '';
    }

    // Try to parse JSON output
    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      result = { message: stdout || 'Command executed', raw: stdout };
    }

    if (stderr && stderr.length > 0) {
      result.error = stderr;
    }

    console.log(`[EXECUTED] ${command}`);
    res.json(result);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`HTTP Executor listening on port ${PORT}`);
});

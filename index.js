'use strict';
const express = require('express');
const path    = require('path');

const app   = express();
const MODEL = process.env.MODEL_ID || 'claude-opus-4-7';

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured — running in demo mode' });
  }
  try {
    const payload = {
      model:      req.body.model      || MODEL,
      max_tokens: Math.min(req.body.max_tokens || 4000, 8192),
      messages:   req.body.messages
    };
    if (req.body.system) payload.system = req.body.system;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[/api/claude]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '17', model: MODEL, api: !!process.env.ANTHROPIC_API_KEY });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nGRIT Sandbox v17`);
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Model   : ${MODEL}`);
  console.log(`→ API key : ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ not set  (demo mode only)'}\n`);
});

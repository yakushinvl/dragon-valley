// src/routes.js — все API-маршруты

const express = require('express');
const { generateExpression } = require('./expressions');
const https = require('https');

const router = express.Router();

const VALID_TYPES = ['math', 'russian', 'logic', 'world'];
const XP_REWARD   = 30;
const MAX_LEVEL   = 5;

// queries передаётся из server.js после initDb()
let Q = null;
function setQueries(queries) { Q = queries; }

// GET /dragons
router.get('/dragons', (req, res) => {
  res.json(Q.getAllDragons());
});

// GET /task/:type
router.get('/task/:type', (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type))
    return res.status(400).json({ error: 'Недопустимый тип дракона' });

  // ── Математика: ребёнок сам решает пример ───────────────────────────
  if (type === 'math') {
    const { expression, answer } = generateExpression();
    Q.upsertVerification('math', expression, answer);
    return res.json({
      task:       `Реши пример: ${expression}`,
      expression,
      task_kind:  'math',
      read_text:  null,
      photo_task: null,
    });
  }

  // ── Остальные типы: задание из БД, проверка взрослым/ИИ ────────────
  const tasks = Q.getTasksByType(type);
  if (!tasks.length)
    return res.status(404).json({ error: 'Заданий не найдено' });

  const task = tasks[Math.floor(Math.random() * tasks.length)];
  let task_kind = task.task_kind || 'normal';
  // Обычные задания (не чтение и не фото) теперь проверяются ИИ по тексту
  if (task_kind === 'normal') task_kind = 'text';

  // Для text-заданий expression больше не нужен — храним как метку
  const { expression, answer } = generateExpression();
  Q.upsertVerification(type, expression, answer);

  res.json({
    task:       task.text,
    expression: task_kind === 'text' ? null : expression,
    task_kind,
    read_text:  task.read_text  || null,
    photo_task: task.photo_task || null,
  });
});

// POST /complete
router.post('/complete', (req, res) => {
  const { type, answer } = req.body;
  if (!type || answer === undefined)
    return res.status(400).json({ error: 'Нужны поля type и answer' });

  const v = Q.getVerification();
  if (!v) return res.status(400).json({ error: 'Нет активного задания' });
  if (v.type !== type)
    return res.status(400).json({ correct: false, message: 'Тип дракона не совпадает' });

  const userAnswer = parseFloat(String(answer).replace(',', '.'));
  const correct    = Math.abs(userAnswer - v.answer) < 0.01;
  if (!correct) {
    Q.incWrong(type);
    return res.json({ correct: false, message: 'Неверный ответ. Попробуй ещё раз!' });
  }

  const d = Q.getDragon(type);
  let { level, xp } = d;
  xp += XP_REWARD;
  while (xp >= 100 && level < MAX_LEVEL) { xp -= 100; level++; }
  if (level >= MAX_LEVEL) xp = Math.min(xp, 99);
  Q.updateDragon(level, xp, type);
  Q.incCorrect(type);

  const updated = Q.getDragon(type);
  res.json({ correct: true, message: 'Отлично! Задание выполнено!', dragon: updated, xpGained: XP_REWARD });
});

// GET /progress
router.get('/progress', (req, res) => {
  const { total } = Q.sumLevels();
  res.json({ totalLevels: total });
});

// ── Утилита: вызов OpenRouter (текстовая проверка ответа) ────────────────────
function callOpenRouter(messages, { model = 'meta-llama/llama-3.3-70b-instruct:free', maxTokens = 250 } = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY || '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';
    const body = JSON.stringify({ model, max_tokens: maxTokens, messages });
    const opts = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer':  'http://localhost:3000',
        'X-Title':       'Dragon Meadow',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const r = https.request(opts, resp => {
      let data = '';
      resp.on('data', ch => { data += ch; });
      resp.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j?.choices?.[0]?.message?.content || '');
        } catch (e) { reject(new Error('Bad LLM response: ' + e.message)); }
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

// POST /verify-text — ребёнок ввёл развёрнутый ответ на задание (русский/логика/мир)
router.post('/verify-text', async (req, res) => {
  const { type, task, answer } = req.body || {};
  if (!type || !task || !answer)
    return res.status(400).json({ error: 'Нужны поля type, task, answer' });
  if (!VALID_TYPES.includes(type))
    return res.status(400).json({ error: 'Недопустимый тип' });

  const prompt =
    `Ты — добрый помощник в детской образовательной игре для ребёнка 6–11 лет.\n\n` +
    `Задание: "${task}"\n` +
    `Ответ ребёнка: "${answer}"\n\n` +
    `Оцени, выполнил ли ребёнок задание. Будь снисходителен — это ребёнок, ` +
    `допускай небольшие ошибки и неточности, главное — что ответ соответствует сути задания.\n\n` +
    `Ответь СТРОГО в формате JSON без лишнего текста:\n` +
    `{"done": true/false, "feedback": "1-2 коротких дружелюбных предложения на русском"}`;

  try {
    const text   = await callOpenRouter([{ role: 'user', content: prompt }]);
    const clean  = text.replace(/^```(?:json)?|```$/gm, '').trim();
    let result;
    try {
      result = JSON.parse(clean);
    } catch (_) {
      // Если модель вернула не-JSON — эвристика по тексту
      const ok = /выполнено|молодец|правильно|верно|отлично|справ/i.test(text);
      result = { done: ok, feedback: text.slice(0, 200) || 'Ответ принят' };
    }

    if (result.done) {
      const d = Q.getDragon(type);
      let { level, xp } = d;
      xp += XP_REWARD;
      while (xp >= 100 && level < MAX_LEVEL) { xp -= 100; level++; }
      if (level >= MAX_LEVEL) xp = Math.min(xp, 99);
      Q.updateDragon(level, xp, type);
      Q.incCorrect(type);
      return res.json({
        correct:  true,
        message:  result.feedback || 'Отлично! Задание выполнено!',
        dragon:   Q.getDragon(type),
        xpGained: XP_REWARD,
      });
    } else {
      Q.incWrong(type);
      return res.json({
        correct: false,
        message: result.feedback || 'Не совсем — попробуй ещё раз!',
      });
    }
  } catch (e) {
    return res.status(502).json({ error: 'Ошибка проверки ответа: ' + (e.message || e) });
  }
});

// POST /api/claude — прокси к OpenRouter API (бесплатные vision-модели, решает CORS)
router.post('/api/claude', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY || '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';


  // Берём тело как есть (формат Anthropic), конвертируем в OpenAI-совместимый формат OpenRouter
  const msg     = (req.body.messages || [])[0] || {};
  const content = Array.isArray(msg.content) ? msg.content : [];

  // Конвертируем content из формата Anthropic в формат OpenAI
  const openaiContent = content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'image' && part.source) {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${part.source.media_type};base64,${part.source.data}`
        }
      };
    }
    return null;
  }).filter(Boolean);

  const openrouterBody = JSON.stringify({
    model: 'meta-llama/llama-4-scout:free',  // бесплатная vision-модель
    max_tokens: 300,
    messages: [{ role: 'user', content: openaiContent }],
  });

  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Dragon Meadow',
      'Content-Length': Buffer.byteLength(openrouterBody),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => { data += chunk; });
    proxyRes.on('end', () => {
      try {
        const orResp = JSON.parse(data);
        // Конвертируем ответ OpenRouter → формат Anthropic, который ждёт app.js
        const text = orResp?.choices?.[0]?.message?.content || '';
        res.status(200).json({ content: [{ type: 'text', text }] });
      } catch (e) {
        res.status(500).json({ error: 'Ошибка разбора ответа OpenRouter: ' + e.message });
      }
    });
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Ошибка соединения с OpenRouter: ' + err.message });
  });

  proxyReq.write(openrouterBody);
  proxyReq.end();
});

module.exports = { router, setQueries };

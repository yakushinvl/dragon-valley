// app.js — вся логика фронтенда

// ─── Метаданные драконов ──────────────────────────────────────────────────────

const DRAGON_META = {
  math:    { emoji: '🔥', name: 'Дракон Математики', label: 'Математика' },
  russian: { emoji: '📘', name: 'Дракон Русского',   label: 'Русский' },
  logic:   { emoji: '⚡', name: 'Дракон Логики',     label: 'Логика' },
  world:   { emoji: '🌿', name: 'Дракон Природы',    label: 'Природа' },
};

// ─── Состояние ────────────────────────────────────────────────────────────────

let currentType      = null;
let currentTaskKind  = 'normal';
let currentTaskText  = '';
let currentReadText  = null;
let currentPhotoTask = null;

// ─── DOM: основные экраны ─────────────────────────────────────────────────────

const $totalLevels      = document.getElementById('total-levels');
const $dragonsContainer = document.getElementById('dragons-container');
const $backBtn          = document.getElementById('back-btn');
const $taskBadge        = document.getElementById('task-dragon-badge');
const $taskText         = document.getElementById('task-text');
const $expressionText   = document.getElementById('expression-text');
const $answerInput      = document.getElementById('answer-input');
const $answerTextarea   = document.getElementById('answer-textarea');
const $taskCard         = document.querySelector('.task-card');
const $confirmCard      = document.getElementById('confirm-card');
const $confirmLabel     = document.getElementById('confirm-label');
const $confirmHint      = document.getElementById('confirm-hint');
const $expressionBox    = document.getElementById('expression-box');
const $submitBtn        = document.getElementById('submit-btn');
const $resultCard       = document.getElementById('result-card');
const $resultEmoji      = document.getElementById('result-emoji');
const $resultTitle      = document.getElementById('result-title');
const $resultMsg        = document.getElementById('result-msg');
const $xpBadge          = document.getElementById('xp-badge');
const $nextBtn          = document.getElementById('next-btn');

// ─── DOM: карточка чтения ─────────────────────────────────────────────────────

const $readingCard     = document.getElementById('reading-card');
const $readText        = document.getElementById('read-text');
const $listenBtn       = document.getElementById('listen-btn');
const $recordBtn       = document.getElementById('record-btn');
const $recordingStatus = document.getElementById('recording-status');
const $liveTranscript  = document.getElementById('live-transcript');
const $speechResult    = document.getElementById('speech-result');
const $heardText       = document.getElementById('heard-text');
const $speechScore     = document.getElementById('speech-score');
const $speechWords     = document.getElementById('speech-words');
const $retryBtn        = document.getElementById('retry-btn');
const $confirmReadBtn  = document.getElementById('confirm-read-btn');

// ─── DOM: карточка фото ───────────────────────────────────────────────────────

const $photoCard        = document.getElementById('photo-card');
const $fileInput        = document.getElementById('file-input');
const $cameraInput      = document.getElementById('camera-input');
const $photoPreviewWrap = document.getElementById('photo-preview-wrap');
const $photoPreview     = document.getElementById('photo-preview');
const $photoRemoveBtn   = document.getElementById('photo-remove-btn');
const $photoStatus      = document.getElementById('photo-status');
const $photoCheckBtn    = document.getElementById('photo-check-btn');

// ─── Состояние распознавания ──────────────────────────────────────────────────

let recognition       = null;
let isRecording       = false;
let finalTranscript   = '';
let interimTranscript = '';
let restartTimer      = null;
let isSpeaking        = false;

// ─── Навигация ────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function resetTaskScreen() {
  $answerInput.value = '';
  $answerInput.className = 'answer-input';
  if ($answerTextarea) {
    $answerTextarea.value = '';
    $answerTextarea.className = 'answer-textarea';
  }
  $submitBtn.disabled = false;
  $submitBtn.textContent = 'Готово ✓';
  $resultCard.classList.remove('visible');
  $nextBtn.style.display = 'none';
  $taskText.textContent = '…';
  $expressionText.textContent = '…';
  // Возврат к дефолту confirm-card
  if ($confirmLabel) $confirmLabel.textContent = 'Подтверждение взрослого';
  if ($confirmHint)  $confirmHint.textContent  = 'Попроси взрослого вычислить выражение и введи ответ:';
  if ($expressionBox) $expressionBox.style.display = '';
  if ($taskCard) $taskCard.style.display = '';
  if ($confirmCard) $confirmCard.style.display = '';
  if ($answerInput) {
    $answerInput.style.display = '';
    $answerInput.type = 'number';
    $answerInput.placeholder = 'Ответ';
  }
  if ($answerTextarea) $answerTextarea.style.display = 'none';
  resetReadingState();
  resetPhotoState();
}

function goBack() {
  stopRecognition();
  resetTaskScreen();
  loadDragons();
  loadProgress();

  // Если есть карта — возвращаемся на неё.
  // Иначе fallback на старый экран дракон-сетки.
  const mapScreen = document.getElementById('map-screen');
  const taskArea  = document.getElementById('task-area');
  if (mapScreen && taskArea) {
    taskArea.style.display = 'none';
    mapScreen.style.display = '';      // снимаем inline display:none, оставляя CSS
    mapScreen.classList.add('active');
    window.dispatchEvent(new Event('resize'));
  } else {
    showScreen('screen-meadow');
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Поляна ───────────────────────────────────────────────────────────────────

async function loadDragons() {
  $dragonsContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Загружаем поляну…</div>';
  const dragons = await apiFetch('/dragons');
  renderDragons(dragons);
}

function renderDragons(dragons) {
  const grid = document.createElement('div');
  grid.className = 'dragons-grid';
  dragons.forEach(d => {
    const meta = DRAGON_META[d.type];
    const xpPct = Math.min(100, d.xp);
    const isMax = d.level >= 5;
    const card = document.createElement('div');
    card.className = 'dragon-card';
    card.dataset.type = d.type;
    card.innerHTML = `
      <span class="dragon-emoji">${meta.emoji}</span>
      <div class="dragon-name">${meta.label}</div>
      <div class="dragon-level">Уровень ${d.level}${isMax ? ' (макс)' : ''} · ${d.xp} XP</div>
      <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
    `;
    card.addEventListener('click', () => openTask(d.type));
    grid.appendChild(card);
  });
  $dragonsContainer.innerHTML = '';
  $dragonsContainer.appendChild(grid);
}

async function loadProgress() {
  const { totalLevels } = await apiFetch('/progress');
  $totalLevels.textContent = totalLevels;
}

// ─── Открыть задание ──────────────────────────────────────────────────────────

async function openTask(type) {
  currentType = type;
  const meta  = DRAGON_META[type];
  resetTaskScreen();
  showScreen('screen-task');

  $taskBadge.innerHTML = `
    <span style="font-size:22px">${meta.emoji}</span>
    <span style="font-family:'Unbounded',sans-serif;font-size:13px;font-weight:600">${meta.name}</span>
  `;

  const data = await apiFetch(`/task/${type}`);
  $taskText.textContent       = data.task;
  $expressionText.textContent = data.expression || '';

  currentTaskKind  = data.task_kind  || 'normal';
  currentTaskText  = data.task        || '';
  currentReadText  = data.read_text  || null;
  currentPhotoTask = data.photo_task || null;

  // ── Чтение ───────────────────────────────────────
  if (currentTaskKind === 'reading' && currentReadText) {
    $readText.innerHTML        = formatPoem(currentReadText);
    $readingCard.style.display = 'block';
  } else {
    $readingCard.style.display = 'none';
  }

  // ── Фото ─────────────────────────────────────────
  if (currentTaskKind === 'photo' && currentPhotoTask) {
    $photoCard.style.display = 'block';
  } else {
    $photoCard.style.display = 'none';
  }

  // ── Адаптация confirm-card под kind ──────────────
  if (currentTaskKind === 'math') {
    // Ребёнок сам решает пример. Никакого «подтверждения взрослого».
    if ($taskCard) $taskCard.style.display = 'none';        // task-text дублирует пример
    if ($confirmLabel) $confirmLabel.textContent = '🔢 Реши пример';
    if ($confirmHint)  $confirmHint.textContent  = 'Реши и введи свой ответ:';
    if ($expressionBox) $expressionBox.style.display = '';
    if ($answerInput) {
      $answerInput.type = 'number';
      $answerInput.placeholder = 'Твой ответ';
      $answerInput.style.display = '';
    }
    if ($answerTextarea) $answerTextarea.style.display = 'none';
  } else if (currentTaskKind === 'text') {
    // Развёрнутый ответ: текстовое поле + проверка ИИ
    if ($confirmLabel) $confirmLabel.textContent = '✍️ Твой ответ';
    if ($confirmHint)  $confirmHint.textContent  = 'Расскажи, что ты сделал/нашёл — дракон проверит:';
    if ($expressionBox) $expressionBox.style.display = 'none';
    if ($answerInput)   $answerInput.style.display   = 'none';
    if ($answerTextarea) $answerTextarea.style.display = '';
  } else if (currentTaskKind === 'photo' || currentTaskKind === 'reading') {
    // Эти типы проверяются по-своему — confirm-card скрыт
    if ($confirmCard) $confirmCard.style.display = 'none';
  } else {
    // Фолбэк (старая логика «нормально» — подтверждение взрослого)
    if ($confirmLabel) $confirmLabel.textContent = 'Подтверждение взрослого';
    if ($confirmHint)  $confirmHint.textContent  = 'Попроси взрослого вычислить выражение и введи ответ:';
    if ($expressionBox) $expressionBox.style.display = '';
    if ($answerInput)   $answerInput.style.display   = '';
    if ($answerTextarea) $answerTextarea.style.display = 'none';
  }
}

// Разбиваем стихотворение по строкам
function formatPoem(text) {
  return text.split('\n').map(line => `<span class="poem-line">${line}</span>`).join('\n');
}

// ─── Ответ на математику ──────────────────────────────────────────────────────

async function submitAnswer() {
  const isText  = (currentTaskKind === 'text');
  const fieldEl = isText ? $answerTextarea : $answerInput;
  const raw     = (fieldEl?.value || '').trim();
  if (!raw) { flash(fieldEl, 'error'); return; }

  $submitBtn.disabled    = true;
  $submitBtn.textContent = isText ? '🐉 Дракон проверяет…' : '…';

  let data;
  try {
    if (isText) {
      data = await apiFetch('/verify-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:   currentType,
          task:   currentTaskText,
          answer: raw,
        }),
      });
    } else {
      data = await apiFetch('/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:   currentType,
          answer: parseFloat(raw.replace(',', '.')),
        }),
      });
    }
  } catch (e) {
    $submitBtn.disabled = false;
    $submitBtn.textContent = 'Готово ✓';
    showResult('fail', '😔', 'Ошибка', e.message || 'Не удалось отправить ответ');
    $resultCard.classList.add('visible');
    return;
  }

  $submitBtn.textContent = 'Готово ✓';

  if (data.correct) {
    flash(fieldEl, 'success');
    const d = data.dragon;
    showResult('success', '🎉', 'Задание выполнено!',
      d ? `${DRAGON_META[d.type].name}: уровень ${d.level}, опыт ${d.xp}/100\n${data.message || ''}` : (data.message || ''));
    if (data.xpGained) {
      $xpBadge.textContent   = `+${data.xpGained} XP`;
      $xpBadge.style.display = 'inline-block';
    }
  } else {
    flash(fieldEl, 'error');
    showResult('fail', '😅', 'Не совсем…', data.message);
    $xpBadge.style.display = 'none';
    $submitBtn.disabled    = false;
  }

  $resultCard.classList.add('visible');
  $nextBtn.style.display = 'block';
}

function showResult(type, emoji, title, msg) {
  $resultEmoji.textContent = emoji;
  $resultTitle.textContent = title;
  $resultTitle.className   = `result-title ${type}`;
  $resultMsg.textContent   = msg;
}

function flash(el, cls) {
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 900);
}

// ─── РАСПОЗНАВАНИЕ РЕЧИ ───────────────────────────────────────────────────────

function resetReadingState() {
  stopRecognition();
  stopSpeaking();
  currentTaskKind   = 'normal';
  currentReadText   = null;
  finalTranscript   = '';
  interimTranscript = '';

  $readingCard.style.display    = 'none';
  $liveTranscript.textContent   = '';
  $liveTranscript.style.display = 'none';
  $speechResult.style.display   = 'none';
  $recordingStatus.textContent  = '';
  $recordBtn.textContent        = '🎙 Записать чтение';
  $recordBtn.classList.remove('recording');
  $listenBtn.textContent        = '🔊 Послушать правильное чтение';
  $listenBtn.classList.remove('speaking');
  $confirmReadBtn.style.display = 'none';
}

function stopRecognition() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (recognition) {
    try { recognition.abort(); } catch (e) {}
    recognition = null;
  }
  isRecording = false;
}

// ─── ОЗВУЧКА (TTS) ────────────────────────────────────────────────────────────

function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  $listenBtn.textContent = '🔊 Послушать правильное чтение';
  $listenBtn.classList.remove('speaking');
}

function toggleListening() {
  if (isSpeaking) {
    stopSpeaking();
    return;
  }

  if (!window.speechSynthesis) {
    $recordingStatus.textContent = '😔 Синтез речи не поддерживается в этом браузере.';
    return;
  }

  const utterance = new SpeechSynthesisUtterance(currentReadText);
  utterance.lang  = 'ru-RU';
  utterance.rate  = 0.85;
  utterance.pitch = 1.1;

  // Подобрать русский голос, если доступен
  const voices = window.speechSynthesis.getVoices();
  const ruVoice = voices.find(v => v.lang.startsWith('ru'));
  if (ruVoice) utterance.voice = ruVoice;

  utterance.onstart = () => {
    isSpeaking = true;
    $listenBtn.textContent = '⏹ Остановить';
    $listenBtn.classList.add('speaking');
  };

  utterance.onend = utterance.onerror = () => {
    isSpeaking = false;
    $listenBtn.textContent = '🔊 Послушать правильное чтение';
    $listenBtn.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utterance);
}

// Убираем пунктуацию, лишние пробелы → нижний регистр
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Процент слов оригинала, которые ребёнок произнёс
function calcScore(heard, expected) {
  const heardSet      = new Set(normalize(heard).split(' ').filter(Boolean));
  const expectedWords = normalize(expected).split(' ').filter(Boolean);
  if (!expectedWords.length) return 0;
  const matched = expectedWords.filter(w => heardSet.has(w)).length;
  return Math.round((matched / expectedWords.length) * 100);
}

// Подсвечиваем каждое слово оригинала: зелёный = сказал, серый = пропустил
function buildHighlight(heard, expected) {
  const heardSet = new Set(normalize(heard).split(' ').filter(Boolean));
  return expected.split('\n').map(line => {
    const tokens = line.split(/(\s+)/);
    return tokens.map(tok => {
      if (/^\s+$/.test(tok)) return tok;
      const clean = normalize(tok);
      if (!clean) return tok;
      return `<span class="word ${heardSet.has(clean) ? 'word-ok' : 'word-miss'}">${tok}</span>`;
    }).join('');
  }).join('<br>');
}

function startRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $recordingStatus.innerHTML =
      '😔 Распознавание речи не поддерживается.<br>Открой страницу в <strong>Google Chrome</strong>.';
    return;
  }

  finalTranscript   = '';
  interimTranscript = '';
  isRecording       = true;

  $recordBtn.textContent        = '⏹ Остановить запись';
  $recordBtn.classList.add('recording');
  $recordingStatus.textContent  = '🔴 Слушаю… Читай стихотворение вслух!';
  $liveTranscript.textContent   = '';
  $liveTranscript.style.display = 'block';
  $speechResult.style.display   = 'none';
  $confirmReadBtn.style.display = 'none';

  function createRec() {
    // Не запускаем, если уже остановили
    if (!isRecording) return;

    // Зачищаем предыдущий экземпляр без onend-колбэков (иначе вызов abort снова триггерит onend)
    if (recognition) {
      recognition.onend   = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try { recognition.abort(); } catch (_) {}
      recognition = null;
    }

    const rec = new SR();
    rec.lang            = 'ru-RU';
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    recognition = rec;

    rec.onresult = (e) => {
      interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript += t;
        }
      }
      $liveTranscript.innerHTML =
        finalTranscript +
        (interimTranscript ? `<em class="interim">${interimTranscript}</em>` : '');
    };

    rec.onerror = (e) => {
      // no-speech, aborted, network — штатные ситуации, просто ждём onend и перезапускаем
      if (e.error === 'no-speech' || e.error === 'aborted' || e.error === 'network') return;
      // Остальное (not-allowed, service-not-allowed и т.п.) — показываем ошибку
      $recordingStatus.textContent = `❌ Ошибка микрофона: ${e.error}`;
      isRecording = false;
      stopRecordingAndShow();
    };

    rec.onend = () => {
      // onend всегда вызывается после abort — проверяем флаг
      if (!isRecording) return;
      // Небольшая задержка, чтобы браузер успел освободить микрофон перед перезапуском
      restartTimer = setTimeout(createRec, 300);
    };

    try {
      rec.start();
    } catch (err) {
      // InvalidStateError: уже запущен — подождём и попробуем ещё раз
      restartTimer = setTimeout(createRec, 400);
    }
  }

  createRec();
}

function stopRecordingAndShow() {
  stopRecognition();

  $recordBtn.textContent = '🎙 Записать чтение';
  $recordBtn.classList.remove('recording');
  $recordingStatus.textContent = '';

  const fullText = (finalTranscript + ' ' + interimTranscript).trim();

  if (!fullText) {
    $recordingStatus.textContent = '🤫 Ничего не услышал. Нажми кнопку и попробуй ещё раз!';
    $liveTranscript.style.display = 'none';
    return;
  }

  showSpeechResult(fullText);
}

function showSpeechResult(heard) {
  const score       = calcScore(heard, currentReadText);
  const highlighted = buildHighlight(heard, currentReadText);

  $heardText.textContent = heard.trim();
  $speechWords.innerHTML = highlighted;

  let emoji, msg, color;
  if (score >= 80) {
    emoji = '🎉'; msg = `Отлично! ${score}% слов прочитано`; color = 'var(--score-good)';
  } else if (score >= 50) {
    emoji = '👍'; msg = `Хорошо! ${score}% слов прочитано`;  color = 'var(--score-ok)';
  } else {
    emoji = '🤔'; msg = `Попробуй ещё раз — ${score}%`;      color = 'var(--score-bad)';
  }

  $speechScore.innerHTML =
    `<span class="score-emoji">${emoji}</span>` +
    `<span class="score-label" style="color:${color}">${msg}</span>`;

  $liveTranscript.style.display = 'none';
  $speechResult.style.display   = 'block';

  if (score >= 50) {
    $confirmReadBtn.style.display = 'block';
  } else {
    $confirmReadBtn.style.display = 'none';
  }
}

function toggleRecording() {
  if (isRecording) {
    stopRecordingAndShow();
  } else {
    startRecording();
  }
}

// ─── ФОТО ─────────────────────────────────────────────────────────────────────

function resetPhotoState() {
  currentPhotoTask           = null;
  $photoCard.style.display   = 'none';
  $photoPreviewWrap.style.display = 'none';
  $photoPreview.src          = '';
  $photoStatus.style.display = 'none';
  $photoStatus.innerHTML     = '';
  $photoCheckBtn.style.display = 'none';
  $fileInput.value           = '';
  $cameraInput.value         = '';
}

// Сжимаем фото через Canvas до ≤1024px и качество 0.7 → JPEG base64
function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else                { width  = Math.round(width  * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = url;
  });
}

async function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  $photoStatus.style.display = 'none';
  $photoStatus.innerHTML     = '';
  $photoCheckBtn.style.display = 'none';

  const compressed = await compressImage(file);
  $photoPreview.src               = compressed;
  $photoPreviewWrap.style.display = 'block';
  $photoCheckBtn.style.display    = 'block';
}

async function checkPhoto() {
  const imageBase64 = $photoPreview.src;
  if (!imageBase64 || !currentPhotoTask) return;

  $photoCheckBtn.disabled      = true;
  $photoCheckBtn.textContent   = '🔍 Дракон смотрит…';
  $photoStatus.style.display   = 'block';
  $photoStatus.className       = 'photo-status checking';
  $photoStatus.innerHTML       = '<span class="photo-spinner"></span> Дракон изучает фото…';

  // Вытаскиваем чистый base64 и media_type из data-URL
  let mediaType  = 'image/jpeg';
  let base64Data = imageBase64;
  const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
  if (match) { mediaType = match[1]; base64Data = match[2]; }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text:
              `Ты помощник в детской образовательной игре. Ребёнок выполнил задание и прислал фото.\n\n` +
              `Задание: ${currentPhotoTask}\n\n` +
              `Внимательно посмотри на фото и ответь строго в формате JSON (без лишнего текста):\n` +
              `{"done": true/false, "feedback": "короткий дружелюбный комментарий для ребёнка 1-2 предложения на русском"}\n\n` +
              `done=true если задание выполнено верно, done=false если нет или фото не соответствует заданию.`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.type === 'error' || data.error) {
      throw new Error(data.error?.message || JSON.stringify(data.error));
    }

    const text    = (data.content || []).map(b => b.text || '').join('').trim();
    const jsonStr = text.replace(/^```(?:json)?|```$/gm, '').trim();

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (_) {
      // Если модель не вернула JSON — угадываем по тексту
      const done = /выполнено|молодец|правильно|верно|отлично/i.test(text);
      result = { done, feedback: text.slice(0, 200) };
    }

    if (result.done) {
      $photoStatus.className = 'photo-status photo-ok';
      $photoStatus.innerHTML = `✅ ${result.feedback}`;
    } else {
      $photoStatus.className = 'photo-status photo-fail';
      $photoStatus.innerHTML = `❌ ${result.feedback}`;
    }

  } catch (e) {
    $photoStatus.className = 'photo-status photo-fail';
    $photoStatus.innerHTML = `😔 Ошибка: ${e.message || 'не удалось проверить фото'}`;
  }

  $photoCheckBtn.disabled    = false;
  $photoCheckBtn.textContent = '🐉 Показать дракону!';
}

// ─── Слушатели событий ────────────────────────────────────────────────────────

$backBtn.addEventListener('click', goBack);
$nextBtn.addEventListener('click', goBack);
$submitBtn.addEventListener('click', submitAnswer);
$answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });
$recordBtn.addEventListener('click', toggleRecording);
$listenBtn.addEventListener('click', toggleListening);

$fileInput.addEventListener('change',   e => handlePhotoFile(e.target.files[0]));
$cameraInput.addEventListener('change', e => handlePhotoFile(e.target.files[0]));
$photoCheckBtn.addEventListener('click', checkPhoto);
$photoRemoveBtn.addEventListener('click', () => {
  $photoPreview.src               = '';
  $photoPreviewWrap.style.display = 'none';
  $photoCheckBtn.style.display    = 'none';
  $photoStatus.style.display      = 'none';
  $fileInput.value                = '';
  $cameraInput.value              = '';
});

$retryBtn.addEventListener('click', () => {
  finalTranscript               = '';
  interimTranscript             = '';
  $speechResult.style.display   = 'none';
  $liveTranscript.textContent   = '';
  $liveTranscript.style.display = 'none';
  $confirmReadBtn.style.display = 'none';
  $recordingStatus.textContent  = '';
});

$confirmReadBtn.addEventListener('click', () => {
  document.querySelector('.confirm-card').scrollIntoView({ behavior: 'smooth' });
});

// ─── Инициализация ────────────────────────────────────────────────────────────

(async () => {
  // If we are already past the intro (e.g. refresh), load data
  if (sessionStorage.getItem('playerName')) {
    await loadDragons();
    await loadProgress();
  }
})();

// ─── World Loading Sequence ──────────────────────────────────────────────────

window.initWorldSequence = async function() {
  const intro   = document.getElementById('intro-scene');
  const loading = document.getElementById('loading-world');
  const bar     = document.getElementById('load-progress-bar');
  const app     = document.getElementById('main-app');
  const mapScr  = document.getElementById('map-screen');

  if (!intro || !loading || !bar || !app) return;

  // Start transition
  intro.classList.add('out');
  
  await new Promise(r => setTimeout(r, 550));
  intro.style.display = 'none';
  loading.style.display = 'flex';
  
  // Progress simulation + real data loading
  bar.style.width = '15%';
  await new Promise(r => setTimeout(r, 600));
  
  bar.style.width = '45%';
  try { await loadDragons(); } catch(e) {}
  
  bar.style.width = '75%';
  try { await loadProgress(); } catch(e) {}
  
  await new Promise(r => setTimeout(r, 400));
  bar.style.width = '100%';
  
  await new Promise(r => setTimeout(r, 600));
  
  // Show app
  loading.style.opacity = '0';
  loading.style.transition = 'opacity 0.5s ease';
  
  setTimeout(() => {
    loading.style.display = 'none';
    app.style.display = 'block';
    mapScr.classList.add('active');
    
    // Zoom in to the house (coords ~45.5%, 39%)
    if (window.mapView) {
      window.mapView.focusOnPoint(0.455, 0.39, 2.2);
    } else {
      window.dispatchEvent(new Event('resize'));
    }
    
    // Check for first-time story dialogue
    checkInitialDialogue();
  }, 500);
};

// ─── Initial Dialogue ────────────────────────────────────────────────────────

const STORY_SHOWN_KEY = 'story_dialogue_shown';

function checkInitialDialogue() {
  if (localStorage.getItem(STORY_SHOWN_KEY)) return;
  
  const name = sessionStorage.getItem('playerName') || 'путешественник';
  
  // We reuse the home-modal for the initial story
  const modal   = document.getElementById('home-modal');
  const textEl  = document.getElementById('home-modal-text');
  const statsEl = document.getElementById('home-modal-stats');
  if (!modal || !textEl) return;

  textEl.innerHTML = 
    `Привет, ${name}! Ты вовремя! 🐉<br><br>` +
    `Драконляндия — это древний мир, где магия питается знаниями. ` +
    `Раньше все драконы жили дружно, но сейчас они заскучали и спрятались по своим домам.<br><br>` +
    `Твой <strong>Центральный Дом</strong> (куда ты можешь зайти, нажав на него) — это твоя база. ` +
    `Там я буду собирать для тебя статистику твоих успехов. Помогай драконам, и мир снова засияет красками!`;
  
  statsEl.classList.add('hidden');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  
  localStorage.setItem(STORY_SHOWN_KEY, 'true');
}

// ─── Quest Panel (Journal) ───────────────────────────────────────────────────

window.toggleQuestPanel = function() {
  const panel = document.getElementById('quest-panel');
  if (!panel) return;
  
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    renderQuestPanel();
  } else {
    panel.classList.add('hidden');
  }
};

async function renderQuestPanel() {
  const listEl = document.getElementById('quest-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div>Смотрим в свитки…</div>';
  
  try {
    const dragons = await apiFetch('/dragons');
    if (!dragons.length) {
      listEl.innerHTML = '<p style="text-align:center;color:var(--muted)">Заданий пока нет. Исследуй мир!</p>';
      return;
    }
    
    listEl.innerHTML = dragons.map(d => {
      const meta = DRAGON_META[d.type];
      const status = d.level >= 5 ? '🏆 Мастер' : `Уровень ${d.level} (${d.xp} XP)`;
      return `
        <div class="quest-item" data-type="${d.type}">
          <div class="quest-item__head">
            <span style="font-size:20px">${meta.emoji}</span>
            <div class="quest-item__type">${meta.label}</div>
          </div>
          <div class="quest-item__title">Помощь ${meta.name}</div>
          <div class="quest-item__status">${status}</div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    listEl.innerHTML = `<p style="color:var(--math)">Ошибка загрузки: ${e.message}</p>`;
  }
}


// ── Map panel hook ────────────────────────────────────────────────────────────
// Called when a subject button is clicked — goes directly to the task screen
window._openDragonType = function(type) {
  openTask(type);
};

// ── Pan & Zoom for map canvas ─────────────────────────────────────────────────

window.mapView = {
  scale: 1,
  ox: 0,
  oy: 0,
  WORLD_W: 2400,
  WORLD_H: 2400,
  MAX_SCALE: 3.5,

  apply: function() {
    const world = document.querySelector('.map-world');
    if (world) world.style.transform = `translate(${this.ox}px, ${this.oy}px) scale(${this.scale})`;
  },

  getMinScale: function() {
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) return 1;
    const cw = canvas.clientWidth  || 1;
    const ch = canvas.clientHeight || 1;
    return Math.max(cw / this.WORLD_W, ch / this.WORLD_H);
  },

  clamp: function() {
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const ww = this.WORLD_W * this.scale;
    const wh = this.WORLD_H * this.scale;

    // Scale
    const minS = this.getMinScale();
    if (this.scale < minS) this.scale = minS;
    if (this.scale > this.MAX_SCALE) this.scale = this.MAX_SCALE;

    // Pan
    if (ww >= cw) this.ox = Math.min(0, Math.max(cw - ww, this.ox));
    else          this.ox = (cw - ww) / 2;

    if (wh >= ch) this.oy = Math.min(0, Math.max(ch - wh, this.oy));
    else          this.oy = (ch - wh) / 2;
  },

  center: function() {
    this.scale = this.getMinScale();
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) return;
    this.ox = (canvas.clientWidth - this.WORLD_W * this.scale) / 2;
    this.oy = (canvas.clientHeight - this.WORLD_H * this.scale) / 2;
    this.clamp();
    this.apply();
  },

  focusOnPoint: function(x_pct, y_pct, targetScale) {
    const canvas = document.querySelector('.map-canvas');
    if (!canvas) return;
    if (targetScale) this.scale = targetScale;
    this.clamp(); 
    
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    
    this.ox = cw / 2 - (this.WORLD_W * x_pct * this.scale);
    this.oy = ch / 2 - (this.WORLD_H * y_pct * this.scale);
    
    this.clamp();
    this.apply();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.querySelector('.map-canvas');
  const world  = document.querySelector('.map-world');
  if (!canvas || !world) return;

  let dragging = false;
  let startX, startY, startOx, startOy;

  // Mouse drag
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startOx = window.mapView.ox; startOy = window.mapView.oy;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    window.mapView.ox = startOx + (e.clientX - startX);
    window.mapView.oy = startOy + (e.clientY - startY);
    window.mapView.clamp();
    window.mapView.apply();
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  // Touch drag
  let lastTouchX, lastTouchY, lastDist = null;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      startOx = window.mapView.ox; startOy = window.mapView.oy;
    } else if (e.touches.length === 2) {
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      window.mapView.ox += dx; 
      window.mapView.oy += dy;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      window.mapView.clamp();
      window.mapView.apply();
    } else if (e.touches.length === 2 && lastDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / lastDist;
      window.mapView.scale *= delta;
      window.mapView.clamp();
      lastDist = dist;
      window.mapView.clamp();
      window.mapView.apply();
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastDist = null;
  });

  // Scroll to zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.9;
    let oldScale = window.mapView.scale;
    window.mapView.scale *= zoomFactor;
    window.mapView.clamp();

    // Zoom toward mouse cursor
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    window.mapView.ox = mx - (mx - window.mapView.ox) * (window.mapView.scale / oldScale);
    window.mapView.oy = my - (my - window.mapView.oy) * (window.mapView.scale / oldScale);
    
    window.mapView.clamp();
    window.mapView.apply();
  }, { passive: false });

  // Zoom buttons
  const zoomIn  = document.getElementById('map-zoom-in');
  const zoomOut = document.getElementById('map-zoom-out');
  if (zoomIn) zoomIn.addEventListener('click', () => {
    window.mapView.scale *= 1.25;
    window.mapView.clamp(); 
    window.mapView.apply();
  });
  if (zoomOut) zoomOut.addEventListener('click', () => {
    window.mapView.scale /= 1.25;
    window.mapView.clamp(); 
    window.mapView.apply();
  });

  // Initial center
  if (sessionStorage.getItem('playerName')) {
    window.mapView.focusOnPoint(0.455, 0.39, 2.2);
  } else {
    window.mapView.center();
  }
  window.addEventListener('resize', () => {
    // Only auto-center if we are at min zoom (or just center anyway for safety)
    window.mapView.center();
  });

  // ── Кликабельный дом ──────────────────────────────────
  // Не даём драгу карты «съесть» клик: если пользователь начал тянуть,
  // не считаем это кликом по дому.
  const home = document.getElementById('map-home');
  if (home) {
    let downX = 0, downY = 0, moved = false;
    home.addEventListener('mousedown', e => {
      downX = e.clientX; downY = e.clientY; moved = false;
    });
    canvas.addEventListener('mousemove', e => {
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) moved = true;
    });
    home.addEventListener('click', e => {
      if (moved) { e.preventDefault(); e.stopPropagation(); return; }
      e.stopPropagation();
      openHomeModal();
    });
  }
});

// ── Модалка дома (Сэр Дракон) ────────────────────────────────────────────────
const HOME_VISITS_KEY = 'home_visits_count';
function getHomeVisits() {
  try { return parseInt(localStorage.getItem(HOME_VISITS_KEY) || '0', 10); }
  catch (_) { return 0; }
}
function bumpHomeVisits() {
  const next = getHomeVisits() + 1;
  try { localStorage.setItem(HOME_VISITS_KEY, String(next)); } catch (_) {}
  return next;
}

const DRAGON_LABELS = {
  math:    { emoji: '🔢', name: 'Математика'  },
  russian: { emoji: '📖', name: 'Русский язык'},
  logic:   { emoji: '🧩', name: 'Логика'      },
  world:   { emoji: '🌍', name: 'Окруж. мир'  },
};

async function openHomeModal() {
  const modal      = document.getElementById('home-modal');
  const textEl     = document.getElementById('home-modal-text');
  const statsEl    = document.getElementById('home-modal-stats');
  const canvasWrap = document.getElementById('map-canvas');
  if (!modal || !textEl || !statsEl) return;

  const visits = bumpHomeVisits();

  // Размытие карты под модалкой
  if (canvasWrap) canvasWrap.classList.add('is-blurred');

  if (visits === 1) {
    textEl.textContent = 'Хээээй, привет, я Мэр Сэр Дракон, это твой дом — тут ты сможешь смотреть свою статистику по заданиям.';
    statsEl.classList.add('hidden');
    statsEl.innerHTML = '';
  } else {
    textEl.textContent = 'О, ты пришёл! Вот твои достижения:';
    statsEl.classList.remove('hidden');
    statsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Считаю результаты…</div>';
    try {
      const dragons = await apiFetch('/dragons');
      statsEl.innerHTML = renderStats(dragons);
    } catch (e) {
      statsEl.innerHTML = '<div class="stat-card">Не удалось загрузить статистику: ' +
                          (e?.message || 'ошибка сети') + '</div>';
    }
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeHomeModal() {
  const modal      = document.getElementById('home-modal');
  const canvasWrap = document.getElementById('map-canvas');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (canvasWrap) canvasWrap.classList.remove('is-blurred');
}

function renderStats(dragons) {
  if (!Array.isArray(dragons) || !dragons.length) {
    return '<div class="stat-card">Пока нет данных</div>';
  }
  return dragons.map(d => {
    const meta = DRAGON_LABELS[d.type] || { emoji: '⭐', name: d.type };
    const ok   = d.correct_count ?? 0;
    const bad  = d.wrong_count   ?? 0;
    return `
      <div class="stat-card" data-type="${d.type}">
        <div class="stat-card__head">
          <span class="stat-emoji">${meta.emoji}</span>
          <span>${meta.name}</span>
        </div>
        <div class="stat-card__row"><span>✅ Правильно</span><span class="ok">${ok}</span></div>
        <div class="stat-card__row"><span>❌ Ошибки</span><span class="fail">${bad}</span></div>
        <div class="stat-card__row"><span>⭐ Уровень</span><span>${d.level}</span></div>
      </div>
    `;
  }).join('');
}

// Слушатели закрытия — после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('home-modal-close');
  const backdrop = document.getElementById('home-modal-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeHomeModal);
  if (backdrop) backdrop.addEventListener('click', closeHomeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHomeModal();
  });
});

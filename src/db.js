// src/db.js — инициализация SQLite через sql.js (чистый JS, без компилятора C++)

const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_PATH = path.join(__dirname, '..', 'game.db');

let _db = null;

// ─── Сохранение на диск ───────────────────────────────────────────────────────

function saveToDisk() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Обёртки совместимости над sql.js API ────────────────────────────────────
// sql.js не имеет .get()/.all()/.run() как better-sqlite3 — делаем сами

function run(sql, params = []) {
  _db.run(sql, params);
  saveToDisk();
}

function get(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = _db.prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── Схема ────────────────────────────────────────────────────────────────────

function createSchema() {
  _db.run(`CREATE TABLE IF NOT EXISTS dragons (
    type          TEXT PRIMARY KEY,
    level         INTEGER DEFAULT 1,
    xp            INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count   INTEGER DEFAULT 0
  )`);
  // Миграция: если таблица была создана раньше — добавим новые столбцы
  try { _db.run(`ALTER TABLE dragons ADD COLUMN correct_count INTEGER DEFAULT 0`); } catch (_) {}
  try { _db.run(`ALTER TABLE dragons ADD COLUMN wrong_count   INTEGER DEFAULT 0`); } catch (_) {}
  _db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    text       TEXT NOT NULL,
    task_kind  TEXT DEFAULT 'normal',
    read_text  TEXT,
    photo_task TEXT
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS verification (
    id         INTEGER PRIMARY KEY,
    type       TEXT NOT NULL,
    expression TEXT NOT NULL,
    answer     REAL NOT NULL
  )`);
  saveToDisk();
}

// ─── Сиды ─────────────────────────────────────────────────────────────────────

function seedDragons() {
  const row = get('SELECT COUNT(*) as c FROM dragons');
  if (row && row.c > 0) return;
  ['math', 'russian', 'logic', 'world'].forEach(t =>
    _db.run('INSERT INTO dragons (type, level, xp) VALUES (?, 1, 0)', [t])
  );
  saveToDisk();
  console.log('  \u2713 \u0414\u0440\u0430\u043a\u043e\u043d\u044b \u0441\u043e\u0437\u0434\u0430\u043d\u044b');
}

function seedTasks() {
  const row = get('SELECT COUNT(*) as c FROM tasks');
  if (row && row.c > 0) return;
  // [type, text, task_kind, read_text, photo_task]
  const tasks = [
    ['math',    'Посчитай все стулья в своей квартире и запомни число',    'normal', null, null],
    ['math',    'Измерь длину своей ноги в шагах, пройдя по комнате',      'normal', null, null],
    ['math',    'Найди 5 предметов разной длины и разложи от меньшего к большему', 'normal', null, null],
    ['math',    'Посчитай, сколько окон в твоём доме',                     'normal', null, null],
    ['math',    'Придумай задачу про яблоки и реши её вслух с мамой или папой', 'normal', null, null],
    ['math',    'Посчитай количество книг на одной полке',                 'normal', null, null],
    ['russian', 'Найди 3 слова на букву «Д» в любой книге',               'normal', null, null],
    ['russian', 'Составь предложение из 7 слов про своего любимого героя', 'normal', null, null],
    ['russian', 'Напиши 5 слов, в которых есть буква «Ь»',                'normal', null, null],
    ['russian', 'Расскажи взрослому сказку своими словами (любую)',        'normal', null, null],
    ['russian', 'Найди в газете или журнале самое длинное слово',          'normal', null, null],
    ['russian', 'Прочитай стихотворение вслух — дракон слушает!', 'reading',
      'Идёт бычок, качается,\nВздыхает на ходу:\n— Ох, доска кончается,\nСейчас я упаду!', null],
    ['russian', 'Прочитай стихотворение вслух — дракон слушает!', 'reading',
      'Наша Таня громко плачет:\nУронила в речку мячик.\n— Тише, Танечка, не плачь:\nНе утонет в речке мяч.', null],
    ['russian', 'Прочитай стихотворение вслух — дракон слушает!', 'reading',
      'Зайку бросила хозяйка —\nПод дождём остался зайка.\nСо скамейки слезть не мог,\nВесь до ниточки промок.', null],
    ['russian', 'Прочитай стихотворение вслух — дракон слушает!', 'reading',
      'Уронили мишку на пол,\nОторвали мишке лапу.\nВсё равно его не брошу —\nПотому что он хороший.', null],
    ['russian', 'Прочитай стихотворение вслух — дракон слушает!', 'reading',
      'Дали туфельки слону.\nПоглядите на слона —\nНаступает на ногу\nИ тебе, и мне, и всем.', null],
    ['logic',   'Разложи носки по парам и посчитай, сколько пар',         'normal', null, null],
    ['logic',   'Придумай загадку про предмет в комнате и загадай взрослому', 'normal', null, null],
    ['logic',   'Найди 3 предмета: один круглый, один квадратный, один треугольный', 'normal', null, null],
    ['logic',   'Расставь 5 игрушек по росту от маленькой к большой',     'normal', null, null],
    ['logic',   'Придумай правило для сортировки ложек и вилок на кухне', 'normal', null, null],
    ['logic',   'Найди в квартире что-то красное, синее и жёлтое',        'normal', null, null],
    // Задания с фото для Логики
    ['logic', 'Найди один ЧЁРНЫЙ и один БЕЛЫЙ предмет, положи рядом и сфотографируй!', 'photo', null,
      'На фото должны быть два предмета: один чёрного цвета и один белого цвета, лежащие рядом. Оба предмета должны быть чётко видны. Оцени, выполнено ли задание.'],
    ['logic', 'Найди один КРУГЛЫЙ и один ПРЯМОУГОЛЬНЫЙ предмет, положи рядом и сфотографируй!', 'photo', null,
      'На фото должны быть два предмета: один круглой формы (тарелка, мячик, монета и т.п.) и один прямоугольной или квадратной формы (книга, коробка, телефон и т.п.), лежащие рядом. Оцени, выполнено ли задание.'],
    ['logic', 'Найди один БОЛЬШОЙ и один МАЛЕНЬКИЙ предмет, положи рядом и сфотографируй!', 'photo', null,
      'На фото должны быть два предмета явно разного размера: один заметно большой и один заметно маленький, лежащие рядом. Оцени, выполнено ли задание.'],
    ['world',   'Выйди на улицу и найди 3 разных вида растений',          'normal', null, null],
    ['world',   'Посмотри в окно и опиши погоду 5 словами',               'normal', null, null],
    ['world',   'Найди на карте (или глобусе) свой город',                'normal', null, null],
    ['world',   'Спроси взрослого, какое животное живёт в Африке, и запомни ответ', 'normal', null, null],
    ['world',   'Найди дома предмет из дерева и предмет из металла',      'normal', null, null],
    ['world',   'Нарисуй схему своей квартиры — где какая комната',       'normal', null, null],
  ];
  tasks.forEach(([type, text, kind, read_text, photo_task]) =>
    _db.run('INSERT INTO tasks (type, text, task_kind, read_text, photo_task) VALUES (?, ?, ?, ?, ?)', [type, text, kind, read_text, photo_task])
  );
  saveToDisk();
  console.log('  \u2713 \u0417\u0430\u0434\u0430\u043d\u0438\u044f \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b');
}

// ─── Запросы (совместимый интерфейс) ─────────────────────────────────────────

const queries = {
  getAllDragons:      () => all('SELECT * FROM dragons'),
  getDragon:         (type) => get('SELECT * FROM dragons WHERE type = ?', [type]),
  updateDragon:      (level, xp, type) => run('UPDATE dragons SET level = ?, xp = ? WHERE type = ?', [level, xp, type]),
  incCorrect:        (type) => run('UPDATE dragons SET correct_count = COALESCE(correct_count,0) + 1 WHERE type = ?', [type]),
  incWrong:          (type) => run('UPDATE dragons SET wrong_count   = COALESCE(wrong_count,0)   + 1 WHERE type = ?', [type]),
  getTasksByType:    (type) => all('SELECT * FROM tasks WHERE type = ?', [type]),
  getVerification:   () => get('SELECT * FROM verification WHERE id = 1'),
  sumLevels:         () => get('SELECT SUM(level) as total FROM dragons'),
  upsertVerification: (type, expression, answer) => run(`
    INSERT INTO verification (id, type, expression, answer) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE
      SET type = excluded.type, expression = excluded.expression, answer = excluded.answer
  `, [type, expression, answer]),
};

// ─── Инициализация (async) ────────────────────────────────────────────────────

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    console.log('  \u2713 \u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430 \u0441 \u0434\u0438\u0441\u043a\u0430');
  } else {
    _db = new SQL.Database();
    console.log('  \u2713 \u0421\u043e\u0437\u0434\u0430\u043d\u0430 \u043d\u043e\u0432\u0430\u044f \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445');
  }

  createSchema();
  return { queries, seedDragons, seedTasks };
}

module.exports = { initDb };

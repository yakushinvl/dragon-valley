// server.js — точка входа
require('dotenv').config();
const express        = require('express');
const path           = require('path');
const { initDb }     = require('./src/db');
const { router, setQueries } = require('./src/routes');

const app  = express();
const PORT = 3000;

async function start() {
  // 1. Инициализируем базу данных (sql.js — async)
  console.log('\n📦 Инициализация базы данных...');
  const { queries, seedDragons, seedTasks } = await initDb();
  seedDragons();
  seedTasks();

  // 2. Передаём queries в роутер
  setQueries(queries);

  // 3. Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // 4. Маршруты
  app.use('/', router);

  // 5. Запуск
  app.listen(PORT, () => {
    console.log(`\n🐉 Драконья Долина запущена!`);
    console.log(`   👉  http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Ошибка запуска:', err);
  process.exit(1);
});

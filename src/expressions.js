// src/expressions.js — генератор математических выражений для подтверждения

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Генерирует случайное выражение и его правильный ответ.
 * Возвращает { expression: string, answer: number }
 *
 * Виды:
 *  1) a + b × c        — приоритет умножения
 *  2) a × b − c        — приоритет умножения
 *  3) √n + a           — корень из полного квадрата
 *  4) a + b − c        — простая арифметика
 */
function generateExpression() {
  const kind = rand(1, 4);

  if (kind === 1) {
    const a = rand(1, 9), b = rand(1, 9), c = rand(1, 9);
    return {
      expression: `${a} + ${b} × ${c}`,
      answer: a + b * c,
    };
  }

  if (kind === 2) {
    const a = rand(2, 9), b = rand(2, 5);
    const c = rand(1, a * b - 1); // результат всегда > 0
    return {
      expression: `${a} × ${b} − ${c}`,
      answer: a * b - c,
    };
  }

  if (kind === 3) {
    const squares = [4, 9, 16, 25, 36];
    const n = squares[rand(0, squares.length - 1)];
    const a = rand(1, 9);
    return {
      expression: `√${n} + ${a}`,
      answer: Math.sqrt(n) + a,
    };
  }

  // kind === 4
  const a = rand(5, 15), b = rand(1, 10);
  const c = rand(1, a + b - 1);
  return {
    expression: `${a} + ${b} − ${c}`,
    answer: a + b - c,
  };
}

module.exports = { generateExpression };

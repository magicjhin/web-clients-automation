// МОДУЛЬ: shared/ocr.js
// ЧТО: Опциональное авто-распознавание капчи (3-значный код-картинка).
//      Пробует tesseract.js, если он установлен. Если пакета нет или код
//      не распознан — возвращает null, и парсер уходит на ручной ввод (Telegram).
// ЗАДЕЛ: сюда же позже можно подключить 2Captcha тем же интерфейсом solve(buffer).

let tesseract = null;
let tried = false;

function load() {
  if (tried) return tesseract;
  tried = true;
  try {
    tesseract = require('tesseract.js'); // пакет может быть не установлен — это ок
  } catch (_) {
    tesseract = null;
  }
  return tesseract;
}

// Возвращает строку-код (только A-Z0-9, длина 3) или null.
async function solve(imageBuffer) {
  const t = load();
  if (!t) return null;
  try {
    const { data } = await t.recognize(imageBuffer, 'eng', {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });
    const raw = (data && data.text ? data.text : '').replace(/[^A-Za-z0-9]/g, '');
    // капча ровно 3 символа — если OCR дал не 3, считаем неуверенным
    if (raw.length === 3) return raw;
    return null;
  } catch (_) {
    return null;
  }
}

// Доступен ли авто-решатель (для логов/статуса)
function available() {
  return !!load();
}

module.exports = { solve, available };

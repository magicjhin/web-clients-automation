// МОДУЛЬ: shared/captcha.js
// ЧТО: Мост между парсером и Telegram-ботом для ручного ввода кода капчи.
//      Парсер вызывает request(картинка) и ждёт; бот вызывает submit(код).
//      Оба живут в одном процессе (бот запускает parseNiche in-process),
//      поэтому общее состояние в памяти модуля работает.
// КАК ИСПОЛЬЗОВАТЬ:
//   const captcha = require('../shared/captcha');
//   captcha.setNotifier(fn)         // бот регистрирует функцию отправки картинки
//   const code = await captcha.request(buffer, meta, timeoutMs)  // парсер ждёт код
//   captcha.submit('ABC')           // бот передаёт введённый код

let pending = null;     // { resolve, reject, meta, since, timer }
let notifier = null;    // async (imageBuffer, meta) => void  — шлёт картинку пользователю

// Бот регистрирует канал доставки картинки (Telegram sendPhoto)
function setNotifier(fn) {
  notifier = fn;
}

function isPending() {
  return !!pending;
}

function getPending() {
  if (!pending) return null;
  return { ...pending.meta, since: pending.since, waitingSec: Math.round((Date.now() - pending.since) / 1000) };
}

// Парсер: запросить код у человека. Возвращает Promise<string> с кодом
// или reject при таймауте / отсутствии канала / ошибке доставки.
function request(imageBuffer, meta = {}, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (pending) {
      reject(new Error('уже ожидается ввод другого кода'));
      return;
    }
    if (!notifier) {
      reject(new Error('нет канала запроса кода (бот не подключён; запусти через Telegram /parse)'));
      return;
    }

    const timer = setTimeout(() => {
      const p = pending;
      pending = null;
      if (p) p.reject(new Error('таймаут ожидания кода капчи'));
    }, timeoutMs);

    pending = { resolve, reject, meta, since: Date.now(), timer };

    // Отправляем картинку пользователю; если не вышло — снимаем ожидание
    Promise.resolve()
      .then(() => notifier(imageBuffer, meta))
      .catch((err) => {
        const p = pending;
        pending = null;
        clearTimeout(timer);
        if (p) p.reject(new Error('не удалось отправить картинку капчи: ' + err.message));
      });
  });
}

// Бот: передать введённый пользователем код. true — если кто-то ждал.
function submit(code) {
  if (!pending) return false;
  const p = pending;
  pending = null;
  clearTimeout(p.timer);
  p.resolve(code);
  return true;
}

// Снять ожидание (например, при остановке парсинга)
function cancel(reason) {
  if (!pending) return false;
  const p = pending;
  pending = null;
  clearTimeout(p.timer);
  p.reject(new Error(reason || 'ожидание кода отменено'));
  return true;
}

module.exports = { setNotifier, isPending, getPending, request, submit, cancel };

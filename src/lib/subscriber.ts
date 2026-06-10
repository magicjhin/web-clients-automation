/**
 * subscriber.ts — вспомогательный модуль для получения единственного subscriber фазы 1.
 *
 * На фазе 1 активен ровно один subscriber (Aleksandr / Webvibe).
 * Функция getCurrentSubscriberId() возвращает его id, кэшируя результат
 * в модульной переменной (один запрос к БД за время жизни процесса).
 *
 * При переходе на фазу 2 (Auth.js + мультитенант) этот модуль заменяется
 * резолвером из сессии пользователя — остальной код менять не нужно.
 */

import { db } from '@/lib/db';

let cachedSubscriberId: string | null = null;

/**
 * Возвращает id единственного активного subscriber фазы 1.
 * Кэширует результат в модульной переменной (не бьёт в БД повторно).
 *
 * @throws {Error} если subscriber не найден (seed не был выполнен)
 */
export async function getCurrentSubscriberId(): Promise<string> {
  if (cachedSubscriberId) return cachedSubscriberId;

  const subscriber = await db.subscriber.findFirst({
    orderBy: { created_at: 'asc' },
    select: { id: true, email: true },
  });

  if (!subscriber) {
    throw new Error(
      '[subscriber] No subscriber found in database. ' +
        'Run `npx prisma db seed` to create the phase-1 subscriber.',
    );
  }

  cachedSubscriberId = subscriber.id;
  return cachedSubscriberId;
}

/**
 * GET /api/push/vapid-public-key
 *
 * Возвращает VAPID public key для регистрации push-подписки на клиенте.
 * Публичный ключ не является секретом — его можно отдавать без аутентификации.
 *
 * Ответ: { key: string }
 */

import { config } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json({ key: config.VAPID_PUBLIC_KEY });
}

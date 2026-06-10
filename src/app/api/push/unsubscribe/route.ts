/**
 * POST /api/push/unsubscribe
 *
 * Удаляет push-подписку браузера по endpoint.
 * Вызывается когда пользователь отзывает разрешение на уведомления.
 *
 * Принимает: { endpoint: string }
 * Ответ: { ok: true } | { ok: false, error: string } (400)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const log = logger.child({ module: 'api/push/unsubscribe' });

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).endpoint !== 'string' ||
    !(body as Record<string, unknown>).endpoint
  ) {
    return Response.json({ ok: false, error: 'endpoint is required' }, { status: 400 });
  }

  const { endpoint } = body as { endpoint: string };

  const deleted = await db.pushSubscription.deleteMany({
    where: { endpoint },
  });

  log.info(
    { endpoint: endpoint.slice(0, 60), deletedCount: deleted.count },
    'push subscription removed',
  );
  return Response.json({ ok: true });
}

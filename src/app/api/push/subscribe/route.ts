/**
 * POST /api/push/subscribe
 *
 * Регистрирует (или обновляет) push-подписку браузера для текущего subscriber.
 * Принимает стандартный PushSubscription JSON от браузера:
 *   { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * Upsert по полю endpoint (@unique): если подписка уже существует — обновляет ключи.
 * User-Agent берётся из заголовка запроса (для справки при очистке).
 *
 * Ответ: { ok: true } | { ok: false, error: string } (400)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentSubscriberId } from '@/lib/subscriber';

export const runtime = 'nodejs';

const log = logger.child({ module: 'api/push/subscribe' });

interface SubscribeBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Валидация структуры тела запроса
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).endpoint !== 'string' ||
    !(body as Record<string, unknown>).endpoint ||
    typeof (body as Record<string, unknown>).keys !== 'object' ||
    (body as Record<string, unknown>).keys === null
  ) {
    return Response.json(
      { ok: false, error: 'endpoint and keys are required' },
      { status: 400 },
    );
  }

  const { endpoint, keys } = body as SubscribeBody;

  if (typeof keys.p256dh !== 'string' || !keys.p256dh || typeof keys.auth !== 'string' || !keys.auth) {
    return Response.json(
      { ok: false, error: 'keys.p256dh and keys.auth are required' },
      { status: 400 },
    );
  }

  let subscriberId: string;
  try {
    subscriberId = await getCurrentSubscriberId();
  } catch (err) {
    log.error({ err: String(err) }, 'failed to resolve subscriber');
    return Response.json({ ok: false, error: 'Subscriber not found' }, { status: 500 });
  }

  const userAgent = req.headers.get('user-agent') ?? undefined;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      subscriber_id: subscriberId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      subscriber_id: subscriberId,
    },
  });

  log.info({ subscriberId, endpoint: endpoint.slice(0, 60) }, 'push subscription registered');
  return Response.json({ ok: true });
}

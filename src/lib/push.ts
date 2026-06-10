/**
 * push.ts — framework-agnostic Web Push helper (VAPID).
 *
 * Используется и в Next.js API routes, и в воркерах (workers/audit-gen и др.).
 * НЕ импортировать next/* здесь — файл должен работать в обеих средах.
 *
 * Инициализация VAPID ленивая: если ключи пустые — предупреждение + no-op при отправке.
 * При 404/410 от push-сервиса устаревшая подписка автоматически удаляется из БД.
 */

import webpush from 'web-push';
import { db } from './db';
import { logger } from './logger';
import { config } from './config';

const log = logger.child({ module: 'push' });

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// ─── Ленивая инициализация VAPID ──────────────────────────────────────────────

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_APP_URL } = config;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys are not set — push notifications are disabled (no-op)');
    return false;
  }

  // subject: mailto: или URL приложения (стандарт VAPID требует контактный URI)
  const subject = NEXT_PUBLIC_APP_URL.startsWith('http')
    ? NEXT_PUBLIC_APP_URL
    : `mailto:${NEXT_PUBLIC_APP_URL}`;

  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

// ─── Отправка пушей подписчику ────────────────────────────────────────────────

/**
 * Отправляет Web Push уведомление на все устройства указанного subscriber.
 *
 * При ошибке 404/410 от push-сервиса запись удаляется из БД (устаревшая подписка).
 * Остальные ошибки логируются как warn, но не бросаются — аудит/рассылка не должны падать.
 *
 * @returns { sent: number, pruned: number } — счётчики успешных и удалённых подписок.
 */
export async function sendPushToSubscriber(
  subscriberId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapidConfigured()) {
    log.warn({ subscriberId }, 'push skipped — VAPID not configured');
    return { sent: 0, pruned: 0 };
  }

  // Загружаем все подписки данного subscriber
  const subscriptions = await db.pushSubscription.findMany({
    where: { subscriber_id: subscriberId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (!subscriptions.length) {
    log.info({ subscriberId }, 'no push subscriptions found for subscriber');
    return { sent: 0, pruned: 0 };
  }

  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode =
          err instanceof Error && 'statusCode' in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          // Подписка устарела — браузер её удалил, убираем из БД
          log.info(
            { subscriptionId: sub.id, endpoint: sub.endpoint.slice(0, 60), statusCode },
            'push subscription expired — pruning from DB',
          );
          await db.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch((delErr) =>
              log.warn({ subscriptionId: sub.id, delErr: String(delErr) }, 'failed to prune subscription'),
            );
          pruned++;
        } else {
          log.warn(
            {
              subscriptionId: sub.id,
              endpoint: sub.endpoint.slice(0, 60),
              statusCode,
              err: String(err).slice(0, 200),
            },
            'push send error (non-expiry) — skipping',
          );
        }
      }
    }),
  );

  log.info({ subscriberId, sent, pruned }, 'push notifications dispatched');
  return { sent, pruned };
}

/**
 * Отправляет Web Push уведомление всем активным subscribers с подписками.
 * Вспомогательная функция — используется для широких уведомлений.
 */
export async function sendPushToAll(
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapidConfigured()) {
    log.warn('push skipped — VAPID not configured');
    return { sent: 0, pruned: 0 };
  }

  // Уникальные subscriber_id среди всех активных подписок
  const rows = await db.pushSubscription.findMany({
    distinct: ['subscriber_id'],
    select: { subscriber_id: true },
  });

  let totalSent = 0;
  let totalPruned = 0;

  for (const { subscriber_id } of rows) {
    const { sent, pruned } = await sendPushToSubscriber(subscriber_id, payload);
    totalSent += sent;
    totalPruned += pruned;
  }

  return { sent: totalSent, pruned: totalPruned };
}

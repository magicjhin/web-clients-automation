'use server';

/**
 * lead-actions.ts — Next.js Server Actions для управления лидами в дашборде.
 *
 * Каждое действие:
 *   1. Резолвит subscriber через getCurrentSubscriberId()
 *   2. Upsert LeadDelivery (findFirst + create/update) по (subscriber_id, company_id)
 *   3. Инвалидирует кэш страниц через revalidatePath
 *
 * GDPR: действие requestAudit НЕ создаёт LeadDelivery и НЕ отправляет письма.
 *       Письма отправляются ТОЛЬКО после статуса 'confirmed' (подтверждение человеком).
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentSubscriberId } from '@/lib/subscriber';

// ─── Вспомогательная функция: findFirst + create/update ───────────────────────

/**
 * Upsert-like операция для LeadDelivery без unique constraint на (subscriber_id, company_id).
 * Возвращает id записи (существующей или новой).
 */
async function findOrCreateDelivery(
  subscriberId: string,
  companyId: string,
): Promise<string> {
  const existing = await db.leadDelivery.findFirst({
    where: { subscriber_id: subscriberId, company_id: companyId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.leadDelivery.create({
    data: {
      subscriber_id: subscriberId,
      company_id: companyId,
      lead_outcome: 'sent',
      delivered_at: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

function invalidatePaths(companyId: string): void {
  revalidatePath('/');
  revalidatePath('/leads');
  revalidatePath('/review');
  revalidatePath(`/lead/${companyId}`);
}

// ─── Экшены ────────────────────────────────────────────────────────────────────

/**
 * Взять лид в работу: создать LeadDelivery со статусом 'sent' (если ещё нет),
 * обновить last_contacted_at.
 */
export async function takeIntoWork(companyId: string): Promise<void> {
  const subscriberId = await getCurrentSubscriberId();

  const existing = await db.leadDelivery.findFirst({
    where: { subscriber_id: subscriberId, company_id: companyId },
    select: { id: true },
  });

  if (existing) {
    await db.leadDelivery.update({
      where: { id: existing.id },
      data: { last_contacted_at: new Date() },
    });
  } else {
    await db.leadDelivery.create({
      data: {
        subscriber_id: subscriberId,
        company_id: companyId,
        lead_outcome: 'sent',
        delivered_at: new Date(),
        last_contacted_at: new Date(),
      },
    });
  }

  invalidatePaths(companyId);
}

/**
 * Установить исход лида.
 * won → won_at=now(), deal_value=extra.dealValue (опц.)
 * lost → lost_reason=extra.lostReason (опц.)
 * last_contacted_at=now() во всех случаях.
 */
export async function setOutcome(
  companyId: string,
  outcome: 'in_progress' | 'no_response' | 'lost' | 'won',
  extra?: { dealValue?: number; lostReason?: string },
): Promise<void> {
  const subscriberId = await getCurrentSubscriberId();
  const deliveryId = await findOrCreateDelivery(subscriberId, companyId);

  await db.leadDelivery.update({
    where: { id: deliveryId },
    data: {
      lead_outcome: outcome,
      last_contacted_at: new Date(),
      ...(outcome === 'won'
        ? {
            won_at: new Date(),
            deal_value: extra?.dealValue != null ? extra.dealValue : undefined,
          }
        : {}),
      ...(outcome === 'lost'
        ? { lost_reason: extra?.lostReason ?? null }
        : {}),
    },
  });

  invalidatePaths(companyId);
}

/**
 * Запланировать/снять перезвон.
 * isoDate=null — убрать напоминание.
 */
export async function setCallback(companyId: string, isoDate: string | null): Promise<void> {
  const subscriberId = await getCurrentSubscriberId();
  const deliveryId = await findOrCreateDelivery(subscriberId, companyId);

  await db.leadDelivery.update({
    where: { id: deliveryId },
    data: {
      next_call_at: isoDate ? new Date(isoDate) : null,
    },
  });

  invalidatePaths(companyId);
}

/**
 * Сохранить заметку по лиду.
 */
export async function setNote(companyId: string, note: string): Promise<void> {
  const subscriberId = await getCurrentSubscriberId();
  const deliveryId = await findOrCreateDelivery(subscriberId, companyId);

  await db.leadDelivery.update({
    where: { id: deliveryId },
    data: { note },
  });

  invalidatePaths(companyId);
}

/**
 * Поставить лид в очередь аудита.
 * Обновляет enrichment.audit_status='queued', audit_requested_at=now().
 * НЕ создаёт LeadDelivery — аудит можно запросить до взятия в работу.
 * Бросает ошибку, если у компании нет сайта (аудит нет смысла запускать).
 */
export async function requestAudit(companyId: string): Promise<void> {
  const enrichment = await db.enrichment.findUnique({
    where: { company_id: companyId },
    select: { has_website: true, website_url: true, audit_status: true },
  });

  if (!enrichment?.has_website || !enrichment.website_url) {
    throw new Error(
      `[requestAudit] Company ${companyId} has no website — audit cannot be requested.`,
    );
  }

  await db.enrichment.update({
    where: { company_id: companyId },
    data: {
      audit_status: 'queued',
      audit_requested_at: new Date(),
    },
  });

  invalidatePaths(companyId);
}

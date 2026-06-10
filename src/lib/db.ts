/**
 * db.ts — Prisma client singleton
 *
 * В dev-режиме Next.js hot-reload пересоздаёт модули при каждом изменении,
 * что приводит к множеству соединений. Решение — кэш в globalThis.
 * В production globalThis не используется — новый экземпляр на старт процесса.
 *
 * Зависит от: prisma/schema.prisma (генерируется агентом db-schema).
 * Запуск migrate: npm run db:migrate (dev) | npm run db:deploy (prod/CI).
 */

// Грузим .env ДО создания PrismaClient — иначе при локальном запуске воркеров
// (npm run worker:*) DATABASE_URL из .env не попадёт в окружение и Prisma упадёт на старте.
// В Next.js env уже загружен своим механизмом — dotenv тут безвреден (no-op).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Нормализуем DATABASE_URL для Neon (managed Postgres на Vercel):
 * - pgbouncer=true для пулера (-pooler) — иначе Prisma падает «prepared statement already exists»;
 * - sslmode=require (Neon только по TLS);
 * - убираем channel_binding — ломает Rust-движок Prisma.
 * Не-Neon хосты (внутренний Postgres VPS) НЕ трогаем — там без TLS.
 */
function normalizeDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith('neon.tech')) return;
    u.searchParams.delete('channel_binding');
    u.searchParams.set('sslmode', 'require');
    if (u.hostname.includes('-pooler')) u.searchParams.set('pgbouncer', 'true');
    process.env.DATABASE_URL = u.toString();
  } catch {
    // невалидный URL — оставляем как есть, Prisma сам отрапортует
  }
}

normalizeDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

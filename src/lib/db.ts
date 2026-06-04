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

import { PrismaClient } from '@prisma/client';

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

/**
 * config.ts — централизованная конфигурация с валидацией (zod)
 *
 * Читает .env (через dotenv), валидирует все обязательные ключи на старте.
 * Если переменная отсутствует — бросает ошибку с конкретным именем ключа.
 * Экспортирует типизированный объект `config`.
 *
 * Все секреты проекта берутся ТОЛЬКО отсюда. Никогда не читай process.env напрямую.
 *
 * Ключи определены по docs/DEPLOY.md § Секреты.
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // -- Database --
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  // -- Google APIs --
  GOOGLE_PLACES_API_KEY: z.string().min(1, 'GOOGLE_PLACES_API_KEY is required'),
  PAGESPEED_API_KEY: z.string().min(1, 'PAGESPEED_API_KEY is required'),

  // -- Email (Resend) --
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

  // -- LLM --
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  ANTHROPIC_API_KEY: z.string().optional(), // опционально — Claude fallback

  // -- Auth (NextAuth) --
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),

  // -- Web Push (PWA) --
  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY is required'),

  // -- App --
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000'),
});

function parseConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[config] Invalid environment variables:\n${missing}\n\nSee .env.example for required keys.`,
    );
  }

  return result.data;
}

export const config = parseConfig();

// Re-export useful types
export type Config = typeof config;

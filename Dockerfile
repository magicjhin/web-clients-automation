# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────
# Leadgen LT — Multi-stage Dockerfile (Next.js standalone)
# ─────────────────────────────────────────────────────────

# Stage 1: deps — устанавливаем зависимости
FROM node:20-alpine AS deps
WORKDIR /app

# Системные зависимости (для нативных модулей)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# Полный набор (вкл. devDeps): нужны для next build, prisma generate, а в runtime — tsx (воркеры) и prisma CLI (migrate)
RUN npm ci

# Stage 2: builder — сборка Next.js
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma: генерируем клиент (схема обязана быть готова — иначе сборка должна падать)
RUN npx prisma generate

# Next.js build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: runner — минимальный образ для запуска
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Системный пользователь (не root)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 nextjs

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema + engine для migrate deploy (нужны в web-контейнере)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Workers (для запуска через docker compose run или в отдельном контейнере)
COPY --from=builder --chown=nextjs:nodejs /app/workers ./workers
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

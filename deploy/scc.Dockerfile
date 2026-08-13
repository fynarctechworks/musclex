# MuscleX SaaS Control Center backend (NestJS 10 + Prisma 5, scc schema)
# Debian base for reliable prisma engines + bcrypt native build.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 4001
# NOTE: no `prisma migrate deploy` here — SCC uses hand-written idempotent SQL
# (apply-migrations.ts) against the `scc` schema; never auto-migrate the shared DB.
# nest build emits dist/src/main.js here (tsconfig preserves the src/ dir).
CMD ["node", "dist/src/main"]

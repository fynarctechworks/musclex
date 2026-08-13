# MuscleX core backend (NestJS 10 + Prisma 5 multiSchema)
# Debian base: matches prisma binaryTargets ["native","debian-openssl-3.0.x"] (bookworm = openssl 3.0)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Backend has THREE prisma generators (default + per-schema clients).
RUN npx prisma generate --schema=prisma/schema.prisma \
 && npx prisma generate --schema=prisma/schema.public.prisma \
 && npx prisma generate --schema=prisma/schema.tenant.prisma
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/main"]

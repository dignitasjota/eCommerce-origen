# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────
#  eCommerce — Dockerfile multi-stage para producción
#
#  Build:    docker build -t ecommerce:latest .
#  Run:      docker compose up -d
#
#  Diseñado como plantilla: cada despliegue es una instancia nueva. Las
#  claves sensibles (Stripe, SMTP) NO van como env vars — se configuran
#  desde el panel admin tras el primer arranque (tabla SiteSettings).
#
#  Aprovecha `output: 'standalone'` de Next.js para reducir la imagen
#  final a ~250MB en lugar de ~1.2GB con node_modules completo.
# ─────────────────────────────────────────────────────────────────────────

# ─── Stage 1: dependencias ───────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# OpenSSL es requerido por Prisma para Linux (no viene en alpine).
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# `--ignore-scripts` evita correr postinstall (prisma generate) hasta el
# stage de build, donde ya tenemos el código completo.
RUN npm ci --ignore-scripts

# ─── Stage 2: build ──────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL placeholder en build-time: Prisma sólo necesita un string
# válido para generar tipos. La URL real llega como env var en runtime.
ENV DATABASE_URL="mysql://placeholder:placeholder@placeholder:3306/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache openssl libc6-compat tini wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Salida standalone de Next: incluye `server.js` autónomo + un node_modules
# pruned con sólo las deps necesarias en runtime.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma no se incluye en standalone — copiamos schema, engine binary y CLI
# para que el entrypoint pueda ejecutar `prisma db push` en arranque.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=build --chown=nextjs:nodejs /app/node_modules/mariadb ./node_modules/mariadb

# Scripts de bootstrap.
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chown=nextjs:nodejs scripts/seed-bootstrap.mjs /app/scripts/seed-bootstrap.mjs

# Directorios writable montables como volúmenes en docker-compose.
RUN mkdir -p /app/public/uploads /app/public/themes && \
    chown -R nextjs:nodejs /app/public/uploads /app/public/themes && \
    chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# tini captura SIGTERM correctamente cuando Portainer hace stop/restart.
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]

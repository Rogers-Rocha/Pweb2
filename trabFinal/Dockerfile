# syntax=docker/dockerfile:1

# ---------- 1) dependências + build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- 2) imagem final (somente produção) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
# 'prisma' (CLI) está em dependencies para permitir 'migrate deploy' dentro do container.
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]

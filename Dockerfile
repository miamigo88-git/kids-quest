FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++ \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev --build-from-source=better-sqlite3 \
    && npm cache clean --force

# -----------------------------------------------------------

FROM node:20-alpine AS runtime

RUN apk add --no-cache tini \
    && addgroup -g 1000 -S app \
    && adduser -u 1000 -S app -G app

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY frontend/public ./frontend/public

RUN mkdir -p /data && chown -R app:app /app /data

USER app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/kids_dashboard.db \
    STATIC_DIR=/app/frontend/public \
    DEFAULT_PARENT_PIN=1234

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]

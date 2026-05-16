# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Server source (tsx runs TypeScript directly)
COPY server/ server/
COPY src/db/ src/db/
COPY src/types/ src/types/
COPY src/schemas/ src/schemas/
COPY src/domain/ src/domain/
COPY src/utils/ src/utils/
COPY src/services/ src/services/
COPY src/lib/export/ src/lib/export/

# Vite build output
COPY --from=build /app/dist/ dist/

ENV PORT=3000
EXPOSE 3000

# Data directory — mount a volume here for persistence
VOLUME /app/data
ENV DB_PATH=/app/data/travel.db

CMD ["npx", "tsx", "--tsconfig", "server/tsconfig.json", "server/index.ts"]

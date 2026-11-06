# Passku (Next.js + better-sqlite3), production image. Run with docker-compose.yml in this folder.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Toolchain in case better-sqlite3 has no prebuilt binary for this Node version.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# The session module requires the secret at import time; the real one is only given at runtime.
RUN PASSKU_SESSION_SECRET=build-only PASSKU_DATA_DIR=/tmp/build-data npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PASSKU_DATA_DIR=/app/data
# devDependencies stay: next.config.ts needs typescript at `next start`.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]

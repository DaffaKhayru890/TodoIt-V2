# syntax=docker/dockerfile:1

# ---- base: fondasi runtime Bun + folder kerja ----
FROM oven/bun:1.4.4-slim AS base
WORKDIR /app
COPY package.json bun.lock ./

# ---- dependencies: seluruh dependency (termasuk dev) untuk dev & build ----
FROM base AS dependencies
RUN bun install --frozen-lockfile

# ---- development: hot reload, source di-bind-mount lewat compose ----
FROM dependencies AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 4000
CMD ["bun", "run", "dev"]

# ---- build: typecheck lalu bundle source ke dist ----
FROM dependencies AS build
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN bun run typecheck
RUN bun build src/main.ts --outdir=dist --target=bun

# ---- production: runtime dependency saja, non-root, tanpa .env ----
FROM oven/bun:1.4.4-slim AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build --chown=bun:bun /app/dist ./dist
ENV NODE_ENV=production
USER bun
EXPOSE 4000
# HEALTHCHECK memakai exec form agar tidak butuh shell/curl di image.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "const r=await fetch(`http://127.0.0.1:${process.env.APP_PORT ?? 4000}/health`);process.exit(r.ok?0:1)"]
CMD ["bun", "run", "dist/main.js"]

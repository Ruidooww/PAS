FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat && corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG API_BASE_URL=http://pas-api:3001
ENV API_BASE_URL=$API_BASE_URL

COPY tsconfig.base.json ./
COPY eslint.config.mjs ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN pnpm install --frozen-lockfile --offline
RUN mkdir -p apps/web/public
RUN pnpm --filter @pas/shared build
RUN pnpm --filter web build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache libc6-compat wget

WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

HEALTHCHECK --interval=10s --timeout=3s --retries=12 --start-period=20s \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]

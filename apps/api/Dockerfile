FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@11.5.3 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY packages/shared/package.json packages/shared/package.json
COPY packages/clients/package.json packages/clients/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/clients packages/clients
COPY apps/api apps/api

RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @pas/shared build
RUN pnpm --filter @pas/clients build
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM base AS prod-deps

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY packages/shared/package.json packages/shared/package.json
COPY packages/clients/package.json packages/clients/package.json

RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3001
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

RUN apk add --no-cache libc6-compat wget && corepack enable && corepack prepare pnpm@11.5.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/clients/package.json ./packages/clients/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prompts ./apps/api/prompts
COPY --from=builder /app/apps/api/config ./apps/api/config
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/clients/dist ./packages/clients/dist

WORKDIR /app/apps/api

HEALTHCHECK --interval=10s --timeout=3s --retries=12 --start-period=20s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/main.js"]

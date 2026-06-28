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

RUN pnpm install --prod --frozen-lockfile && \
  rm -rf \
    apps/api/node_modules/.bin/prisma \
    apps/api/node_modules/.bin/prisma.CMD \
    apps/api/node_modules/.bin/prisma.ps1 \
    apps/api/node_modules/prisma \
    node_modules/.pnpm/@babel+* \
    node_modules/.pnpm/@prisma+config@* \
    node_modules/.pnpm/@prisma+debug@* \
    node_modules/.pnpm/@prisma+engines@* \
    node_modules/.pnpm/@prisma+engines-version@* \
    node_modules/.pnpm/@prisma+fetch-engine@* \
    node_modules/.pnpm/@prisma+get-platform@* \
    node_modules/.pnpm/c12@* \
    node_modules/.pnpm/chokidar@* \
    node_modules/.pnpm/confbox@* \
    node_modules/.pnpm/deepmerge-ts@* \
    node_modules/.pnpm/destr@* \
    node_modules/.pnpm/effect@* \
    node_modules/.pnpm/empathic@* \
    node_modules/.pnpm/exsolve@* \
    node_modules/.pnpm/fast-check@* \
    node_modules/.pnpm/giget@* \
    node_modules/.pnpm/jiti@* \
    node_modules/.pnpm/magicast@* \
    node_modules/.pnpm/node-fetch-native@* \
    node_modules/.pnpm/nypm@* \
    node_modules/.pnpm/ohash@* \
    node_modules/.pnpm/pathe@* \
    node_modules/.pnpm/perfect-debounce@* \
    node_modules/.pnpm/pkg-types@* \
    node_modules/.pnpm/prisma@* \
    node_modules/.pnpm/rc9@* \
    node_modules/.pnpm/readdirp@* \
    node_modules/.pnpm/tinyexec@* \
    node_modules/.pnpm/typescript@* && \
  find node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime -type f \( \
    -name "*.map" -o \
    -name "*wasm*" -o \
    -name "binary.*" -o \
    -name "edge*" -o \
    -name "index-browser*" -o \
    -name "react-native*" \
  \) -delete && \
  rm -rf \
    node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/generator-build \
    node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/scripts

FROM builder AS migrator

ENV NODE_ENV=production

WORKDIR /app

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache libc6-compat wget

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

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS builder
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/types/package.json packages/types/
COPY packages/validators/package.json packages/validators/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/package.json apps/api/

# Install all deps
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build everything
RUN pnpm --filter @mecanix/types build && \
    pnpm --filter @mecanix/validators build && \
    pnpm --filter @mecanix/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy entire built workspace — simpler and reliable with pnpm's symlinking
COPY --from=builder /app/ ./

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

# syntax=docker/dockerfile:1.7

FROM node:22-slim AS build

RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @issues/api deploy --prod --legacy /deploy

FROM node:22-slim AS production

RUN apt-get update \
 && apt-get install -y --no-install-recommends libvips42 ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/src ./src
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/drizzle.config.ts ./drizzle.config.ts

RUN mkdir -p /app/data/uploads

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/tsx", "src/index.ts"]

# syntax=docker/dockerfile:1.7

FROM node:22-slim AS build

RUN corepack enable

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# apps/api source is required at build time so Hono RPC types resolve from @issues/api.
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY apps/web apps/web

ARG PUBLIC_API_URL=""
ENV PUBLIC_API_URL=${PUBLIC_API_URL}

WORKDIR /repo/apps/web
RUN pnpm build

WORKDIR /repo
RUN pnpm --filter web deploy --prod --legacy /deploy

FROM node:22-slim AS production

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

WORKDIR /app

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/web/build ./build

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]

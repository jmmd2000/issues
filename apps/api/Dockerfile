# syntax=docker/dockerfile:1.7

FROM node:26-slim AS build

# Node 25+ no longer ships corepack, so install it before enabling it.
RUN npm install -g corepack@0.36.0 \
 && corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @issues/api build
RUN pnpm --filter @issues/api deploy --prod --legacy /deploy

FROM node:26-slim AS production

RUN apt-get update \
 && apt-get install -y --no-install-recommends libvips42 ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

ARG GIT_SHA=dev
ARG BUILT_AT=""

ENV NODE_ENV=production
ENV PORT=4000
ENV GIT_SHA=${GIT_SHA}
ENV BUILT_AT=${BUILT_AT}

WORKDIR /app

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle

RUN mkdir -p /app/data/uploads

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--enable-source-maps", "dist/index.js"]

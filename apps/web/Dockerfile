# syntax=docker/dockerfile:1.10

FROM node:26-slim AS build

# The slim image has no CA certificates, and the source map upload needs them to trust GlitchTip.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Node 25+ no longer ships corepack, so install it before enabling it.
RUN npm install -g corepack@0.36.0 \
 && corepack enable

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

ARG GIT_SHA=dev
ARG BUILT_AT=""
ENV GIT_SHA=${GIT_SHA}
ENV BUILT_AT=${BUILT_AT}

WORKDIR /repo/apps/web
RUN pnpm build

# Source maps. The inject step stamps a debug ID into each bundle, and GlitchTip matches it to the uploaded map.
# The upload needs the token, so a build without it skips the upload. A failed upload warns and the build goes on.
# The step prints GIT_SHA and BUILT_AT so Docker runs it again for every build, and a failed upload is never cached.
# The adapter bundles the server files again and its maps point to the first build's files, so the chain step joins them to the originals.
# The maps are deleted afterwards, so the image never serves them.
# The inject step changes the scripts, so the compressed copies the adapter made are made again.
# Do not set SENTRY_LOG_LEVEL=debug here, because it can print the token.
ENV SENTRY_URL=https://glitchtip.vps.jamesmddoyle.com SENTRY_ORG=james-org SENTRY_PROJECT=issues-web
RUN --mount=type=secret,id=glitchtip_token,env=SENTRY_AUTH_TOKEN \
    echo "Source maps for $GIT_SHA built at $BUILT_AT" \
 && node scripts/chainSourceMaps.mjs build/server \
 && pnpm exec sentry-cli sourcemaps inject build \
 && if [ -n "$SENTRY_AUTH_TOKEN" ]; then \
      pnpm exec sentry-cli sourcemaps upload --release "$GIT_SHA" build \
        || echo "WARNING: source map upload failed"; \
    else echo "No GlitchTip token, so the source maps are not uploaded"; fi \
 && find build -name "*.map" -delete \
 && node scripts/compressBuild.mjs build/client

WORKDIR /repo
RUN pnpm --filter web deploy --prod --legacy /deploy

FROM node:26-slim AS production

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

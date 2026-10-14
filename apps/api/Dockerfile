# API and queue worker image. Build from the repository root:
#   docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests first so dependency installs are cached between code changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @leadpilot/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @leadpilot/shared build && pnpm --filter @leadpilot/api build
# A self-contained copy of the API with production dependencies only (the shared package is copied in)
RUN pnpm --filter @leadpilot/api deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 4000
# Migrations run before every start; they are idempotent
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]

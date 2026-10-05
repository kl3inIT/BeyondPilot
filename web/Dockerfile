# syntax=docker/dockerfile:1.7
# Build from the repository root: docker build -f web/Dockerfile .

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build

# pnpm at the version package.json pins, installed directly rather than through Corepack.
RUN npm install --global pnpm@11.27.1

WORKDIR /workspace/web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# The generated API client is committed, so the build needs no openapi.yml.
COPY web ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="BeyondPilot Web" \
      org.opencontainers.image.source="https://github.com/kl3inIT/BeyondPilot" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

WORKDIR /application
# The standalone output holds the server and only the modules it traces; static files are copied beside it.
COPY --from=build --chown=1000:1000 /workspace/web/.next/standalone ./
COPY --from=build --chown=1000:1000 /workspace/web/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /workspace/web/public ./public

# BEYONDPILOT_API_ORIGIN, the backend the server renders against, is set by the composition.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

USER node
EXPOSE 3000
CMD ["node", "server.js"]

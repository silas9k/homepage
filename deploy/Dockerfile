FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.8.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 LOG_TARGETS=stdout
LABEL org.opencontainers.image.title="silasnet. Homepage" \
      org.opencontainers.image.licenses="GPL-3.0-only"
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts/auth-admin.cjs ./scripts/auth-admin.cjs
COPY --from=builder --chown=node:node /app/scripts/auth-backup.cjs ./scripts/auth-backup.cjs
COPY --from=builder --chown=node:node /app/src/utils/auth/store.cjs ./src/utils/auth/store.cjs
RUN mkdir -p /app/data/auth && chown node:node /app/data/auth && chmod 700 /app/data/auth
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

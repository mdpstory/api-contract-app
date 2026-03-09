# ─── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace root files (needed for monorepo resolution)
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install all deps (including devDependencies for build)
RUN bun install --frozen-lockfile

# Build the web app (output: apps/web/dist)
WORKDIR /app/apps/web
RUN bun run build

# ─── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace root (needed for monorepo lockfile)
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install production dependencies
RUN bun install --frozen-lockfile --production

WORKDIR /app/apps/api

# Run migrations then start server
CMD sh -c "bun run src/db/migrate.ts && bun run src/main.ts"

# API Contract App

A self-hosted tool for defining, sharing, and validating API contracts between frontend and backend teams.

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | Vite + React + TanStack Router/Query |
| Backend  | Hono.js + Bun                     |
| Database | PostgreSQL / Neon                 |
| Auth     | Magic Link + Session 30 days      |
| Email    | Resend                            |
| UI       | shadcn/ui + Tailwind v4           |

## Features

- **Magic Link Auth** — passwordless login, session persists 30 days
- **Projects** — organize contracts by service/team, invite members
- **Contract Editor** — define method, path, request/response schema with JSON preview
- **Versioning** — every save creates a snapshot with automatic diff (who, when, what changed)
- **Environments** — manage reusable variables (`{{BASE_URL}}`, `{{TOKEN}}`) per project
- **Validation Runner** — hit a real API endpoint and validate response against the contract schema
- **Export** — download any contract as OpenAPI 3.0 JSON

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0

### Setup

```bash
# Clone and install
bun install

# Setup environment
cp .env.example .env
# Edit .env with your values (see table below)

# Apply database schema
cd apps/api && bun run db:migrate && cd ../..

# Start both servers (in separate terminals)
bun run dev:api    # API on http://localhost:3030
bun run dev:web    # Web on http://localhost:5173
```

In development, if `RESEND_API_KEY` is empty, magic links are printed to the API console — no email needed.

### Environment Variables (`.env` at repo root)

| Variable          | Default                       | Description                                          |
|-------------------|-------------------------------|------------------------------------------------------|
| `DATABASE_URL`    | *(required)*                  | PostgreSQL connection string                         |
| `PORT`            | `3030`                        | API server port                                      |
| `JWT_SECRET`      | `replace-this-in-production`  | JWT signing secret; required in production           |
| `WEB_URL`         | `http://localhost:5173`       | Frontend URL (for CORS + magic link redirect)        |
| `RESEND_API_KEY`  | *(empty)*                     | Resend API key — empty = console fallback in dev     |
| `EMAIL_FROM`      | `onboarding@resend.dev`       | Sender email (use your verified domain in prod)      |
| `VITE_API_PORT`   | `3030`                        | Web dev proxy target port for `/api`                 |

## Self-hosted Deployment (Docker Compose)

### 1. Configure environment

Set the required variables in your shell environment or in a `.env` file **at the project root** (Docker Compose auto-reads it):

```bash
# .env (at repo root)
WEB_URL=https://contracts.yourdomain.com
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### 2. Build and run

```bash
docker compose up -d --build
```

- **Web** — available at port `80` (put behind a reverse proxy for HTTPS)
- **API** — available at port `3001` (internal; nginx proxies `/api` from the web container)
- **Database** — external PostgreSQL instance referenced by `DATABASE_URL`

Database migrations run automatically on container startup.

### 3. HTTPS (recommended)

Use a reverse proxy such as [Caddy](https://caddyserver.com) or [nginx](https://nginx.org) in front of port `80`:

**Caddyfile example:**

```
contracts.yourdomain.com {
    reverse_proxy localhost:80
}
```

Set `WEB_URL=https://contracts.yourdomain.com` so magic link emails contain the correct URL.

### 4. Email setup for production

The Resend free tier only sends to the email address you registered with. To send to any address:

1. Add and verify your domain at [resend.com/domains](https://resend.com/domains)
2. Set `EMAIL_FROM=noreply@yourdomain.com`
3. Set `RESEND_API_KEY` to your Resend API key

### Verifying your deployment

```bash
curl http://localhost:3001/health
# → {"status":"ok"}
```

## Project Structure

```
api-contract-app/
├── apps/
│   ├── web/                   # Vite + React frontend
│   │   ├── Dockerfile
│   │   ├── nginx.conf         # Production nginx config (SPA + API proxy)
│   │   └── src/
│   │       ├── routes/        # Page components (TanStack Router)
│   │       ├── features/      # Feature modules (api + hooks + components)
│   │       ├── components/    # Shared UI components
│   │       └── lib/           # Utilities
│   └── api/                   # Hono.js backend
│       ├── Dockerfile
│       └── src/
│           ├── routes/        # Route handlers (one file per resource)
│           ├── db/            # Drizzle schema + migrations
│           ├── middleware/    # Auth, CORS
│           └── lib/           # Utilities (diff, interpolate, email)
├── packages/
│   └── types/                 # Shared TypeScript types
├── docker-compose.yml
├── AGREEMENT.md               # Architecture & design decisions
└── TASK.md                    # Development progress
```

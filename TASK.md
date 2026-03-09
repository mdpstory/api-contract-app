# Task Progress

Legend: `[ ]` pending | `[~]` in progress | `[x]` done

---

## Phase 1 — Project Setup
- [x] Init monorepo dengan Bun workspaces
- [x] Setup `apps/web` (Vite + React + TanStack Router + TanStack Query)
- [x] Setup `apps/api` (Hono.js + Bun)
- [x] Setup `packages/types` (shared types: auth, project, contract, environment, validation)
- [x] Setup Drizzle ORM + SQLite driver + migrations
- [x] Setup Tailwind v4 + design tokens (warna, font Inter, JetBrains Mono)
- [x] Setup Docker Compose
- [x] Setup Hono RPC connection FE ↔ BE

## Phase 2 — Auth
- [x] Drizzle schema: users, sessions, magic_links
- [x] Endpoint: POST /auth/send-magic-link
- [x] Endpoint: GET /auth/verify?token=xxx
- [x] Endpoint: POST /auth/logout
- [x] Endpoint: GET /auth/me
- [x] Session cookie: HttpOnly, 30 hari
- [x] Halaman /auth/login
- [x] Halaman /auth/verify (auto-verify dari URL)
- [x] Auth middleware (protect semua route)
- [x] Auth guard FE (redirect ke login)
- [x] Resend integrasi + dev console fallback

## Phase 3 — Projects
- [x] Drizzle schema: projects, project_members
- [x] Endpoint: GET /projects
- [x] Endpoint: POST /projects (+ auto-create Global environment)
- [x] Endpoint: GET /projects/:id
- [x] Endpoint: PUT /projects/:id
- [x] Endpoint: DELETE /projects/:id
- [x] Endpoint: GET/POST/DELETE /projects/:id/members
- [x] Halaman /dashboard — list project + optimistic update
- [x] Halaman /projects/$id/settings — invite & kelola member

## Phase 4 — Contracts
- [x] Drizzle schema: contracts
- [x] Endpoint: GET/POST /projects/:id/contracts
- [x] Endpoint: GET/PUT/DELETE /projects/:id/contracts/:cid
- [x] Endpoint: PATCH /projects/:id/contracts/:cid/status
- [x] Halaman /projects/$id — list contracts + filter Draft/Approved + search
- [x] Halaman /projects/$id/contracts/$cid — editor dengan tab
- [x] Form editor: Method, Path, Name, Schema builder (field + type + required)
- [x] JSON preview realtime di samping form editor
- [x] Tombol Save (manual, tidak autosave)
- [x] Toggle status Draft ↔ Approved
- [x] Delete contract

## Phase 5 — Contract Versioning
- [x] Drizzle schema: contract_versions
- [x] Logic auto-create version saat save
- [x] Logic generate diff field-per-field
- [x] Logic generate changeSummary otomatis
- [x] Endpoint: GET /contracts/:cid/versions
- [x] Endpoint: GET /contracts/:cid/versions/:vid
- [x] Tab "History" — timeline view (siapa, kapan, ringkasan)
- [x] Modal diff viewer: side-by-side (method, path, schema fields)
- [x] Warna diff: hijau (+), merah (-), amber (~)
- [x] Legend: + Added, - Removed, ~ Changed

## Phase 6 — Environments
- [x] Drizzle schema: environments, env_variables
- [x] Auto-create Global environment saat project dibuat
- [x] Endpoint: GET/POST/PUT/DELETE /projects/:id/environments
- [x] Halaman /projects/$id/environments — list environments
- [x] Modal "New Environment": label + variables + Add new + empty state
- [x] Modal "Edit Environment": isi data existing
- [x] UI Global environment (icon berbeda, tidak bisa dihapus/rename)

## Phase 7 — Validation Runner
- [x] Endpoint: POST /projects/:id/contracts/:cid/validate
- [x] Logic injeksi variabel {{key}} dari environment
- [x] Logic merge Global environment variables
- [x] Logic validasi response vs schema (field-per-field)
- [x] Tab "Validate" — input URL + env picker + headers + body
- [x] UI hasil validasi per field (hijau/merah)
- [x] Simpan hasil ke validation_runs

## Phase 8 — Export
- [x] Logic convert schema → OpenAPI 3.0 JSON
- [x] Endpoint: GET /contracts/:cid/export/openapi
- [x] Tombol Export di halaman contract detail
- [x] Download langsung sebagai .json

## Phase 9 — Polish & Deployment
- [x] Docker Compose setup
- [x] .env.example
- [x] Dockerfiles (apps/api/Dockerfile, apps/web/Dockerfile, apps/web/nginx.conf)
- [x] Loading states konsisten (skeleton + spinner di semua query)
- [x] Error handling konsisten — isError di semua query, onError di semua mutasi termasuk validate & logout
- [x] Empty states semua halaman (dashboard, contracts, members, environments, history, validate)
- [x] README cara deploy (Docker Compose, HTTPS, Resend, healthcheck)

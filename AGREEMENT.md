# API Contract App - Project Agreement

## Tech Stack

| Layer       | Tech                                     |
|-------------|------------------------------------------|
| Monorepo    | Bun workspaces                           |
| Frontend    | Vite + React + TanStack Router/Query     |
| Backend     | Hono.js + Bun runtime                    |
| ORM         | Drizzle ORM                              |
| Database    | SQLite (dev) → PostgreSQL (prod)         |
| Auth        | Lucia v3 + Magic Link + Session 30 hari  |
| Email       | Resend (free tier)                       |
| UI Library  | shadcn/ui + Tailwind v4                  |
| Font UI     | Inter                                    |
| Font Code   | JetBrains Mono                           |
| Type Safety | Hono RPC (shared types FE ↔ BE)         |
| Validation  | Zod                                      |
| Deployment  | Docker Compose (self-hosted)             |

---

## Design System

### Color Palette (Dark Theme - Default)

| Token            | Hex                    | Penggunaan                       |
|------------------|------------------------|----------------------------------|
| bg-base          | #0F1117                | Background utama (paling gelap)  |
| bg-surface       | #161B22                | Card, panel                      |
| bg-elevated      | #1C2128                | Modal, dropdown                  |
| bg-overlay       | #21262D                | Hover, active state              |
| text-primary     | #E6EDF3                | Teks utama                       |
| text-secondary   | #8B949E                | Label, placeholder               |
| text-muted       | #484F58                | Disabled, sangat subtle          |
| accent-primary   | #7C6AF7                | Tombol utama, link aktif         |
| accent-hover     | #9585F8                | Hover state accent               |
| success          | #3FB950                | Status sukses                    |
| error            | #F85149                | Status error                     |
| warning          | #D29922                | Status warning                   |
| info             | #58A6FF                | Status info                      |
| diff-add-bg      | rgba(63,185,80,0.15)   | Background diff tambah           |
| diff-add-text    | #3FB950                | Teks diff tambah (+)             |
| diff-remove-bg   | rgba(248,81,73,0.15)   | Background diff hapus            |
| diff-remove-text | #F85149                | Teks diff hapus (-)              |
| diff-change-bg   | rgba(210,153,34,0.15)  | Background diff ubah             |
| diff-change-text | #D29922                | Teks diff ubah (~)               |
| border-subtle    | #30363D                | Border halus                     |
| border-default   | #3D444D                | Border default                   |

### Design Principles

- Semua padding, margin, spacing, sizing HARUS konsisten via Tailwind design tokens
- Dark mode ONLY (tidak ada light mode toggle)
- Tidak ada autosave — semua perubahan harus manual save
- UI harus jelas, mudah dipahami, tidak membingungkan
- Font UI: Inter | Font Code/JSON: JetBrains Mono

---

## Prinsip Coding

- **Feature-based folder structure** — setiap fitur punya folder sendiri
- **Single Responsibility** — setiap file satu tanggung jawab, maksimal ~150 baris
- **Explicit over implicit** — tidak ada magic, kode mudah di-trace
- **Modular & Scalable** — mudah ditambah fitur baru tanpa refactor besar
- **Manual Save** — tidak ada autosave, user harus klik Save secara eksplisit
- **Hono RPC** — type-safe dari backend ke frontend, tidak ada type mismatch
- **Optimistic Updates** — UI update sebelum API response untuk feel cepat

---

## Struktur Monorepo

```
api-contract-app/
├── apps/
│   ├── web/                      → Vite + React (Frontend)
│   │   └── src/
│   │       ├── routes/           → Halaman per route
│   │       ├── components/       → UI components global
│   │       ├── features/         → Feature modules
│   │       │   ├── contracts/
│   │       │   │   ├── api.ts
│   │       │   │   ├── components/
│   │       │   │   └── hooks.ts
│   │       │   ├── environments/
│   │       │   ├── projects/
│   │       │   └── auth/
│   │       └── lib/              → Shared utilities
│   │
│   └── api/                      → Hono.js + Bun (Backend)
│       └── src/
│           ├── routes/           → Route handlers modular
│           │   ├── auth.ts
│           │   ├── projects.ts
│           │   ├── contracts.ts
│           │   └── environments.ts
│           ├── db/
│           │   ├── schema.ts     → Drizzle schema
│           │   └── queries/      → Query modular per entity
│           ├── middleware/       → Auth, CORS, logging
│           └── main.ts
│
├── packages/
│   ├── types/                    → Shared Hono RPC types
│   └── ui/                       → shadcn/ui components shared
│
├── AGREEMENT.md
├── TASK.md
├── bun.workspace.toml
└── docker-compose.yml
```

---

## Database Schema

### users
| Field     | Type         |
|-----------|--------------|
| id        | text (uuid)  |
| email     | text unique  |
| name      | text         |
| createdAt | timestamp    |

### sessions (Lucia Auth)
| Field     | Type                          |
|-----------|-------------------------------|
| id        | text                          |
| userId    | text (FK → users)             |
| expiresAt | timestamp (30 hari dari login)|
| createdAt | timestamp                     |

### magic_links
| Field     | Type                      |
|-----------|---------------------------|
| id        | text                      |
| userId    | text (FK → users)         |
| token     | text (hashed)             |
| expiresAt | timestamp (15 menit)      |

### projects
| Field       | Type        |
|-------------|-------------|
| id          | text (uuid) |
| name        | text        |
| description | text        |
| ownerId     | text (FK)   |
| createdAt   | timestamp   |

### project_members
| Field     | Type                  |
|-----------|-----------------------|
| projectId | text (FK)             |
| userId    | text (FK)             |
| role      | text (owner/member)   |
| joinedAt  | timestamp             |

### contracts
| Field          | Type                                    |
|----------------|-----------------------------------------|
| id             | text (uuid)                             |
| projectId      | text (FK)                               |
| name           | text                                    |
| method         | text (GET/POST/PUT/PATCH/DELETE)        |
| path           | text                                    |
| status         | text (draft/approved)                   |
| requestSchema  | text (JSON)                             |
| responseSchema | text (JSON)                             |
| createdAt      | timestamp                               |
| updatedAt      | timestamp                               |

### contract_versions
| Field         | Type            | Keterangan                        |
|---------------|-----------------|-----------------------------------|
| id            | text (uuid)     |                                   |
| contractId    | text (FK)       |                                   |
| version       | integer         | Auto-increment per contract       |
| changedBy     | text (FK userId)|                                   |
| changedAt     | timestamp       |                                   |
| changeSummary | text            | Ringkasan otomatis                |
| snapshot      | text (JSON)     | Full contract state saat itu      |
| diff          | text (JSON)     | Perbandingan dari versi sebelumnya|

### environments
| Field     | Type        |
|-----------|-------------|
| id        | text (uuid) |
| projectId | text (FK)   |
| name      | text        |
| isGlobal  | boolean     |
| createdAt | timestamp   |

### env_variables
| Field         | Type        |
|---------------|-------------|
| id            | text (uuid) |
| environmentId | text (FK)   |
| key           | text        |
| value         | text        |

### validation_runs
| Field          | Type            |
|----------------|-----------------|
| id             | text (uuid)     |
| contractId     | text (FK)       |
| environmentId  | text (FK, null) |
| url            | text            |
| requestHeaders | text (JSON)     |
| requestBody    | text (JSON)     |
| result         | text (passed/failed) |
| details        | text (JSON)     |
| createdAt      | timestamp       |

---

## Fitur Lengkap

### 1. Auth - Magic Link
- Login via email, tanpa password
- Email dikirim via Resend
- Link expired dalam 15 menit
- Setelah klik link → session dibuat, berlaku 30 hari
- Idle timeout: 7 hari tidak aktif → auto logout
- Cookie: HttpOnly, Secure, SameSite=Lax

### 2. Projects
- CRUD project (nama, deskripsi)
- Invite member via email
- Setiap project punya member list

### 3. Contract Editor
- Fields: Name, Method, Path, Status
- Request Body schema: tambah/hapus field (nama + tipe data)
- Response schema: tambah/hapus field (nama + tipe data)
- Preview JSON realtime di samping form
- Status toggle: Draft / Approved
- **Manual save** — tidak ada autosave
- Setiap save → otomatis buat contract_version baru

### 4. Contract Versioning
- Setiap save contract → snapshot disimpan
- Tercatat: siapa (user), kapan (timestamp), apa yang berubah (diff)
- Tab "History" di halaman contract detail
- Timeline view per versi
- Diff viewer: side-by-side Before vs After
- Warna diff: hijau (tambah), merah (hapus), amber (ubah)
- Legend: + Added, - Removed, ~ Changed

### 5. Environments
- Setiap project punya list environments
- Ada satu **Global** environment (berlaku untuk semua)
- Bisa tambah environment custom (nama bebas)
- Setiap environment punya key-value variables
- UI modal: Label input + tabel variables + tombol + Add new
- Empty state dengan ilustrasi saat belum ada variable
- Variabel bisa dipakai di contract dengan sintaks `{{namaVariabel}}`
- (Secrets: diabaikan untuk MVP)

### 6. Validation Runner
- Input: URL backend asli (bisa pakai `{{variabel}}`)
- Pilih environment aktif untuk inject variabel
- Input: Headers (key-value)
- Input: Request body (JSON editor)
- Tombol "Run Validation"
- Output: field-per-field hasil validasi vs schema contract
- Warna: hijau (valid), merah (invalid/missing)
- Streaming response (hasil muncul bertahap)

### 7. Export
- Export contract sebagai OpenAPI/Swagger JSON
- Download langsung dari browser

---

## Halaman & Routes

| Route                                     | Deskripsi                                           |
|-------------------------------------------|-----------------------------------------------------|
| `/`                                       | Redirect ke dashboard atau login                    |
| `/auth/login`                             | Form input email magic link                         |
| `/auth/verify`                            | Halaman "Cek email Anda"                            |
| `/dashboard`                              | Daftar semua project                                |
| `/projects/new`                           | Form buat project baru                              |
| `/projects/$id`                           | List contracts dalam project                        |
| `/projects/$id/settings`                  | Invite member, kelola member                        |
| `/projects/$id/environments`              | Manage environments & variables                     |
| `/projects/$id/contracts/new`             | Form buat contract baru                             |
| `/projects/$id/contracts/$cid`            | Detail + edit contract (tab: Definition, History, Validate) |

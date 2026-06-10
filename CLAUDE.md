# BookStore — مكتبة البيان

Islamic / academic bookstore platform. NestJS backend + React (Vite) frontend, PostgreSQL via Prisma. Arabic-first UI (RTL).

## Stack

- **Backend**: NestJS, Prisma, PostgreSQL — entry `src/main.ts`, root module `src/app.module.ts`. Served at `http://localhost:3000`, API prefix `/api/v1`.
- **Frontend (two separate apps, same backend/DB):**
  - `frontend/` — **public storefront**. Entry `frontend/src/main.tsx`. Dev `http://localhost:5173`.
  - `admin/` — **admin dashboard**, its own Vite app/build, served under base `/admin/`. Dev `http://localhost:5175/admin/`. Deploy independently (subdomain or `/admin` path). Shares a few files with the public app by duplication (`lib/queries.ts`, `lib/types.ts`, `lib/api.ts`, `components/logo.tsx`).
  - Both are React + Vite + TS + Tailwind (Base UI / shadcn-style primitives) + TanStack Query, and both proxy `/api` → backend.
- **DB**: Prisma schema at `prisma/schema.prisma`, migrations under `prisma/migrations/`.

## Backend modules (`src/modules/`)

Public storefront:
- `books/` — book catalog reads
- `academic/` — fields → years → subjects → books taxonomy
- `requests/` — customer book-request leads (with WhatsApp redirect)
- `import/` — CSV/XLSX bulk import
- `images/` — book cover image serving
- `image-sync/` — match phone photos to books via filename + OCR
- `clean/` — data cleanup utilities

Admin back office (`src/modules/admin/`, mounted at `/api/v1/admin/*`):
- `admin.module.ts` + `store-resolver.service.ts` — wiring
- `stats/` — analytics overview
- `orders/` — multi-item orders + status workflow
- `books/` — admin CRUD + `dto/upsert-book.dto.ts`
- `catalog/` — catalog management + `dto/upsert-catalog.dto.ts`
- `academic/` — taxonomy admin
- `inventory/` — stock management
- `uploads/` — cover-photo upload → Cloudflare R2 (multipart)

Shared infra:
- `src/modules/storage/` — `StorageService` wraps Cloudflare R2 (S3 SDK). Global module; `enabled` is false unless all `R2_*` env vars are set, then falls back to local disk. Env loaded via `@nestjs/config`.

Auth & hardening:
- `auth/` (`src/modules/admin/auth/`) — `POST /api/v1/admin/auth/login` exchanges the shared `ADMIN_PASSWORD` (env) for a 30-day JWT (`JWT_SECRET`). `AdminAuthGuard` (`src/common/guards/`) protects ALL admin controllers plus the operational endpoints (`import`, `images/fill`, `image-sync`, `clean`, and requests list/status). Public: catalog reads, academic reads, request **create**.
- Global rate limit 300 req/min/IP (`@nestjs/throttler`); login 10/min; public request create 5/min. `helmet` + env-driven CORS (`CORS_ORIGINS`) in `main.ts`. Health probe at `GET /api/v1/health`.
- ⚠️ `AdminModule` must stay **before** the public modules in `app.module.ts` imports — its literal routes (`v1/admin/books`) must register before the `v1/:storeSlug/...` wildcards or admin GETs 404.

## Frontend pages (`frontend/src/pages/`)

Public: `home.tsx`, `search.tsx`, `book.tsx`, `academic/{fields,years,subjects,subject-books}.tsx`

Admin (separate app — `admin/src/pages/admin/`, served at `/admin`): `overview`, `orders`, `order-detail`, `books`, `quick-add` (mobile book entry), `catalog`, `academic`, `inventory`, `requests`. Login at `/admin/login` (`admin/src/pages/login.tsx`); token helpers + axios interceptors in `admin/src/lib/auth.ts`. Admin shared components live in `admin/src/components/admin/`, API in `admin/src/lib/admin-api.ts`.

Frontend env (Vite): `VITE_STORE_SLUG` (default `elbayan`), `VITE_WHATSAPP_NUMBER` (storefront), `VITE_PUBLIC_SITE_URL` (admin's "view store" link). Store identity script: `scripts/setup-store.ts`.

## Frontend shared

- `frontend/src/components/` — `book-card`, `layout`, `logo`, `search-box`, `request-dialog`, `order-modal`, `ui/`
- `frontend/src/components/admin/` — `admin-layout`, `charts`, `primitives`, `toaster`
- `frontend/src/lib/` — `queries.ts` (TanStack), `types.ts`, `admin-api.ts`, `admin-types.ts`

## Branches & repo

- Remote: `https://github.com/kouteiba97/BookStore.git`
- `master` (default) and `develop` — develop is where new work lands first, then merged into master.

## Key references

- Book data model (Quick Add fields): [docs/book-data-model.md](docs/book-data-model.md)
- Audit & R2/upgrade plan: [docs/app-audit-and-upgrade-plan.md](docs/app-audit-and-upgrade-plan.md)
- Admin operator guide: [docs/admin-dashboard.md](docs/admin-dashboard.md)
- Admin deep-dive / recipes: [.claude/skills/admin-dashboard/SKILL.md](.claude/skills/admin-dashboard/SKILL.md)

## Local dev

```bash
npm install
npx prisma migrate deploy
npm run prisma:generate
npm run start:dev          # backend (:3000)
# in another terminal — public storefront (:5173)
cd frontend && npm install && npm run dev
# in another terminal — admin dashboard (:5175/admin/)
cd admin && npm install && npm run dev
```

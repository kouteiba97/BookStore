# BookStore — مكتبة البيان

Islamic / academic bookstore platform. NestJS backend + React (Vite) frontend, PostgreSQL via Prisma. Arabic-first UI (RTL).

## Stack

- **Backend**: NestJS, Prisma, PostgreSQL — entry `src/main.ts`, root module `src/app.module.ts`. Served at `http://localhost:3000`, API prefix `/api/v1`.
- **Frontend**: React + Vite + TypeScript + Tailwind (Base UI / shadcn-style primitives), TanStack Query. Entry `frontend/src/main.tsx`. Dev server `http://localhost:5173`.
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

> Admin routes are **NOT authenticated** in code — gate `/admin/*` and `/api/v1/admin/*` behind a reverse proxy in production.

## Frontend pages (`frontend/src/pages/`)

Public: `home.tsx`, `search.tsx`, `book.tsx`, `academic/{fields,years,subjects,subject-books}.tsx`

Admin (`frontend/src/pages/admin/`, mounted at `/admin`): `overview`, `orders`, `order-detail`, `books`, `catalog`, `academic`, `inventory`, `requests`

## Frontend shared

- `frontend/src/components/` — `book-card`, `layout`, `logo`, `search-box`, `request-dialog`, `order-modal`, `ui/`
- `frontend/src/components/admin/` — `admin-layout`, `charts`, `primitives`, `toaster`
- `frontend/src/lib/` — `queries.ts` (TanStack), `types.ts`, `admin-api.ts`, `admin-types.ts`

## Branches & repo

- Remote: `https://github.com/kouteiba97/BookStore.git`
- `master` (default) and `develop` — develop is where new work lands first, then merged into master.

## Key references

- Admin operator guide: [docs/admin-dashboard.md](docs/admin-dashboard.md)
- Admin deep-dive / recipes: [.claude/skills/admin-dashboard/SKILL.md](.claude/skills/admin-dashboard/SKILL.md)

## Local dev

```bash
npm install
npx prisma migrate deploy
npm run prisma:generate
npm run start:dev          # backend
# in another terminal
cd frontend && npm install && npm run dev
```

# BookStore — مكتبة البيان

Islamic / academic bookstore platform. NestJS backend + React (Vite) frontend, PostgreSQL via Prisma. Arabic-first UI (RTL).

## Stack

- **Backend**: NestJS, Prisma, PostgreSQL — entry `src/main.ts`, root module `src/app.module.ts`. Served at `http://localhost:3000`, API prefix `/api/v1`.
- **Frontend (two separate apps, same backend/DB):**
  - `frontend/` — **public storefront**. Entry `frontend/src/main.tsx`. Dev `http://localhost:5173`.
  - `admin/` — **admin dashboard**, its own Vite app/build, served under base `/admin/`. Dev `http://localhost:5175/admin/`. Deploy independently (subdomain or `/admin` path). Shares a few files with the public app by duplication (`lib/queries.ts`, `lib/types.ts`, `lib/api.ts`, `components/logo.tsx`).
  - Both are React + Vite + TS + Tailwind (Base UI / shadcn-style primitives) + TanStack Query, and both proxy `/api` → backend.
- **DB**: Prisma schema at `prisma/schema.prisma`, migrations under `prisma/migrations/`.
- **Mobile (Flutter, separate repo)**: two apps mirroring the two web apps — `store_app` (customer storefront) and `admin_app` (back office: JWT login, orders/requests workflows, Quick-Add with camera→R2 cover upload). Same palette/fonts/logo, Arabic RTL, same API (they consume this backend over HTTP). Lives at `D:\PROJECTS\BookStoreMobile` / github.com/kouteiba97/BookStoreMobile. UI changes here must be ported there manually.

## Backend modules (`src/modules/`)

Public storefront:
- `books/` — book catalog reads; also `GET :storeSlug/home-sections` (+ `/:id`): the home page layout the admin arranges (`home-sections.service.ts`)
- `academic/` — fields → years → subjects → books taxonomy
- `requests/` — customer book-request leads (with WhatsApp redirect); admin can delete one (`DELETE :storeSlug/requests/:id`, spam/tests — an order made from it is kept)
- `import/` — legacy curl-only CSV/XLSX bulk import (the admin wizard is `admin/data-import/`) (≤5000 rows/file; dedupe in memory on title+primary author, bulk name resolution, chunked transactional writes; one import per store at a time; `?images=false` skips the slow online cover lookup)
- `images/` — book cover image serving
- `image-sync/` — match phone photos to books via filename + OCR
- `clean/` — data cleanup for one store (merges author/publisher spelling variants — shared tables; removes a book only if fully identical and never ordered; clears a cover only on a definite 404/410)

Admin back office (`src/modules/admin/`, mounted at `/api/v1/admin/*`):
- `admin.module.ts` + `store-resolver.service.ts` — wiring
- `stats/` — analytics overview
- `orders/` — the one sales register: website/phone orders, counter sales (`POST orders/counter`) and imported sales, told apart by `Order.channel` (`online|shop|import`), with `paymentMethod`, `discount`, `soldAt`. Status workflow in `order-rules.ts` (delivered → cancelled = a return). Stock moves on confirm/cancel (`stockApplied` flag); each line freezes `unitCost`. `POST orders/:id/invoice` numbers it once per year (`YYYY-NNNN`, `StoreCounter`).
- `books/` — admin CRUD + `dto/upsert-book.dto.ts`
- `catalog/` — catalog management + `dto/upsert-catalog.dto.ts`
- `academic/` — taxonomy admin
- `inventory/` — stock management
- `uploads/` — cover-photo upload → Cloudflare R2 (multipart; type decided by magic bytes). Every cover is normalised with `sharp` (`common/utils/cover-image.ts`): EXIF-rotated, metadata/GPS stripped, ≤2000 px JPEG, plus a 480 px `<name>.thumb.jpg`. The API exposes `thumbUrl` (and `thumbs[]` for galleries); clients show the thumbnail and fall back to the full picture. `scripts/backfill-thumbnails.ts` creates missing thumbnails (additive, idempotent).
- `data-import/` — Excel/CSV import wizard + Excel exports (`/admin/data`). `analyze` (upload, kept 30 min in memory) → `preview` → `commit`; plus `report` (row-by-row Excel), `history`, `jobs/:id/undo` (deletes books the import created, never ordered ones), `template`, `GET /admin/data-quality`, `GET /admin/export/{books,orders}`. Column recognition in `fields.ts` (Arabic/French/English synonyms), value parsing in `values.ts` (prices like «1 500 دج», Arabic digits, Hijri years), layout detection in `detect.ts`, SheetJS I/O in `workbook.ts`. Import **kinds** (`kinds.ts`): `catalog`, or history `sales` / `purchases` / `expenses` (`history-import.ts`: lines grouped by reference, else date+customer / supplier+date; unknown books created via `common/stock/book-lookup.ts`; stock untouched unless `applyStock`/`addToStock`; undo deletes what the job wrote and restores stock). `analyze` returns `kinds` and per sheet `suggestedKind` + `byKind`. Imported books/orders/purchases/expenses carry `importJobId`. `Book.costPrice` (purchase price) is admin-only — public routes use `serializePublicBook(s)`, which strips it. Product roadmap and packs: [docs/product-plan.md](docs/product-plan.md).
- `money/` — suppliers, purchases (stock in, `costPrice` updated, payments/balance, cancel reverses stock), expenses; `StoreSettingsController`: `GET/PUT store-profile` (invoice identity: RC/NIF/NIS/ART/footer) and `GET stock-movements/:bookId`.
- `reports/` — `GET reports/overview` / `reports/export` (xlsx): revenue, COGS (from frozen `unitCost`), margin, expenses, net profit, monthly, channels, top books, slow stock (90 d), stock value. Raw SQL; sold = confirmed/shipped/delivered dated `COALESCE(soldAt, createdAt)`.
- `home-sections/` — storefront home layout (`HomeSection` + `HomeSectionBook`, kinds in `common/home/home-layout.ts`): built-in blocks (`categories|academic|latest|popular|request`, one each, hide/rename/reorder only) and hand-picked shelves (`books`, e.g. «جديد معرض الكتاب SILA»). A store with no rows gets the default layout; the admin GET writes it. Mobile `store_app` does not render shelves yet (port needed).
- `social-content/` — content browser + ZIP export for social media (`GET /admin/social-content/books`, `POST /admin/social-content/export` with `bookIds` or `filter`). Streams a folder per book (cover, optional gallery, `metadata.json`, `metadata.txt`) + `index.csv`. Pictures are fetched server-side through `common/utils/image-source.ts` (https only, private IPs blocked, 15 MB cap); ZIP via the dependency-free `common/utils/zip-writer.ts`. Limits: 200 books/export, 500 MB/archive, 2 exports at once, 10/min. Captions plug into `social-post.ts`.

Shared infra:
- `src/common/stock/stock.ts` — `moveStock(tx, storeId, lines, reason, refId?)`: the only way stock changes from money flows (atomic SQL, clamps at 0, flips available↔on_request, logs `StockMovement`). Hand edits in `inventory/` log `adjustment`.
- `src/common/plan/` — packs. `plans.ts` (`starter|pro|business`: features `money, invoices, reports, socialExport, historyImport, academic` + limits books / imports per month), `@RequiresFeature(f)` (put it ABOVE `@UseGuards(AdminAuthGuard)`; 402 + Arabic message), `PlanService` (`assertCanAddBooks`, `assertCanImport`), `GET /admin/plan`. `Store.plan` cached 60 s in `StoreResolver.getPlan()`; change with `scripts/set-plan.ts`.
- `src/modules/storage/` — `StorageService` wraps Cloudflare R2 (S3 SDK). Global module; `enabled` is false unless all `R2_*` env vars are set, then falls back to local disk. Env loaded via `@nestjs/config`.

Auth & hardening:
- `auth/` (`src/modules/admin/auth/`) — `POST /api/v1/admin/auth/login` exchanges the shared `ADMIN_PASSWORD` (env) for a 30-day JWT (`JWT_SECRET`). `AdminAuthGuard` (`src/common/guards/`) protects ALL admin controllers plus the operational endpoints (`import`, `images/fill`, `image-sync`, `clean`, and requests list/status/delete). Public: catalog reads, academic reads, request **create**.
- Global rate limit 300 req/min/IP (`@nestjs/throttler`); login 10/min; public request create 5/min; social export 10/min. `trust proxy` is set (one hop, `TRUST_PROXY_HOPS`) so limits are per visitor behind Render's proxy, not shared.
- Tenancy: admin tokens belong to the deployment's store (`common/tenant/StoreResolver`: `STORE_SLUG` or first store). `AdminAuthGuard` refuses any `/:storeSlug/` route for another store (403); every admin query filters by `storeId` (orders can only contain this store's books). Authors/publishers/categories/countries/academic tree are shared reference tables.
- Shared helpers: `common/validation/query.ts` (enum + paging validation → 400, never 500), `common/utils/book-cover.ts` (`setBookCover` keeps `Book.imageUrl` and gallery picture 0 in step — use it for any server-side cover change). `helmet` + env-driven CORS (`CORS_ORIGINS`) in `main.ts`. Health probe at `GET /api/v1/health`.
- ⚠️ `AdminModule` must stay **before** the public modules in `app.module.ts` imports — its literal routes (`v1/admin/books`) must register before the `v1/:storeSlug/...` wildcards or admin GETs 404.

## Frontend pages (`frontend/src/pages/`)

Public: `home.tsx` (blocks in the order of `GET /home-sections`; the search hero stays fixed), `collection.tsx` (`/collections/:id`, a shelf’s «عرض الكل»), `search.tsx`, `book.tsx`, `academic/{fields,years,subjects,subject-books}.tsx`

Admin (separate app — `admin/src/pages/admin/`, served at `/admin`): `overview`, `orders`, `order-detail`, `books` (`?missing=price|cover|author|category|stock|outOfStock`), `quick-add` (mobile book entry), `catalog`, `academic`, `inventory`, `requests`, `social-content`, `data` (import wizard / history / exports / data quality), `sales` (counter POS + register), `purchases` (+ suppliers), `expenses`, `reports`, `settings` (store identity + pack), `storefront` (home page sections and shelves), and `invoice` (`/admin/invoice/:id`, printable, outside the shell). Pack gating in `components/admin/plan-gate.tsx` (`usePlan`, `useFeature`, `<FeatureGate>`; locked nav items show a lock). Money/reports API in `admin/src/lib/money-api.ts`. Login at `/admin/login` (`admin/src/pages/login.tsx`); token helpers + axios interceptors in `admin/src/lib/auth.ts`. Admin shared components live in `admin/src/components/admin/`, API in `admin/src/lib/admin-api.ts`.

**Editions** — one codebase, two products. `basic` (default) is the build for مكتبة البيان; `full` is the complete platform sold to other stores. Hidden features stay in code and DB, only the UI is gated:
- Storefront: `VITE_EDITION` (`basic` | `full`), read in `frontend/src/lib/features.ts`. Basic hides the academic browse (nav link, home section, `/academic/*` routes → redirect home, sitemap entry). Set in `render.yaml`.
- Web admin: same `VITE_EDITION`, read in `admin/src/lib/features.ts`. Basic hides the academic taxonomy screen (nav item; `/admin/academic` → redirect to `/admin`).
- Mobile: `--dart-define=EDITION=full` (each app's `lib/edition.dart`). Basic hides the store app's academic tab and the admin app's academic screen, and reduces admin Quick-Add (new book only) to cover scanner + title + category + "save & scan next".
- To demo/sell the full platform, deploy a second storefront/admin with `VITE_EDITION=full` and build APKs with `--dart-define=EDITION=full`.

API env (optional): `STOREFRONT_URL` (adds a link to each book in social exports), `TRUST_PROXY_HOPS` (default 1). `JWT_SECRET` is mandatory when `NODE_ENV=production` (the API refuses to boot without it).

Frontend env (Vite): `VITE_EDITION` (default `basic`), `VITE_STORE_SLUG` (default `elbayan`), `VITE_WHATSAPP_NUMBER` (storefront), `VITE_PUBLIC_SITE_URL` (admin's "view store" link). Store identity script: `scripts/setup-store.ts`.

## Frontend shared

- `frontend/src/components/` — `book-card`, `layout`, `logo`, `search-box`, `request-dialog`, `order-modal`, `ui/`
- `frontend/src/components/admin/` — `admin-layout`, `charts`, `primitives`, `toaster`
- `frontend/src/lib/` — `queries.ts` (TanStack), `types.ts`, `admin-api.ts`, `admin-types.ts`
- Prisma runs with the `relationJoins` preview feature: an `include` is ONE SQL query instead of one per relation (production DB round trip ≈ 50 ms). Public routes resolve the store through `StoreResolver.bySlug` (60 s cache).
- Storefront: the order/request dialogs load on first tap (`components/lazy-dialogs.tsx` — import dialogs from there, not directly). Admin: pages are `React.lazy` in `App.tsx`.
- Public list endpoints (`/books`, search, recommendations, academic lists) return the slim **card** shape (`bookCardInclude`); only `GET /books/:id` returns the full shape. Home fetches `/books?limit=16`; `/books` without `limit` still returns the whole catalogue for the mobile store app.

Perf/test tooling: `scripts/perf/` — `seed-perf-store.ts` (throwaway N-book store, `--drop`), `bench.mjs` (endpoint timings), `make-import.mjs` (CSV fixtures), `explain.ts` (search query plan). Local only; never against production.

## Branches & repo

- Remote: `https://github.com/kouteiba97/BookStore.git`
- `master` (default) and `develop` — develop is where new work lands first, then merged into master.

## Key references

- Book data model (Quick Add fields): [docs/book-data-model.md](docs/book-data-model.md)
- Product plan (phases, packs): [docs/product-plan.md](docs/product-plan.md)
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

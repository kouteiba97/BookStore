---
name: admin-dashboard
description: Conventions and recipes for extending the BookStore admin dashboard. Use when the task touches /admin/* routes, the src/modules/admin/ NestJS module, the Order/Request/Inventory data flow, or any admin UI under frontend/src/pages/admin/ or frontend/src/components/admin/.
---

# Admin dashboard — conventions and recipes

This is a single-store Arabic (RTL) bookstore platform. The admin dashboard lives at `/admin/*` (frontend) and `/api/v1/admin/*` (backend, NestJS module at `src/modules/admin/`).

Read this file in full before adding admin features.

## Architecture invariants — do not violate

1. **Single-store assumption.** No multi-tenancy, no users, no auth.
   - Resolve the store via `StoreResolver.getStoreId()` in services, not via URL params.
   - Admin endpoints do not take `storeSlug` in their path, unlike public endpoints (`/v1/:storeSlug/books`).
2. **`/admin/*` and `/api/v1/admin/*` are unauthenticated.** Assume reverse-proxy basic-auth in front. Do not invent app-level auth without a schema migration first.
3. **Order totals are denormalized.** `subtotal`, `shippingCost`, `total` are persisted on the row. The service recomputes them on every create/update — never trust totals from the client.
4. **Order items snapshot `bookTitle` and `unitPrice`** so historical orders survive book renames/deletions. Don't replace `bookTitle` with a join.
5. **Order status state machine** lives in `OrdersService.TRANSITIONS`. Edits to it must keep the terminal states (`delivered`, `cancelled`) closed.
6. **Cancelled orders are excluded from revenue.** Aggregations filter `status: { in: ['confirmed','shipped','delivered'] }`. Keep this rule consistent in any new analytics.
7. **Books referenced by `OrderItem` cannot be deleted.** This is enforced in `AdminBooksService.remove`.
8. **Catalog rows referenced by books cannot be deleted.** Enforced in `CatalogService.remove`.
9. **Decimals serialize as strings** (Prisma → JSON). Frontend types use `string` for money fields; wrap with `Number()` before arithmetic.

## File layout — where things go

### Backend (`src/modules/admin/`)

```
admin.module.ts             ← register every new controller/service here
store-resolver.service.ts   ← cached single-store lookup
stats/                      ← KPI/overview aggregations
books/                      ← Books CRUD (admin-books.{controller,service}.ts + dto/)
catalog/                    ← unified CRUD for categories/authors/publishers/countries
academic/                   ← Field/Year/Subject CRUD
orders/                     ← Order CRUD, status flow, request→order conversion
inventory/                  ← stock/status quick-edit
```

Controllers use `@Controller('v1/admin/<resource>')`. Validation via `class-validator` DTOs in a `dto/` subfolder. Always inject `StoreResolver` when the operation is store-scoped.

### Frontend (`frontend/src/`)

```
components/admin/
  admin-layout.tsx          ← shell: sidebar, breadcrumbs, page header, ToastProvider
  primitives.tsx            ← Surface, Button, Modal, ConfirmDialog, Field, StatusBadge,
                              Skeleton, TableSkeleton, EmptyState, Pagination, inputClass...
  charts.tsx                ← AreaChart, Sparkline (hand-rolled SVG, no Recharts dep)
  toaster.tsx               ← <ToastProvider> + useToast()
pages/admin/
  overview.tsx
  orders.tsx, order-detail.tsx
  requests.tsx              ← lead list + convert-to-order modal
  books.tsx
  catalog.tsx               ← single component, tabbed for 4 resources
  academic.tsx
  inventory.tsx
lib/
  admin-api.ts              ← axios baseURL '/api/v1/admin' + every admin endpoint
  admin-types.ts            ← AdminOrder, OrderStatus, AdminBook, CatalogItem, StatsOverview...
```

Routes are wired in `frontend/src/App.tsx` under `<Route path="admin" element={<AdminLayout />}>`.

## Design system — reuse, don't recreate

Theme in `frontend/src/index.css` (warm library palette, oklch). Use these tokens:

- Backgrounds: `bg-card`, `bg-muted/30`, `bg-background/95`
- Borders: `border-border/60`, `border-border/40` (lighter dividers)
- Text: `text-foreground`, `text-muted-foreground`
- Brand: `bg-primary text-primary-foreground` (dark green)
- Accent: `text-gold`, `bg-primary/10 text-primary` (subtle highlights)
- Shadows: `shadow-warm`, `shadow-warm-lg` (custom utilities — don't use raw Tailwind shadows)
- Status colors: pass through `<StatusBadge status={...} label={...} />` — don't hand-roll badges

For animations, use Tailwind classes from `tw-animate-css` (already a dep): `animate-in fade-in`, `slide-in-from-bottom-2`, `zoom-in-95`. **Do not add framer-motion** unless explicitly asked.

## Recipes

### Recipe 1 — Add a new "simple" CRUD resource

Use this when the resource is just `{id, name, description?}` like the catalog ones.

1. **Schema** — add the Prisma model + relation to `Book` (or whatever it relates to). Generate a migration.
2. **Backend** — extend `CatalogService` if it's a flat list with `name` (preferred — adds it to the existing endpoint). Otherwise create `src/modules/admin/<resource>/` with controller + service + DTO. Register in `admin.module.ts`.
3. **Frontend** — if it fits the catalog pattern, just add to the `META`/`TABS` arrays in `pages/admin/catalog.tsx`. Otherwise model it after `CatalogPage` (uses `Surface`, list with hover-revealed actions, modal form, `ConfirmDialog` for delete).
4. **API helper** — add to `frontend/src/lib/admin-api.ts`.

### Recipe 2 — Add a new admin page

1. Create `frontend/src/pages/admin/<page>.tsx`. Wrap content in a top-level `<div className="space-y-5">` — `AdminLayout` already provides padding and the page title.
2. Add route in `App.tsx` under the `<Route path="admin" element={<AdminLayout />}>` block.
3. Add nav entry in `admin-layout.tsx` `NAV` array (icon + Arabic label) and update `PAGE_TITLES` + `buildCrumbs` if the title isn't trivially derivable.
4. Use `useToast()` for feedback, `<TableSkeleton>` for loading, `<EmptyState>` for no-data.
5. Use React Query — keys are kebab-case strings. Existing keys: `admin-stats`, `admin-orders`, `admin-order`, `admin-books`, `admin-inventory`, `admin-requests`, `catalog/<resource>`, `academic-tree`. After mutations, invalidate the relevant ones.

### Recipe 3 — Add an order action (e.g. partial refund, mark-as-paid)

1. **Backend** — add a method to `OrdersService` and an endpoint to `OrdersController`. If it transitions the order, update `TRANSITIONS` rather than bypassing it. If it changes totals, recompute via `computeTotals` and persist all three columns.
2. **Frontend** — add the button to `pages/admin/order-detail.tsx`. Wire via `useMutation`; `onSuccess` invalidate `["admin-order", id]` and `["admin-orders"]` and `["admin-stats"]`.
3. **State machine display** — if you add a new status, update both `STATUS_FLOW` (the visual pipeline) and `STATUS_LABEL` and the badge color map in `primitives.tsx`.

### Recipe 4 — Add a chart to the overview

1. **Backend** — extend `StatsService.overview` to compute the new aggregation. Reuse `bucketByDay()` if the data is time-series.
2. **Frontend** — add to `StatsOverview` type in `admin-types.ts`. Render in `pages/admin/overview.tsx` using `<AreaChart>` (or `<Sparkline>` for compact). For a non-time-series, write a small SVG or a horizontal-bar list — keep it dependency-free.

### Recipe 5 — Migration workflow

```bash
npx prisma migrate dev --name <change>     # local dev, with DB
npm run prisma:generate                    # regenerate client
```

For production: `npx prisma migrate deploy`. Existing migrations live under `prisma/migrations/`. Match their style: one folder per migration, `migration.sql` inside.

## Pitfalls (real things that bit during the initial build)

- **Don't run `npx prisma`** — it pulls Prisma 7 by default and rejects the v5 schema syntax. Use `npm run prisma:generate` (the project script) which uses the locally pinned 5.22.
- **`JSX.Element` is unavailable** under React 19's default types. Use `import { type ReactElement } from "react"` for icon prop types.
- **The `Request` model represents a lead, not an order.** When wording UI, "طلب عميل" = request/lead, "طلب" or "طلب الشراء" = order. Don't conflate them.
- **`request.bookId` is nullable.** The convert-to-order flow shows a warning and disables submit when null.
- **`Book.price` is nullable.** Pickers show "بدون سعر" when null; order creation requires the operator to set a unit price.
- **Don't add framer-motion or Recharts** without a strong reason — animations are CSS via `tw-animate-css`, charts are hand-rolled SVG.

## Quick reference — running the stack

```bash
# Backend (from repo root)
npm install
npx prisma migrate deploy   # or: prisma migrate dev for local
npm run prisma:generate
npm run start:dev           # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173

# Admin lands at:
http://localhost:5173/admin
```

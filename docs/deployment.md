# Deployment guide — مكتبة البيان

How to take BookStore to production. There are **three deployables** sharing one backend/DB:

| Piece | Source | Type | Notes |
|---|---|---|---|
| API | repo root (NestJS) | Node service / Docker | needs Postgres + R2 + secrets |
| Storefront | `frontend/` | static SPA | public site |
| Admin | `admin/` | static SPA | served under base `/admin/`, separate origin |

```
Browser ─► Storefront (static)  ─┐
Browser ─► Admin (static, /admin)─┤─► /api/v1/* ─► NestJS API ─► Managed Postgres (Neon/Supabase)
                                  └─► covers     ─► Cloudflare R2 (public URL/CDN)
```

The application **code is production-ready** (auth, rate limiting, helmet/CORS, health probe, R2 storage, exception filter, CI, tests). What remains is **provisioning + configuration** — the steps below.

---

## 0. Prerequisites
- A managed Postgres (this guide uses **Neon**; Supabase/RDS work the same way).
- A **Cloudflare R2** bucket for book covers.
- A host for the API that runs a container or Node 22 (**Render / Fly.io / Railway / a VPS**).
- A static host for the two frontends (**Vercel / Cloudflare Pages / Netlify**).

---

## 1. Database — managed Postgres (Neon)
1. Create a Neon project; create a `production` branch (and optionally a `staging` branch for testing migrations).
2. Copy two connection strings:
   - **Pooled** → `DATABASE_URL` (used by the app at runtime).
   - **Direct** → `DIRECT_URL` (used by `prisma migrate`).
3. To make Prisma use the direct URL for migrations, add one line to the datasource in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")   // ← add this
   }
   ```
   (If your host doesn't separate pooled/direct, skip this and leave `DIRECT_URL` unset.)
4. Apply the schema and seed the store row:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed        # creates the store; set STORE_SLUG to match
   ```
   > The API's Docker image already runs `prisma migrate deploy` on boot, so steps 4's migrate happens automatically once `DATABASE_URL`/`DIRECT_URL` are set. Seeding is a one-time manual step.

## 2. Object storage — Cloudflare R2 (book covers)
1. R2 → **Create bucket** (e.g. `bookstore-covers`).
2. **Manage R2 API Tokens** → create an **Object Read & Write** token scoped to the bucket → note the Access Key ID + Secret.
3. Expose the bucket publicly: enable its `r2.dev` URL **or** attach a custom domain (e.g. `covers.albayan.example`).
4. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
   - With all five set, `StorageService.enabled` flips on and covers upload to R2; otherwise it falls back to local disk (dev only).

## 3. Secrets & config
Generate strong values — never reuse the examples:
```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -base64 24 # ADMIN_PASSWORD (or pick your own strong passphrase)
```

Full env var reference (see `.env.example`):

| Var | Where | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | API | ✅ | Postgres (pooled) |
| `DIRECT_URL` | API | ⚠️ Neon | direct conn for migrations |
| `PORT` | API | – | defaults 3000 |
| `STORE_SLUG` | API | ✅ | which store the single-store helpers resolve |
| `WHATSAPP_NUMBER` | API | ✅ | order/request WhatsApp redirect (intl, no `+`) |
| `ADMIN_PASSWORD` | API | ✅ | shared admin login (login disabled if unset) |
| `JWT_SECRET` | API | ✅ | signs 30-day admin JWTs |
| `CORS_ORIGINS` | API | ✅* | comma-separated storefront + admin origins |
| `R2_ACCOUNT_ID` … `R2_PUBLIC_BASE_URL` | API | ✅ | cover storage (see §2) |
| `VITE_API_URL` | both builds | ✅* | absolute API origin (e.g. `https://bookstore-api.onrender.com`); empty = relative/proxy |
| `VITE_STORE_SLUG` | storefront build | ✅ | store slug |
| `VITE_WHATSAPP_NUMBER` | storefront build | ✅ | WhatsApp number |
| `VITE_PUBLIC_SITE_URL` | admin build | ✅ | admin's "view store" link |
| `VITE_BASE_PATH` | admin build | ⚠️ Render | set `/` when admin is on its own domain root; defaults to `/admin/` |

\* `VITE_API_URL` is required whenever the frontends are served from a different origin than the API (the normal prod case, including Render's separate `*.onrender.com` subdomains).

\* `CORS_ORIGINS` is required once the frontends are on different origins than the API (the normal prod case). If unset, CORS is same-origin only.

## 4. Deploy on Render (Blueprint)
A `render.yaml` Blueprint at the repo root provisions **all three services** at once
(API + storefront + admin). In the Render dashboard: **New → Blueprint → pick this repo**.
- Enter the `sync: false` secrets once in the dashboard (the §1–§3 values). `JWT_SECRET` is auto-generated.
- The API is a Docker service; health check path **`/api/v1/health`**. It runs `prisma migrate deploy` then `node dist/main` on start.
- After the first deploy, seed the store row once: `render shell bookstore-api` → `npm run prisma:seed`.
- Set each frontend's `VITE_API_URL` to the API service URL, and add both frontend URLs to the API's `CORS_ORIGINS`.

> Other hosts (Fly/Railway/VPS): point at the same `Dockerfile`, set the §1–§3 env vars, expose port 3000, and use the same health check. `docker-compose.yml` runs the full stack (api + Postgres) locally.

**Local/staging full stack:**
```bash
cp .env.example .env   # fill in values
docker compose up --build
# API on http://localhost:3000, Postgres on :5432
```

## 5. Deploy the storefront (`frontend/`)
```bash
cd frontend && npm ci && npm run build   # outputs dist/
```
- Host `dist/` on Render (Blueprint above), Vercel, Cloudflare Pages, or Netlify.
- Build-time env: `VITE_API_URL` (absolute API origin), `VITE_STORE_SLUG`, `VITE_WHATSAPP_NUMBER`.
- Add the storefront origin to the API's `CORS_ORIGINS`.

## 6. Deploy the admin (`admin/`)
```bash
cd admin && npm ci && npm run build       # base path is /admin/
```
- Serve under `/admin/` (same-domain subpath, default base) **or** a dedicated subdomain. On a dedicated host that serves the build at its domain root (e.g. a Render static site), set `VITE_BASE_PATH=/` so asset URLs resolve.
- Build-time env: `VITE_API_URL`, `VITE_PUBLIC_SITE_URL` (link back to the storefront), and `VITE_BASE_PATH` as above.
- Add the admin origin to the API's `CORS_ORIGINS`.

## 7. Post-deploy smoke test
1. `GET /api/v1/health` → `{ "status": "ok", "db": "up" }`.
2. Open the storefront → catalog + academic pages load.
3. Submit a book request → lead is created, WhatsApp redirect works.
4. `/admin/login` → log in with `ADMIN_PASSWORD`; orders/books load.
5. Upload a cover in admin → URL points at `R2_PUBLIC_BASE_URL` and the image renders.

---

## CI
`.github/workflows/ci.yml` runs on every push/PR to `master`/`develop`: backend (`prisma generate` → `npm test` → build) and both frontends (build). Keep it green before deploying.

## Still optional (post-launch hardening)
- **Error tracking (Sentry):** the global exception filter already logs server faults with stack traces — wire `@sentry/node` to its `logger.error` call to ship them off-box.
- **Audit log** of admin mutations, **Arabic search** upgrade (`pg_trgm`), **low-stock alerts**, **image optimization** — see `docs/app-audit-and-upgrade-plan.md` §6 P2/P3.

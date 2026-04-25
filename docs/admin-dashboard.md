# Admin Dashboard — usage guide

The admin dashboard is a full-featured back office for the bookstore: orders (multi-item), customer requests (leads), books, catalog, inventory, academic taxonomy, and an analytics overview. It's mounted at **`/admin`** on the frontend and **`/api/v1/admin/*`** on the backend.

This document is for the operator and the dev who'll keep it running. For deeper architecture notes (and recipes when adding features), see [`.claude/skills/admin-dashboard/SKILL.md`](../.claude/skills/admin-dashboard/SKILL.md).

---

## 1. Running locally

You need: Node 18+, PostgreSQL, and a `.env` with `DATABASE_URL` (see `.env.example`).

```bash
# from the repo root
npm install
npx prisma migrate deploy        # apply all migrations including the orders/price one
npm run prisma:generate
npm run start:dev                # backend → http://localhost:3000

# in another terminal
cd frontend
npm install
npm run dev                      # frontend → http://localhost:5173
```

Open **http://localhost:5173/admin** to land on the overview page.

> ⚠ The admin routes are **not authenticated**. In production, gate `/admin/*` and `/api/v1/admin/*` behind reverse-proxy basic-auth (nginx, Caddy, Traefik) or a VPN. See section 7.

---

## 2. The pages

| Route | What it does |
|---|---|
| `/admin` | KPIs, daily charts, status breakdowns, top-selling books, recent activity. Range toggle: 7 / 30 / 90 days. |
| `/admin/orders` | Searchable list of orders. Filters by status. Click a row → detail. |
| `/admin/orders/:id` | Status pipeline, edit modal (multi-item), cancel button, WhatsApp shortcut. |
| `/admin/requests` | Customer leads from the public site. Status = `جديد / تم التواصل / تم البيع`. **Convert to order** button. |
| `/admin/books` | CRUD for books. Inline inventory toggle (status + stock) inside the form. |
| `/admin/catalog/:resource` | Tabs for Categories / Authors / Publishers / Countries. Add/edit/delete. Refuses delete if any book references the row. |
| `/admin/academic` | Field → Year → Subject tree. Inline create/edit/delete at every level. |
| `/admin/inventory` | Quick-edit table. Filter by status or "low stock only" (≤3 or rare). Save per-row when dirty. |

The sidebar collapses (state remembered between sessions). Mobile gets a slide-in drawer.

---

## 3. Order status flow

The state machine is enforced **on the backend**. The UI only offers transitions the backend allows.

```
pending ──▶ confirmed ──▶ shipped ──▶ delivered
   │            │            │
   └────────────┴────────────┴──▶ cancelled
```

`delivered` and `cancelled` are terminal. You **cannot edit a delivered or cancelled order**, and you can only **delete an order that's been cancelled first** (preserves revenue history).

**Revenue counts orders with status confirmed / shipped / delivered.** Cancelled and pending orders are excluded.

---

## 4. Multi-item orders

An order has 1+ books. In the order edit modal:

1. Click **"إضافة كتاب"** to open the book picker.
2. Type 2+ characters to search.
3. Pick → it's added with the book's current `price` and quantity 1.
4. Adjust unit price and quantity per row.
5. The total auto-recomputes (subtotal + shipping = total).

When you save, **all items are replaced** — the backend deletes existing items and recreates them in a transaction. This is intentional: simple, correct, no edit-history confusion.

---

## 5. Lead → Order conversion

A "request" (طلب عميل) is a lead from the public site. To turn it into a real order:

1. Open `/admin/requests`.
2. Find the lead → click **"تحويل لطلب"**.
3. The conversion modal pre-fills the customer info and the linked book's price.
4. Adjust quantity, shipping, notes → **"إنشاء الطلب"**.

Result: a new order is created in `confirmed` status, and the lead is marked `done` and linked to the order via `Request.convertedOrderId`.

> If the original request wasn't linked to a book in your catalog (`bookId` is null), the modal warns and disables submit. Either link the book first or create the order manually from `/admin/orders` (future enhancement: this manual flow isn't a UI yet — use a Postman call to `POST /api/v1/admin/orders`).

---

## 6. Backend API reference

All under `/api/v1/admin`. Examples assume `localhost:3000`.

### Stats

```
GET    /admin/stats/overview?days=30
```

### Books

```
GET    /admin/books?search=&categoryId=&inventoryStatus=&page=1&pageSize=25
GET    /admin/books/:id
POST   /admin/books          { title, categoryId, price?, authorId?, ..., inventory?: {status, stock?} }
PATCH  /admin/books/:id
DELETE /admin/books/:id      ← refuses if referenced by any order item
```

### Catalog (resource ∈ categories | authors | publishers | countries)

```
GET    /admin/catalog/:resource
POST   /admin/catalog/:resource         { name, description? }
PATCH  /admin/catalog/:resource/:id
DELETE /admin/catalog/:resource/:id     ← refuses if any books reference
```

### Academic

```
GET    /admin/academic/tree
POST   /admin/academic/fields           { name }
PATCH  /admin/academic/fields/:id       { name }
DELETE /admin/academic/fields/:id
POST   /admin/academic/years            { fieldId, name }
PATCH  /admin/academic/years/:id        { name }
DELETE /admin/academic/years/:id
POST   /admin/academic/subjects         { yearId, name }
PATCH  /admin/academic/subjects/:id     { name }
DELETE /admin/academic/subjects/:id
```

### Orders

```
GET    /admin/orders?status=&search=&page=&pageSize=
GET    /admin/orders/:id
POST   /admin/orders                    { firstName, ..., items: [{bookId, quantity, unitPrice?}], shippingCost?, notes?, status? }
PATCH  /admin/orders/:id                ← same body; replaces items wholesale
PATCH  /admin/orders/:id/status         { status }
POST   /admin/orders/:id/cancel
DELETE /admin/orders/:id                ← only if status === 'cancelled'

POST   /admin/orders/from-request/:requestId
       { items: [{bookId, quantity, unitPrice}], shippingCost?, notes? }
```

### Inventory

```
GET    /admin/inventory?search=&status=&lowStock=true
PATCH  /admin/inventory/:bookId         { status, stock? }
```

---

## 7. Securing the admin (production)

Recommended: nginx basic-auth in front of both routes.

```nginx
location ~ ^/(admin|api/v1/admin) {
    auth_basic "Admin";
    auth_basic_user_file /etc/nginx/.admin-htpasswd;
    proxy_pass http://localhost:3000;
}
```

Alternative: a Cloudflare Access policy on those paths. Either way, the application itself stays auth-free, which keeps the code simple.

---

## 8. Schema additions in this dashboard

Migration `prisma/migrations/20260425000000_add_orders_and_price/`:

- `Book.price` — `Decimal(10,2)`, nullable. Existing books default to NULL.
- `Order` — full customer snapshot, `status` enum, denormalized `subtotal/shippingCost/total`, optional `notes`, `convertedRequestId` link via inverse relation.
- `OrderItem` — `bookTitle` and `unitPrice` snapshotted at order time.
- `Request.convertedOrderId` — optional unique link to the order created from this lead.
- New enum `OrderStatus` — `pending | confirmed | shipped | delivered | cancelled`.

---

## 9. Frequently asked

**Why no users?**
The platform never had user accounts. Sales close manually over WhatsApp; the `Request` model captures lead info. Adding users would require a full auth system — out of scope for this iteration.

**Why are revenue numbers in DZD?**
The store is Algerian. Money formatting uses `toLocaleString("ar-DZ")` and `د.ج` suffix.

**Can I bulk-import books?**
There's already a non-admin import module (`src/modules/import/`) that handles CSV/XLSX. The admin UI doesn't expose it yet — invoke the existing endpoints directly or add a page following the recipe in the SKILL.md.

**Why don't I see a "Users" or "Payments" section?**
Those entities don't exist in the schema. Adding either is a separate project.

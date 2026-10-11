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
| `/admin/sales` | **Counter** (POS: search a book, quantities, discount, payment → a delivered sale that takes stock at once) and **Register** (every sale: website, counter, imported; filter by channel and dates). |
| `/admin/orders/:id` | Status pipeline, edit modal (multi-item), cancel / **return** («إرجاع» on a delivered sale), invoice button, channel/payment/discount, WhatsApp shortcut. |
| `/admin/invoice/:id` | Printable numbered invoice (outside the dashboard shell). Print or save as PDF. Pack: `invoices`. |
| `/admin/purchases` | Purchases from suppliers (stock in, purchase price updated), payments and balance per supplier, cancel; **Suppliers** tab. Pack: `money`. |
| `/admin/expenses` | Rent, salaries, transport… by period and category. Pack: `money`. |
| `/admin/reports` | Revenue, cost of books sold, margin, expenses, net profit; monthly chart + table; channels; best sellers; slow stock; stock value; Excel export. Pack: `reports`. |
| `/admin/settings` | Store identity for invoices (name, phone, address, RC, NIF, NIS, ART, footer) and the pack: usage, limits, comparison table. |
| `/admin/data` | Excel import wizard (books, **or** sales / purchases / expenses history), import history with undo, Excel exports, data quality. |
| `/admin/requests` | Customer leads from the public site. Status = `جديد / تم التواصل / تم البيع`. **Convert to order** button. |
| `/admin/books` | CRUD for books. Inline inventory toggle (status + stock) inside the form. |
| `/admin/catalog/:resource` | Tabs for Categories / Authors / Publishers / Countries. Add/edit/delete. Refuses delete if any book references the row. |
| `/admin/academic` | Field → Year → Subject tree. Inline create/edit/delete at every level. |
| `/admin/inventory` | Quick-edit table. Filter by status or "low stock only" (≤3 or rare). Save per-row when dirty. «السجل» opens the book's stock log (every sale, return, purchase, hand edit). Shows the first 300 matches (search to narrow). |
| `/admin/social-content` | Pick books (per page, across pages, or "all results" of a filter) and download one ZIP for social media: a folder per book with the cover (optionally every picture of a series), `metadata.json`, a ready-to-paste `metadata.txt`, plus `index.csv`. Up to 200 books per file. |

The sidebar collapses (state remembered between sessions). Mobile gets a slide-in drawer. Pages outside the store's pack keep their place in the menu with a lock; opening one shows what it does and which pack has it.

---

## 3. Order status flow

The state machine is enforced **on the backend**. The UI only offers transitions the backend allows.

```
pending ──▶ confirmed ──▶ shipped ──▶ delivered
   │            │            │            │
   └────────────┴────────────┴────────────┴──▶ cancelled   (from delivered = a return)
```

`cancelled` is terminal. A delivered order can only become cancelled — that is a **return**. You **cannot edit a delivered or cancelled order**, and you can only **delete an order that's been cancelled first** (preserves revenue history).

**Stock:** an order takes its books out of stock when it reaches confirmed (counter sales: immediately) and puts them back when cancelled or returned. Every move is logged (`StockMovement`). Each line also keeps the book's purchase price at sale time (`unitCost`) for margins.

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
GET    /admin/orders?status=&channel=online|shop|import&from=YYYY-MM-DD&to=&search=&page=&pageSize=
GET    /admin/orders/:id
POST   /admin/orders                    { firstName, ..., items: [{bookId, quantity, unitPrice?}], shippingCost?, notes?, status? }
PATCH  /admin/orders/:id                ← same body; replaces items wholesale
PATCH  /admin/orders/:id/status         { status }
POST   /admin/orders/:id/cancel         ← on a delivered order = a return
DELETE /admin/orders/:id                ← only if status === 'cancelled'
POST   /admin/orders/counter            { items, discount?, paymentMethod?, customerName?, phone?, notes? }  → delivered shop sale
POST   /admin/orders/:id/invoice        → { store, order } and assigns the invoice number once (pack: invoices)

POST   /admin/orders/from-request/:requestId
       { items: [{bookId, quantity, unitPrice}], shippingCost?, notes? }
```

### Inventory

```
GET    /admin/inventory?search=&status=&lowStock=true&limit=   → array (≤300 by default, ≤1000), total in X-Total-Count
PATCH  /admin/inventory/:bookId         { status, stock? }
```

### Money (pack: money)

```
GET/POST        /admin/suppliers                PUT/DELETE /admin/suppliers/:id
GET             /admin/purchases?supplierId=&from=&to=&page=      GET /admin/purchases/:id
POST            /admin/purchases                { supplierId|supplierName, reference?, date?, items: [{bookId|title, quantity, unitCost, salePrice?}], shippingCost?, paidAmount?, addToStock=true, updateCostPrice=true }
PATCH           /admin/purchases/:id/payment    { paidAmount }
POST            /admin/purchases/:id/cancel     DELETE /admin/purchases/:id (cancelled or no stock applied)
GET/POST        /admin/expenses?category=&from=&to=               PUT/DELETE /admin/expenses/:id
GET/PUT         /admin/store-profile            (no pack needed)
GET             /admin/stock-movements/:bookId  (no pack needed)
```

### Reports & pack

```
GET  /admin/reports/overview?from=&to=   (pack: reports; default Jan 1 → today, ≤ 5 years)
GET  /admin/reports/export?from=&to=     → .xlsx (6 sheets)
GET  /admin/plan                         → { plan, features, limits, usage, plans }
```

A feature outside the pack answers **402** `{ message (Arabic), feature, plan }`.

### Social content

```
GET    /admin/social-content/books?search=&categoryId=&publisherId=&status=&page=&pageSize=   → { items, total, page, pageSize, maxExport }
POST   /admin/social-content/export     { bookIds: string[] } | { filter: {search?, categoryId?, publisherId?, status?} }, includeGallery?
       → application/zip (streamed); headers X-Export-Books, X-Export-Truncated
```

Only ids/filters are accepted; titles, prices and pictures are read from the database. Limits: 200 books, 500 MB, 15 MB per picture, 2 concurrent exports (429), 10 exports/min. Pictures are fetched over https only, never from private/loopback addresses.

---

## 7. Securing the admin (production)

The admin is protected by the API itself: `POST /api/v1/admin/auth/login` exchanges `ADMIN_PASSWORD` for a 30-day JWT (`JWT_SECRET`), and `AdminAuthGuard` protects every admin route. Login is limited to 10 attempts/min. An extra layer (Cloudflare Access, basic-auth) is optional.

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
Yes — **استيراد وتصدير** (`/admin/data`). The same wizard also imports sales, purchases and expenses history (Business pack).

**How do I change a store's pack?**
`npx ts-node scripts/set-plan.ts <slug> <starter|pro|business>` (takes up to 60 s to show, plan is cached).

**Why don't I see a "Users" section?**
There is one shared admin password per deployment; per-user accounts with roles are a separate project.

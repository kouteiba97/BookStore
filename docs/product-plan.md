# Product plan — moving shops from Excel to the platform

Most bookshops run on Excel: book lists, stock, purchases, sales, invoices,
orders. The platform wins them over when **moving is effortless** (bring your
sheets as they are) and **leaving is never a trap** (everything exports back to
Excel). Features are then sold in packs.

## Phases

| Phase | Status | What it gives a shop |
|---|---|---|
| **1. Smart import + export** | ✅ shipped | Upload any book/stock sheet (.xlsx, .xls, .csv, Arabic or French headers). Columns are recognised automatically; the admin checks the mapping, sees a row-by-row preview (new / update / duplicate / error / missing info), imports, gets a "what's missing" report, and can undo. Export of books + stock value, and orders + monthly income, to Excel. |
| **2. Money module** | ✅ shipped | Suppliers, purchases (stock in), in-shop sales (stock out), expenses (rent, salaries, transport…), invoices as printable PDF. One sales register: website orders + counter sales + imported sales. Each importable with the same wizard. |
| **3. Reports** | ✅ shipped | Income vs. expenses per month, gross margin (sale − purchase price), profit, best/worst sellers, slow stock, stock value. Excel and PDF. |
| **4. Packs** | ✅ shipped | Each store has a plan; features outside it are visible but locked, with an "upgrade" prompt. |

## Phase 1 — how it works

Admin → **استيراد وتصدير** (`/admin/data`):

1. **Upload** — Excel (.xlsx/.xls), CSV (UTF-8 or Arabic Windows), ODS; ≤10 MB, ≤10,000 rows per sheet.
2. **Column matching** — recognised from ~200 Arabic/French/English header names
   (العنوان, Désignation, المؤلف, Auteur, دار النشر, Éditeur, الكمية, Qté, سعر البيع, P.V,
   سعر الشراء, P.A, سنة النشر, الطبعة, عدد الأجزاء, ردمك…), or guessed from the values when a
   header is missing. Banners above the table, repeated header lines, "المجموع/Total"
   lines and row-number columns are skipped automatically.
3. **Preview** — nothing is written yet. Shows what each row will do and why, plus
   the new authors/publishers/categories it will create. Full report downloadable as Excel.
4. **Import** — chunked and transactional. Existing books (same title + author) are
   updated or left alone (admin's choice); the quantity column means current stock or a
   delivery to add.
5. **Result** — what the imported books still miss (price, cover, author, category,
   stock), each a link to those books. **Undo** in the history removes the books the
   import created (never ones already ordered).

Values understood: `1 500 DA`, `١٥٠٠ دج`, `1.500,00`, `1,500.00`, Hijri years (kept as a
note), several authors in one cell, availability words (متوفر / Disponible / غير متوفر…).

Purchase price (`costPrice`) is stored for margins and stock value; it is admin-only
and stripped from every public response.

## Phase 2 — money (how it works)

- **One sales register** (`/admin/sales`): website/phone orders, counter sales and
  imported sales are all `Order` rows with a `channel` (`online` / `shop` / `import`),
  a `paymentMethod` and an optional `discount`. The **counter** tab is a small POS:
  search a book, add quantities, discount, payment → saved as a delivered sale.
- **Stock follows the money.** One helper (`common/stock/stock.ts` → `moveStock`)
  moves stock atomically and logs every change in `StockMovement` (sale, return,
  purchase, purchase cancel, manual adjustment, import). An order takes stock when it
  is confirmed, gives it back when cancelled; a delivered sale can be **returned**
  (status → cancelled, books back on the shelf). The inventory page shows each book's
  log («السجل»).
- **Each sold line freezes its cost** (`OrderItem.unitCost` = the book's purchase price
  at sale time), so margins stay right when prices change later.
- **Purchases & suppliers** (`/admin/purchases`): a purchase (supplier, reference,
  date, lines with quantity + purchase price, shipping, amount paid) adds the copies
  to stock and updates each book's purchase price. Supplier balances = total − paid;
  payments can be recorded later. Cancelling takes the copies back out.
- **Expenses** (`/admin/expenses`): rent, salaries, transport, utilities, marketing,
  supplies, taxes, other.
- **Invoices** (`/admin/invoice/:id`): numbered per year (`2026-0001`, via
  `StoreCounter`), with the store's identity and legal ids (RC, NIF, NIS, ART) from
  `/admin/settings`. Printed from the browser or saved as PDF.
- **History import**: the same wizard reads sales, purchases and expenses sheets
  («ماذا تحتوي هذه الورقة؟»). Lines are grouped into sales/purchases by reference
  (invoice / BL number), otherwise by date + customer / supplier + date. Unknown
  books are created. By default stock is **not** touched (past movements are already
  reflected in today's count); options let the shop apply them. Undo removes
  everything the import wrote and restores stock.

## Phase 3 — reports (how it works)

`/admin/reports` (and `GET /admin/reports/overview?from&to`): revenue, cost of books
sold, gross margin (and rate), expenses, **net profit**, orders, books sold, average
sale, purchases and what is still owed to suppliers; month by month (chart + table),
by channel, expenses by category, best sellers with their margin, **slow stock** (in
stock, nothing sold for 90 days), stock value at cost and at sale price. A warning shows
when part of the sales has no known purchase price. `GET /admin/reports/export` gives
the same as a 6-sheet Excel file. Sold = confirmed / shipped / delivered, dated by
`soldAt` (imported sales keep their real date) else `createdAt`.

## Phase 4 — packs (how it works)

- `Store.plan` ∈ `starter | pro | business` (unknown → starter; existing stores were
  migrated to `business`). Defined in `src/common/plan/plans.ts`; set with
  `npx ts-node scripts/set-plan.ts <slug> <plan>` (`--list` to see stores).
- `@RequiresFeature('money' | 'invoices' | 'reports' | 'socialExport' | 'historyImport' | 'academic')`
  on a controller → **402** with an Arabic message naming the cheapest pack that has it.
  `PlanService` enforces limits (books per store, imports per month).
- `GET /admin/plan` → pack, features, limits, usage and the full comparison. The admin
  shows locked pages with a lock icon and an upgrade card (never hidden); the
  comparison table lives in **المتجر والباقة** (`/admin/settings`).
- Core stays in every pack: catalogue, storefront, orders, counter sales, inventory,
  books Excel import/export (leaving is never a trap).

## Packs — proposal (prices to be set by the owner)

Packs are cumulative. Names are suggestions.

| | **أساسي — Starter** | **مكتبة — Pro** | **مؤسسة — Business** |
|---|---|---|---|
| Online storefront + orders + requests | ✅ | ✅ | ✅ |
| Admin web + mobile admin app, cover scanner | ✅ | ✅ | ✅ |
| Books per store | up to 1,000 | up to 10,000 | unlimited |
| Excel import of books & stock | 1 import / month | ✅ unlimited | ✅ |
| Excel export (books, orders) | ✅ (leaving is never a trap) | ✅ | ✅ |
| Social-media content export (ZIP) | — | ✅ | ✅ |
| Money module: purchases, counter sales, expenses, suppliers | — | ✅ | ✅ |
| Invoices (PDF) | — | ✅ | ✅ |
| Reports: income vs. expenses, margins, stock value | — (overview dashboard only) | ✅ | ✅ |
| Import of sales / purchases / invoices history | — | — | ✅ |
| Several staff accounts with roles | — | — | ✅ (needs per-user login) |
| Academic catalogue (specialities, years, subjects) | — | ✅ | ✅ |
| Custom domain, priority support, assisted migration | — | — | ✅ |

**Selling points to lead with:** "send us your Excel, it's in the shop in 5 minutes"
(Phase 1 already does this), and "your data stays yours — one click exports
everything back to Excel".

## Still to do

Prerequisite for multi-store sales: per-user accounts (today each deployment has one
shared admin password) and the platform-owner console to create stores and set plans.

Mobile apps (`store_app`, `admin_app`) do not have the money, reports and packs screens yet; they keep working (the API is unchanged for them) and need a port.

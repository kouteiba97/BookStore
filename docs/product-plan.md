# Product plan — moving shops from Excel to the platform

Most bookshops run on Excel: book lists, stock, purchases, sales, invoices,
orders. The platform wins them over when **moving is effortless** (bring your
sheets as they are) and **leaving is never a trap** (everything exports back to
Excel). Features are then sold in packs.

## Phases

| Phase | Status | What it gives a shop |
|---|---|---|
| **1. Smart import + export** | ✅ shipped | Upload any book/stock sheet (.xlsx, .xls, .csv, Arabic or French headers). Columns are recognised automatically; the admin checks the mapping, sees a row-by-row preview (new / update / duplicate / error / missing info), imports, gets a "what's missing" report, and can undo. Export of books + stock value, and orders + monthly income, to Excel. |
| **2. Money module** | planned | Suppliers, purchases (stock in), in-shop sales (stock out), expenses (rent, salaries, transport…), invoices as printable PDF. One sales register: website orders + counter sales + imported sales. Each importable with the same wizard. |
| **3. Reports** | planned | Income vs. expenses per month, gross margin (sale − purchase price), profit, best/worst sellers, slow stock, stock value. Excel and PDF. |
| **4. Packs** | planned | Each store has a plan; features outside it are visible but locked, with an "upgrade" prompt. |

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
| Reports: income vs. expenses, margins, stock value | basic (orders only) | ✅ | ✅ |
| Import of sales / purchases / invoices history | — | — | ✅ |
| Several staff accounts with roles | — | — | ✅ (needs per-user login) |
| Academic catalogue (specialities, years, subjects) | — | ✅ | ✅ |
| Custom domain, priority support, assisted migration | — | — | ✅ |

**Selling points to lead with:** "send us your Excel, it's in the shop in 5 minutes"
(Phase 1 already does this), and "your data stays yours — one click exports
everything back to Excel".

## What packs need technically (Phase 4)

- `Store.plan` (+ optional per-feature overrides and limits), set by the platform owner.
- A backend guard `@RequiresFeature('import')` returning 402 with an upgrade message.
- The admin reads `GET /admin/plan` and shows locked items with a lock icon and an
  "upgrade" call-to-action instead of hiding them.
- Usage counters for limits (books per store, imports per month).

Prerequisite for multi-store sales: per-user accounts (today each deployment has one
shared admin password) and the platform-owner console to create stores and set plans.

# Book data model — everything the platform stores for one book

> Reference for the "Quick Add" upload form. Lists every field, whether it's required,
> its type, where it lives in the DB, and how it's captured. Derived from
> `prisma/schema.prisma`, `src/modules/admin/books/dto/upsert-book.dto.ts`,
> `admin-books.service.ts`, and the existing admin book form.
> Date: 2026-06-05.

## 1. The `Book` row (core fields)

| Field | Required? | Type | Notes |
|---|---|---|---|
| `title` | **Yes** (DB `NOT NULL`) | string | The only truly mandatory field — a book must have a name. `titleNormalized` is derived automatically (Arabic normalization) for search; the form never sets it. |
| `imageUrl` | No | string (URL) | Cover image. Captured by **taking/uploading a photo** → backend uploads to R2 → stores the public R2 URL. May be left empty. |
| `categoryId` | **Effectively no** (made skippable) | FK → `Category` | DB requires a category, so if the user skips it we default to the **"غير مصنف"** (Uncategorized) category, auto-created if missing. |
| `authorId` | No | FK → `Author` | Pick existing or type a new name (auto-created). |
| `publisherId` | No | FK → `Publisher` | Pick existing or type a new name (auto-created). |
| `countryId` | No | FK → `Country` | Country of publication. Pick or create. |
| `year` | No | int | Publication year. |
| `price` | No | decimal(10,2) | Price in DZD (د.ج). The one field only the store knows. |
| `description` | No | string (long) | Free text. |
| `storeId` | auto | FK → `Store` | Set automatically by the backend (single-store resolver). Never in the form. |

## 2. Inventory (optional `Inventory` row, 1:1 with book)

Only created if the user enables "track inventory."

| Field | Required? | Type | Values |
|---|---|---|---|
| `status` | Yes *(if inventory tracked)* | enum | `available` (متوفر) · `on_request` (حسب الطلب) · `rare` (نادر) |
| `stock` | No | int | Quantity on hand. Leave empty if unknown. |

If inventory isn't tracked, the book simply has no inventory row.

## 3. Academic placement (optional, many-to-many)

A book can be tagged to one or more **subjects** in the academic taxonomy. This is what makes it show up under the academic browser. Independent of `Category`.

Taxonomy hierarchy (each level created/managed under `/admin/academic`):

```
Field (التخصّص)   →   AcademicYear (السنة)   →   Subject (المادة)
   e.g. الطب              السنة الأولى               علم التشريح
```

- The book links to **`Subject`** rows via `BookOnSubject` (`subjectIds: string[]`).
- Choosing a subject implies its year and field (no separate storage needed).
- A book may belong to **multiple** subjects.
- Entirely optional — non-academic books just have no subjects.

**Capture flow in the form:** toggle "كتاب أكاديمي؟" → pick التخصّص → pick السنة → check one or more المواد. New field/year/subject are managed on the Academic page (not created inline in Quick Add, to keep the taxonomy clean).

## 4. Reference / lookup tables (the dropdowns)

| Table | Fields | Created inline from Quick Add? |
|---|---|---|
| `Category` | `name`, `description?` | Yes — type a new name to create |
| `Author` | `name` (unique) | Yes |
| `Publisher` | `name` (unique) | Yes |
| `Country` | `name` (unique) | Yes |
| `Field` / `AcademicYear` / `Subject` | `name` | No — managed on the Academic page |

## 5. Required vs optional — summary

- **Hard required:** `title` only.
- **Auto-defaulted if skipped:** `categoryId` → "غير مصنف".
- **Everything else is optional** and can be left blank, per the requirement that partial records are allowed.

## 6. What the backend sets automatically (never in the form)

- `id`, `createdAt`, `updatedAt` — generated.
- `storeId` — from the single-store resolver.
- `titleNormalized` — derived from `title` for Arabic search.

## 7. API surface used by the form

| Action | Endpoint |
|---|---|
| Upload cover photo | `POST /api/v1/admin/uploads/cover` (multipart `file`) → `{ url }` |
| Create book | `POST /api/v1/admin/books` (body = fields above) |
| List/create categories, authors, publishers, countries | `GET/POST /api/v1/admin/catalog/:resource` |
| Academic taxonomy tree | `GET /api/v1/admin/academic/tree` |

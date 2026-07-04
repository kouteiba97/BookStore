# BookStore Mobile — مكتبة البيان

Two Flutter apps ported from the web platform, sharing the same backend, design system (warm library palette, Amiri + Cairo fonts), logo, and logic. Both are Arabic-first (full RTL).

| App | Folder | Mirrors | Audience |
|---|---|---|---|
| **Store** (`elbayan_store`) | `store_app/` | `frontend/` web storefront | Customers |
| **Admin** (`elbayan_admin`) | `admin_app/` | `admin/` web dashboard | Back office |

## Store app (customers)
- **Home** — hero with logo + tagline, search box, category tiles, latest-books grid
- **Search** — debounced live search (`/books/search`)
- **Book detail** — cover, price, availability, details, similar books
  - **اطلب عبر واتساب** — order form → composes the WhatsApp message client-side (same format as web `order-modal.tsx`)
  - **اطلب توفير هذا الكتاب** — request form → `POST /requests` saves the lead server-side, then opens the returned `whatsappUrl` (same as web `request-dialog.tsx`)
- **Academic** — fields → years → subjects → books drill-down
- 58-wilaya dropdown identical to the web's `wilaya-select.tsx`

## Admin app (back office)
- **Login** — shared password → 30-day JWT, stored in `SharedPreferences`; auto-logout on 401
- **Overview** — KPI cards, orders/requests by status, top sellers, recent activity (7/30/90-day range)
- **Orders** — list with status filters + search; detail with items/totals, tap-to-call / WhatsApp, and the same status state machine as the backend (`pending → confirmed → shipped → delivered`, cancel from any active state, delete only when cancelled)
- **Requests** — leads with status workflow (جديد → تم التواصل → مكتمل), call/WhatsApp shortcuts
- **Books** — searchable list; tap to edit
- **Quick-Add** — mobile book entry with **camera/gallery cover upload → R2** (via `POST /admin/uploads/cover`), free-text category/author/publisher/country (found-or-created server-side), "save & add another" flow
- **Catalog** — categories/authors/publishers/countries CRUD
- **Academic** — fields → years → subjects tree CRUD
- **Inventory** — status/stock editing with low-stock filter

## Configuration

Both apps default to the **production API** (`https://bookstore-api-uzrj.onrender.com`, store `elbayan`). Override at build/run time:

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:3000 --dart-define=STORE_SLUG=elbayan
# store app also accepts: --dart-define=WHATSAPP_NUMBER=2137...
```

> `10.0.2.2` reaches your host machine's `localhost` from the Android emulator.

## Run / build

```bash
cd mobile/store_app   # or mobile/admin_app
flutter pub get
flutter run                       # dev on connected device/emulator
flutter test                      # widget tests
flutter build apk --release       # Android release build
flutter build ipa                 # iOS (requires macOS/Xcode)
```

## Notes
- Free-tier API sleeps after ~15 min idle; the first request can take ~50 s. HTTP timeouts are set to 75 s and error views offer retry.
- Design tokens live in each app's `lib/theme.dart` (duplicated by convention, like the web apps duplicate `lib/`).
- The logo is the same SVG as the web favicon (`assets/logo.svg`).

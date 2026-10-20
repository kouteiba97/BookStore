# Sales material — SILA 2026

Material for selling the platform (full edition) to other bookstores and publishers.
Not part of any build: `docs/` is excluded from the Docker image and from both Vite apps.

| File | What it is |
|---|---|
| `sila-kit-ar.html` | Arabic sales guide: what to sell, pricing and why, pitches (Darja + French), 3-minute demo, NFC card, WhatsApp follow-ups, objections, pre-fair checklist. Open it in a browser. |
| `flyer-a5-ar.html` / `.pdf` | One-page A5 Arabic flyer for the fair: benefits, the two packs with prices, fair offer, QR and contact placeholders. Fill the placeholders, then re-export the PDF (Chrome: print → A5, no margins, or `chrome --headless --print-to-pdf`). |
| `fair-pitch-ar.md` | One-page cheat sheet for the stand: 30-second opener, 2-minute demo, objections, lead fields, 48-hour WhatsApp follow-up, what to bring. |
| `contract-ar.md` | One-page service agreement **template** (setup, yearly subscription, data ownership, 30-day grace, support hours, custom work, deposit). Have it reviewed before use. |
| `portfolio/index.html` | Arabic product page for the NFC business card, with real screenshots of the full edition. Self-contained static site (`index.html` + `img/`). |
| `portfolio/img/*.webp` | 23 screenshots (storefront, academic module, admin), taken from a local demo with the real Bayan catalogue and **fictional** prices, stock and orders. |
| `demo-tools/` | The scripts that produced the screenshots (see below). |

**Pricing (October 2026):** standard copy (own name, logo, colours, theme, domain; `starter` pack) 30,000 DZD setup + 50,000 DZD/year; standard + Pro features (`pro` pack: invoices, money, reports, academic) 50,000 + 65,000/year; custom work = days × 12,000 DZD + 15–30k/year maintenance. The yearly fee is always called «اشتراك سنوي: استضافة + تحديثات + دعم + نسخ احتياطي». Fair offer: first 10 stores get half-price setup, reserved with a 10,000 DZD deposit taken off the setup.

Online copies (private to the owner's claude.ai account):
- Sales guide: https://claude.ai/artifact/HDA9jpFS4AuN7SPeX23JV8
- Portfolio: https://claude.ai/artifact/AbP1UFdPH2tKdEMJrawKCQ

## Before using the portfolio

1. Fill in `CONFIG` at the bottom of `portfolio/index.html` (name, phone, WhatsApp in international format, email, city).
2. Host it on your own domain (e.g. a free Render **Static Site** with publish directory `docs/sales/portfolio`, or its own repo).
3. Program the NFC card with a short URL on that domain, and print the same URL as a QR code on the card.

## Regenerating the screenshots (`demo-tools/`)

They build a throwaway local demo: PGlite (Postgres in WebAssembly, nothing to install system-wide), the backend, both frontends with `VITE_EDITION=full`, then headless Chrome over the DevTools protocol.

1. In an empty folder: `npm i @electric-sql/pglite @electric-sql/pglite-socket pg`, copy the scripts in, run `node pg.mjs` (keep it running).
2. `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?connection_limit=1&sslmode=disable&pgbouncer=true"` then, from the repo root, `npx prisma migrate deploy`.
3. With the same `DATABASE_URL`: `node seed-demo.cjs` (copies the public catalogue from the live API and adds fictional orders), then `node enrich.cjs`.
4. Create a local `.env` (DATABASE_URL above, `STORE_SLUG=elbayan`, a test `ADMIN_PASSWORD` and `JWT_SECRET`), and `VITE_EDITION=full` in `frontend/.env.local` and `admin/.env.local`. Start the backend (:3000), storefront (:5174) and admin (:5175).
5. Log in once via `POST /api/v1/admin/auth/login` and save the token to `%TEMP%\demo-token.txt`, then `node shoot.mjs <output-folder>`.

Paths inside the scripts point at this machine's layout (`C:/Users/ii/Desktop/BookStore`, Chrome's default install path, and IDs from the demo database in `shoot.mjs`). Adjust them on another computer. Delete the `.env` and `.env.local` files afterwards.

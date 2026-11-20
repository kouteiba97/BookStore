# النشر التلقائي — Social auto-posting

The server posts one book a day (two in busy seasons) to the store's Facebook Page and
Instagram account, at Algerian prime time, by itself. The owner connects once; after that a
person is needed only for the rare events listed at the end, and each of them arrives as a
Telegram message saying exactly what to do.

Code: `src/modules/admin/social-autopost/` · admin page:
`admin/src/pages/admin/social-autopost.tsx` (menu «النشر التلقائي») · research behind every
choice: `reports/Facebook posting times Algeria automation.md` (+ raw notes in
`research_notes/`).

## Status — handoff (read this first in a new session)

**Phases 1 and 2 (backend + web) are on `master` (Nov 2026).** Tested end to end in dry-run
mode (unit specs + `scripts/social-autopost-sim.js`, 22 scenario checks). It has **not yet
posted to a real Meta account** — that needs the owner's one-time setup below.

| Phase | What | State |
|---|---|---|
| 1 | Queue tables, planner, captions, 4:5 Instagram image, Meta publisher, error classes, auto-pause + Telegram, admin page, calendar | ✅ done |
| 2a | New arrivals: a book added in the last 3 days takes the next slot (≥ 1 h away) on each platform, announced «وصل حديثاً»; Meta-scheduled posts are taken back for it | ✅ done |
| 2b | Evening digest: non-urgent messages wait for one silent Telegram message at 19:30; Thursday adds a weekly summary. Urgent ones (channel paused) still go out at once | ✅ done |
| 2c | Books with no stock status (web Quick-Add default) are postable; stock = 0 and «حسب الطلب» never are | ✅ done |
| 2d | Mobile: `admin_app/lib/screens/social_autopost.dart` in BookStoreMobile (المزيد ← النشر التلقائي) — channel health + resume, queue actions, run now. Token connect and calendar stay web-only | ✅ done (needs a new APK build) |
| — | Owner's Meta setup + first real post + check it is public | ⏳ owner |
| later | Optional AI hook line in captions (facts only — never invent claims about a religious book; needs an API key and owner approval of cost) | not started |
| 3 | Learning loop: pull per-post reach nightly (Graph post insights), 5 posts in the best slot / 2 in test slots per week, move the main slot after 4–8 weeks (separate profiles for normal, summer, Ramadan) | later — needs a few weeks of real posts first |

Decisions already taken (don't re-litigate without the owner):
- **Meta API directly**, no Zapier/Make/Buffer — data, covers and admin already live here.
- **System-user token** (Business Manager, never expires), Instagram through **Facebook Login**
  (not Instagram Login — its 60-day token must be refreshed forever).
- Runs **inside the API** every 10 min (free; the API keeps itself awake —
  `common/keep-alive.ts`). The Render Cron Job in `render.yaml` is commented out: an optional
  ≈ $1/month backup the owner must approve. Both together are safe (database lease).
- Gated by the existing pack feature **`socialExport`** (packs «مكتبة» and «مؤسسة»). If
  auto-posting should be sold separately, add a new feature in `common/plan/plans.ts` — a
  pricing decision for the owner.
- No TikTok / WhatsApp Status: TikTok posts stay private until an app audit; WhatsApp has no
  posting API.
- Work goes straight to `master` (the owner does not use `develop`).

## How it works

`SocialAutopostService.tick()` (`autopost.service.ts`) does everything that is due and is
safe to call any time; `SocialTicker` calls it every 10 min inside the API,
`node dist/social-tick.js` runs it once (cron / manual), and «تشغيل الآن» in the admin calls
it too.

1. **Plan** the next 14 days: one post per free slot. Books must have an https cover and be
   `available` or `rare` (or have no stock status recorded), never stock 0; a book is not
   posted again on the same platform for 120 days; books with a description go first; two
   posts in a row avoid the same category. Before planning, **new arrivals** (added in the
   last 3 days, not yet posted) take over the next slot ≥ 1 h away from an older book.
2. **Approve** drafts after `autoApproveHours` (default 48 h) unless the owner skipped them.
3. **Check the token** once a day (renews it if `META_APP_ID`/`META_APP_SECRET` are set and
   Meta made it expiring).
4. **Facebook**: approved posts up to 7 days ahead go into Meta's own scheduler, so they
   publish even if our server is down. Then the run confirms they went out.
5. **Instagram** (Meta has no scheduler for it): 30 min before the slot the cover is framed
   to 1080×1350 (Instagram refuses 2:3 covers), uploaded to R2 under
   `social/instagram/…`, and a container is created; at the slot it is published.
6. Slots more than 3 h late are dropped, never posted at a dead hour.

No double posts: each post is claimed atomically before any Meta call, and after an uncertain
failure the next attempt first asks Meta whether the first one went through.

**Errors** (`meta-errors.ts`): hiccups are retried (5 min → 15 min → 1 h → 3 h);
throttling pauses the channel for an hour; a bad picture fails that one post and the queue
moves on; account problems (checkpoint, spam flag, revoked access, dead token) **pause the
channel** and alert the owner at once (Telegram). 5 failures in a row also pause it. Everything
non-urgent (a skipped book, the queue running dry, token expiring in > 3 days) waits for the
silent **19:30 digest** (`sendDigest`), with a weekly summary on Thursdays.

Files: `schedule.ts` (slots + calendar, pure) · `book-picker.ts` · `captions.ts` (templates
built only from stored facts, ≤ 5 hashtags) · `instagram-image.ts` · `meta-graph.client.ts`
(+ `DryRunMetaApi`) · `meta-errors.ts` · `token-crypto.ts` · `notifier.service.ts`
(Telegram + heartbeats) · `autopost.service.ts` (engine) · `autopost-admin.service.ts` +
`autopost.controller.ts` (`/api/v1/admin/social-autopost/*`) · `social-ticker.ts`.
Tables: `SocialSettings`, `SocialChannel`, `SocialPost` (migration
`20261115120000_social_autopost`).

## Schedule (Algeria time, UTC+1, `schedule.ts`)

| Day | Facebook | Instagram |
|---|---|---|
| Sun–Fri | 20:30 | 21:15 |
| Saturday | 11:00 | 20:30 |
| Summer (15 Jun – 30 Sep) | evening slots +1 h | +1 h |
| Busy season | + 12:15 (Friday 10:00) | — |
| Ramadan | 17:00 and 22:00 | 22:30 |
| Exam day (Bac/BEM) | 21:00 only | 21:30 only |
| Quiet day (Eid) | none | none |

Nothing is ever scheduled Friday 12:00–14:30. Ramadan, exam days, quiet days and busy
seasons are edited in the admin (التقويم); the defaults cover 2026–27 and the moon-dependent
dates list both candidate days. **The 2027 Bac dates are a guess (9–13 May)** — correct them
when the ministry announces them.

## One-time setup (owner, ~1 hour)

1. Instagram → switch to a **Professional (Business)** account and link it to the Facebook Page.
2. Make sure a **Meta Business portfolio** owns the Page; turn on 2FA on the owner's account.
3. developers.facebook.com → create a **Business** app owned by that portfolio, add a privacy
   policy URL, and switch it to **Live** (posts from an app in Development mode are invisible
   to the public).
4. Business Settings → **System users** → add one → assign the Page and the Instagram account
   with full control → install the app → **Generate token**, "Never expires", scopes
   `pages_show_list pages_read_engagement pages_manage_posts instagram_basic
   instagram_content_publish business_management`.
5. Admin → **النشر التلقائي** → paste the token → ربط.
6. Telegram: create a bot with @BotFather, send it a message, put `TELEGRAM_BOT_TOKEN` and
   `TELEGRAM_CHAT_ID` in the API's Render env vars.
7. Optional but recommended: two free checks at healthchecks.io — `HEALTHCHECK_TICK_URL`
   (period 10 min, grace 30 min) and `HEALTHCHECK_PUBLISH_URL` (period 1 day, grace 1 day).
   They alert when the server itself stops, which it cannot report on its own.
8. Serve covers from an **R2 custom domain**, not `r2.dev` (rate-limited, development only).
9. After the first post, open the Page from a logged-out phone to confirm it is public.

## Env vars (API)

`SOCIAL_TOKEN_KEY` (required in production; Render generates it), `META_APP_ID` +
`META_APP_SECRET` (optional, enables self-renewal), `META_GRAPH_VERSION` (default `v25.0`,
supported until 29 Jul 2028 — bump yearly), `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`,
`HEALTHCHECK_TICK_URL` + `HEALTHCHECK_PUBLISH_URL`, `SOCIAL_TICK_IN_PROCESS=false` (stop the
in-API timer, e.g. when the cron job runs instead), `SOCIAL_DRY_RUN=true` (log instead of
posting).

## When a person is still needed

| Event | What the owner gets | Fix |
|---|---|---|
| Meta's yearly Data Use Checkup | Meta e-mails 60/30/10/3 days ahead | ~15 min in the App Dashboard |
| Facebook/Instagram security check | Telegram: channel paused + steps | Clear it in the app, press "استئناف" |
| Spam / policy flag | Telegram: channel paused | Check Account Status, then resume |
| Page or Instagram access changed | Telegram: channel paused | Re-assign to the system user, paste a new token |
| No more eligible books | Telegram, daily | Add covers via Quick-Add |
| Server stopped entirely | healthchecks.io e-mail | Check Render |

## Testing

- Unit specs: `src/modules/admin/social-autopost/*.spec.ts` (schedule, captions, error
  classes, token crypto, picker, 4:5 image).
- End to end against a local DB (never production):
  `npm run build && DATABASE_URL=<local, migrated> node scripts/social-autopost-sim.js`.
- Manual: `SOCIAL_DRY_RUN=true` on the API, connect with any token in the admin, «تشغيل الآن».
- Note: on the PC where this was built, Jest 30 could not start (its native resolver needs the
  Microsoft Visual C++ runtime, which was missing). Specs were run with Node's test runner
  instead; on a machine with the runtime, `npm test` works as usual.

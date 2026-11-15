# Publishing mechanics, limits, policy risks and reliability for unattended Facebook Page + Instagram auto-posting (Meta Graph API)

Context assumed throughout: NestJS API on Render, book-cover JPEGs (≤2000 px, plus 480 px thumbs) on Cloudflare R2 public https URLs, Arabic captions, ~1–3 posts/day. Research date: Nov 2026. Meta docs pages fetched Nov 2026 are undated "living" docs; third-party items are dated where known.

## Q1. Facebook Page photo posting: endpoints, scheduling, image limits, rate limits, error codes

### Takeaway
Post a photo with `POST /{page-id}/photos` (`url` = public image URL, `caption` = text); it returns both a photo `id` and a `post_id`. Facebook has real API scheduling (`published=false` + `scheduled_publish_time`). The current Pages API guide gives a window of 10 minutes to 30 days, which is a useful safety buffer for an unattended job. Photos can be up to 4 MB (JPEG/PNG/BMP/GIF/TIFF). Throttling is per Page (Business Use Case limit, 4800 × engaged users per 24 h), far above 1–3 posts a day.

### Cited Findings
- **Photo endpoint**: `POST /{page_id}/photos` with `url` (public URL of an image) returns an `id` for the photo and a `post_id` for the feed post. — [Meta, Pages API: Posts](https://developers.facebook.com/docs/pages-api/posts/)
- **Photo parameters** (Page Photos reference): `url` (a public URL, or attach the file as multipart, where the field has "historically" been called `source`); `caption` (UTF-8, emoji allowed; `message`/`name` are deprecated in favour of `caption`); `published` (default true); `scheduled_publish_time` (Unix ts, Pages only); `temporary` (needed for photos used inside a scheduled multi-photo post: `published=false`, no `scheduled_publish_time`); `no_story` (suppresses the feed story); `unpublished_content_type` (SCHEDULED, DRAFT, PUBLISHED…). — [Meta, Graph API Page/photos reference](https://developers.facebook.com/docs/graph-api/reference/page/photos/)
- **Image limits (FB)**: accepted formats .jpeg, .bmp, .png, .gif, .tiff. Max **4 MB**. Keep PNG under 1 MB to avoid pixelation. Facebook strips location metadata and resizes images. Unpublished uploads are kept about 24 h and then deleted if never published. — [Page/photos reference](https://developers.facebook.com/docs/graph-api/reference/page/photos/)
- **Feed endpoint**: `POST /{page_id}/feed` takes `message`, `link`, `published` (default true), `scheduled_publish_time` (required when `published=false`; accepts a Unix ts, ISO 8601, or a PHP `strtotime()` string such as "+2 weeks"). Optional `targeting.geo_locations` / `feed_targeting.geo_locations`: target a country OR a region inside it, never both, or you get an overlap error. — [Pages API: Posts](https://developers.facebook.com/docs/pages-api/posts/)
- **Scheduling window**: the current guide says the publish time must be "between 10 minutes and 30 days" from the API request. — [Pages API: Posts](https://developers.facebook.com/docs/pages-api/posts/). **Conflict:** older and third-party sources give 75 days (one guide citing the Page Feed reference) or 6 months (Meta developer blog, **2012**). — [Meta dev blog 2012](https://developers.facebook.com/blog/post/2012/07/23/new-marketing-tools-for-pages/); [adaptlypost](https://adaptlypost.com/blog/how-far-advance-can-you-schedule-post-api); [Kestra plugin (10 min–30 days)](https://kestra.io/plugins/plugin-meta/facebook/io.kestra.plugin.meta.facebook.posts.schedule). Treat **30 days** as the safe maximum. Read `scheduled_publish_time` back after creating a post to check it.
- Listing scheduled posts: `GET /{page-id}/scheduled_posts` exists. — [Graph API page/scheduled_posts](https://developers.facebook.com/docs/graph-api/reference/page/scheduled_posts/)
- **Permissions / token**: a Page access token from someone who can do `CREATE_CONTENT` on the Page, with `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`. The Posts guide also lists `pages_manage_engagement` and `pages_read_user_engagement`, and the tasks CREATE_CONTENT, MANAGE, MODERATE. An app can only update posts it created itself. — [Page/photos reference](https://developers.facebook.com/docs/graph-api/reference/page/photos/); [Pages API: Posts](https://developers.facebook.com/docs/pages-api/posts/)
- **Rate limits**: Pages API calls made with Page or system-user tokens fall under **Business Use Case (BUC)** limits: "Calls within 24 hours = 4800 * Number of Engaged Users", where engaged users are people who interacted with the Page in the last 24 h. Platform limits (app/user tokens): 200 × users per hour. Usage headers: `X-App-Usage` (call_count / total_time / total_cputime as %) and `X-Business-Use-Case-Usage` (per business ID; includes `estimated_time_to_regain_access` in minutes). Guidance: once throttled, STOP calling, because further calls extend the block. Spread requests evenly. — [Meta, Graph API Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- **Throttle codes**: 4 (app), 17 (user), 32 (Pages API), 613 (custom limit; subcode 1996 = inconsistent request volume), 80001 (Pages BUC, Page/system-user token), 80002 (Instagram BUC). — [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- **Photo-creation errors**: 368 (temporarily blocked for policy violations), 324 (missing or invalid image file), 200 (permissions), 190 (invalid token), 100 (invalid parameter), 80001 (too many calls to the Page: "Wait a bit and try again"). — [Page/photos reference](https://developers.facebook.com/docs/graph-api/reference/page/photos/)
- **General error table**: 1 (unknown, possibly temporary, retry), 2 (service, temporary downtime, retry), 4/17/341 (throttling, wait and retry), 10 and 200–299 (permission denied or revoked), 102 and 190 (session/token expired or invalid, get a new token), 368 (temporarily blocked for policy violations; docs say "wait and retry"), **506 (duplicate post: identical posts can't be published back-to-back)**, 1609005 (link publishing error). Auth subcodes: 458 app not installed, **459 user at checkpoint** (must log in on facebook.com), 460 password changed, 463 expired, 464 unconfirmed user, 467 invalid token, 492 invalid session (the token's user lacks a Page role). — [Meta, Graph API Error Handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/)

### Inferences
- The 2000 px JPEG covers fit FB's 4 MB cap easily (sharp output is typically a few hundred KB). Facebook re-compresses anyway.
- FB native scheduling makes a good resilience layer. A daily or weekly job can push the next N approved posts to Facebook as scheduled posts, up to 30 days ahead. Facebook then publishes them even if the Render service is asleep or down at post time. Store the returned post id so a re-run doesn't schedule the same book twice.
- Error 506 is a built-in duplicate guard, but only for identical back-to-back content. Don't rely on it for idempotency.
- Simplest shape for 1–3 posts/day: a single-photo post (`/photos` with `url` + `caption`). Put the storefront link inside the caption text (the Q4 link-limit test only reportedly affected link posts).

### Gaps
- Meta's docs don't give pixel-dimension limits for `/photos` (only the file size). Max caption length for FB photo captions isn't documented on the fetched pages.
- The 30-day vs 75-day scheduling window couldn't be settled from the reference page itself. The current guide says 30 days.
- The fetched rate-limit page doesn't document the `X-Page-Usage` header.

## Q2. Instagram Content Publishing API: container flow, image rules, limits, carousels, captions, scheduling

### Takeaway
Instagram publishing is a two-step flow: create a container (`POST /{ig-id}/media` with `image_url` + `caption`), wait until its `status_code` is FINISHED, then `POST /{ig-id}/media_publish` with `creation_id`. Images must be JPEG only, ≤8 MB, aspect ratio between 4:5 and 1.91:1, 320–1440 px wide, at a public ASCII-only URL. Containers expire after 24 h. The API has no native scheduling, so the server itself must be awake at post time. The daily publish quota is documented as 50 on the reference page and 100 in the guide, so read it at runtime from `content_publishing_limit`.

### Cited Findings
- **Flow**: (1) `POST /<IG_ID>/media` with `image_url` (+ `caption`) creates a container. For carousels, create each child with `is_carousel_item=true`, then a `media_type=CAROUSEL` container with `children` = comma-separated IDs. (2) `POST /<IG_ID>/media_publish` with `creation_id` returns a media ID. (3) If no media ID comes back, check `GET /<container-id>?fields=status_code`. — [Meta, IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **Container status_code values**: IN_PROGRESS, FINISHED, PUBLISHED, ERROR, **EXPIRED (not published within 24 hours)**. Meta recommends polling once a minute for at most 5 minutes. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **Image specs (`image_url`)**: JPEG only (MPO and JPS not supported). **Max 8 MB**. Aspect ratio "must be within a 4:5 to 1.91:1 range". Min width 320 px (smaller is scaled up). **Max width 1440 px** (larger is scaled down). sRGB (other colour spaces are converted). — [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media); format also stated in [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **URL requirements**: "We will cURL the image using the URL that you specify so the image must be on a public server". URLs must use only US-ASCII characters or the request fails. The media must be reachable at the time of the attempt. — [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media); [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **Caption limits**: "Maximum 2200 characters, 30 hashtags, and 20 @ tags". Carousel children can't carry captions; set the caption on the carousel container. — [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- **Carousels**: up to **20** children (images and/or videos). Carousel crop follows the first image (default 1:1). A carousel counts as one post against the quota. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/); [IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- **Container cap**: "An Instagram account can only create **400 containers** within a rolling 24 hour period." — [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- **Publish quota — CONFLICT**:
  - The guide's Rate Limit section says 100 API-published posts per 24 h moving window, enforced on `media_publish`.
  - The same guide's carousel section says 50. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
  - The endpoint reference says `quota_total` is "currently 50", `quota_duration` 86400 s. Optional `since` param (Unix ts no older than 24 h). — [IG content_publishing_limit reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)
  - A developer's real response showed `quota_total: 100`. A 2025-ish dev.to post cites a "documented" 25/day (25 was the historic figure). — [dev.to "Instagram Graph API lies to you"](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2); [search summary incl. adaptlypost](https://adaptlypost.com/blog/content-publishing-limit-instagram-api)
- **No native scheduling via API**: the guide doesn't describe any scheduling parameter. It only tells apps that let users schedule posts to enforce the rate limit themselves. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **Permissions / hosts**:
  - Instagram Login: `instagram_business_basic` + `instagram_business_content_publish`, on `graph.instagram.com`.
  - Facebook Login (Page token): `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (+ `ads_management`/`ads_read` if the user has a Business Manager role on the Page), on `graph.facebook.com`.
  - Business Login: system-user token. All options require Advanced or Standard Access. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- **Silent blockers**: publishing fails until **Page Publishing Authorization (PPA)** is completed for Pages that require it. Requests also fail without a specific code if 2FA requirements aren't met or the URL has non-ASCII characters. Shopping tags aren't supported. `is_ai_generated=true` self-discloses AI use. — [IG Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/); [IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- **IG publishing error subcodes** (from [IG Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes)):
  - 2207001 server error (retry)
  - 2207003 media download timed out (retry)
  - 2207004 image too large to download, >8 MiB (fix)
  - **2207008 container doesn't exist or expired** (temporary: retry 1–2× at 30 s–2 min intervals, then create a new container)
  - **2207009 aspect ratio out of range** (fix)
  - 2207020 media expired (new container)
  - 2207027 / 9007 not ready (wait for FINISHED)
  - 2207032 failed to create container (retry)
  - **2207042 daily publishing limit reached** (try next day)
  - **2207050 account inactive, checkpointed or restricted** (the user must open the app and resolve it)
  - **2207051 flagged as possible spam**
  - 9004 media couldn't be fetched from the URI (check the URL is valid and public)
  - 36000 >8 MiB
  - 36001 unsupported format
  - 36003 invalid aspect ratio
  - 36004 caption too long
- **Field report (dev.to, dated "Jun 19", year not given, probably 2025)**:
  - A block came back as `code 4, subcode 2207051, is_transient:false` with "Application request limit reached", while `quota_usage` was 0 and `x-app-usage` was 0%. The author blamed bursting 13 posts in one hour.
  - `media_publish` returned **403 but the posts went live**. Treating 403 as a failure and retrying created 12 duplicates. The fix: after any ambiguous failure, check the account's recent media.
  - Adding a permission in the console doesn't update an existing token. A new token is needed. — [dev.to](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2)

### Inferences
- **Critical for book covers**: typical covers are about 2:3 (0.667 width/height), which is taller than IG's minimum 4:5 (0.8). Uploading the raw cover will likely fail with 2207009/36003. Generate an IG-specific derivative: pad the cover onto a 4:5 canvas (e.g. 1080×1350 px), JPEG, sRGB, ≤8 MB. Keep it ≤1440 px wide, since IG downsizes anything bigger. The existing 2000 px master can be the source. The 480 px thumbnail also passes the 320 px minimum, but it's too small for quality.
- Use ASCII-only R2 object keys (UUID/slug-based). Arabic filenames in URLs would break IG fetches.
- At 1–3 posts/day the 50/100 quota is irrelevant. Still read `content_publishing_limit` before each publish, and never burst (the 2207051 report came from 13 posts/hour).
- With no native IG scheduling and a 24 h container expiry, the IG step must run in a process that's awake at publish time. Creating the container shortly before publishing (minutes, not days) avoids EXPIRED containers.
- Idempotency: persist the container id and its state. Before re-publishing, `GET` the container `status_code`. If it's PUBLISHED, record success instead of retrying.

### Gaps
- No authoritative resolution of 50 vs 100 posts/24 h. Always read `quota_total` at runtime.
- Whether `alt_text` takes Arabic and what its length limit is wasn't checked.
- Meta's error docs don't list the code for a 403 that still publishes. Known only from one field report.

## Q3. Does Meta's image fetcher have trouble with certain hosts/CDNs (R2 r2.dev, redirects, Content-Type, hotlink/bot protection)?

### Takeaway
Use an R2 **custom domain**, never `r2.dev`, for production fetches. Cloudflare says `r2.dev` is rate-limited and meant for development. Make sure no Cloudflare Bot Fight Mode, WAF or hotlink rule blocks Meta's crawler (`facebookexternalhit`), which fetches with Range requests.

### Cited Findings
- Cloudflare: "Public access through `r2.dev` subdomains is rate-limited and should only be used for development purposes". It is "intended for non-production traffic". Pointing a CNAME at an r2.dev host is an unsupported path with no reliability guarantee. Caching, WAF custom rules and Bot Management are available only behind a custom domain. If Zero Trust Access or WAF token auth is used, disable r2.dev or the bucket stays publicly reachable through it. — [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- Third-party vendor (Ayrshare) troubleshooting: Cloudflare **Bot Fight Mode** and similar WAF bot rules can block Meta's crawler IP ranges even when robots.txt allows them. Fix: check WAF logs and add an exception for `facebookexternalhit`. Test with `curl -A facebookexternalhit…`: HTTP 200/206 with binary data is healthy, while 403 or an HTML error page means blocked. Hotlink/Referer protection and expired presigned URLs also break fetches. — [Ayrshare: Meta media crawler blocked](https://www.ayrshare.com/docs/help-center/technical-support/meta_media_crawler_blocked)
- Meta developer-community thread: `facebookexternalhit` sends a **Range** header and got a 206. A public S3 JPEG failed with "Media download has failed" (subcode 2207052) while an external URL worked. — [Meta dev community thread](https://developers.facebook.com/community/threads/1053535300291870/)
- IG requires the URL to be public at attempt time and ASCII-only. Error 9004 = media couldn't be fetched. 2207003 = download timeout. — [IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media); [IG Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes)

### Inferences
- Serve IG/FB derivatives from something like `media.<store-domain>` (an R2 custom domain). Ensure the response is `Content-Type: image/jpeg`, has no redirects, supports Range (R2 does), and that no Bot Fight Mode applies to that hostname.
- Before each publish, a HEAD/GET pre-flight from the server (status 200, image/jpeg content type, size ≤8 MB for IG / ≤4 MB for FB) catches broken URLs before Meta does. A failed pre-flight becomes a clear permanent error ("fix the image") instead of an opaque 9004.
- Fallback for FB: `/photos` also accepts a multipart file upload. The server could stream the bytes itself if URL fetching misbehaves. IG has no equivalent for images (resumable upload is documented for video).

### Gaps
- No official Meta list of crawler IP ranges or user agents for content-publishing fetches was retrieved. No official confirmation that Bot Fight Mode causes 9004/2207052 (vendor and community evidence only).
- Whether Meta follows HTTP redirects for `image_url` isn't documented on the pages fetched.

## Q4. Spam/integrity risks: can automated or repetitive posting reduce reach or trigger restrictions?

### Takeaway
Automation itself isn't banned. "Very high frequency" posting (manual or automatic) and repetitive content are spam signals. Since July 2025, Facebook cuts distribution of accounts that repeatedly reuse others' content without meaningful additions. IG can return a hard "possible spam" block (2207051). Checkpoints or restrictions (FB subcode 459, IG 2207050) stop the API until a human logs in. At 1–3 varied posts a day the frequency risk is low; the main risks are repetitive templated captions, links in posts, and "unoriginal" cover images.

### Cited Findings
- Meta Spam policy: prohibits posting, sharing or engaging "either manually or automatically, at very high frequencies". Accounts at lower frequencies may still be restricted if other spam signals are present, such as "posting repetitive content" or signs of inauthenticity. Misleading links, cloaking, deceptive redirects, and like/share-gating are also prohibited. — [Meta Transparency Center: Spam](https://transparency.meta.com/policies/community-standards/spam/)
- **Unoriginal-content crackdown (14 July 2025)**: accounts that repeatedly reuse others' videos, **photos**, or text posts without permission or meaningful improvement lose monetization for a period and get **reduced distribution on everything they share**. Duplicate videos are demoted in favour of the original. Simply stitching clips or adding a watermark doesn't count as improvement. About 500,000 accounts were sanctioned in H1 2025 for spammy behaviour or fake engagement, and about 10M impersonator profiles removed. New Professional Dashboard post-level distribution insights and Support Home show penalty status. Advice from the same post:
  - Keep captions and hashtags relevant.
  - Captions with no links, minimal capitalization and **no more than five hashtags** performed best.
  - Avoid third-party watermarks and recycled content.
  - Rolled out gradually "over the coming months". — [Facebook Creators blog, 2025-07-14](https://creators.facebook.com/blog/combating-unoriginal-content); coverage: [TubeFilter 2025-07-15](https://www.tubefilter.com/2025/07/15/ai-slop-unoriginal-repetitive-content-monetization-facebook-meta/)
- Feed demotion categories listed by Meta include **Clickbait Links** and **Engagement Bait** (driven by user feedback). — [Meta Transparency: Types of content we demote](https://transparency.meta.com/features/approach-to-ranking/types-of-content-we-demote/)
- **Link-post limit test (Dec 2025)**: Meta confirmed a limited test where some Facebook **Pages** and professional-mode profiles could post only about **2 organic link posts per month** unless they subscribe to Meta Verified. Links in comments, affiliate links and links to Meta properties were exempt. Publishers weren't affected. Reports disagree (one says per week, another says it varies). Current status unknown. — [TechCrunch 2025-12-17](https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages); [Press Gazette](https://pressgazette.co.uk/news/facebook-tests-charging-creators-and-businesses-to-post-more-than-two-links-per-month/); [Shopifreaks](https://www.shopifreaks.com/facebook-tests-link-posting-limits-for-professional-accounts/)
- API-level enforcement signals:
  - FB **368** "temporarily blocked for policy violations"
  - FB subcode **459** "user at checkpoint" (must log in on the web)
  - IG **2207050** account inactive, checkpointed or restricted
  - IG **2207051** flagged as possible spam (`is_transient:false` in a field report) — [Graph API Error Handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/); [IG Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes); [dev.to](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2)
- Tokens: third-party guides say even "never-expiring" Page tokens are invalidated when the underlying user changes their Facebook password. Meta lists system-user tokens as expiring (60 days, refreshable) or non-expiring. — [Meta: System user tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens); [bundle.social guide 2026](https://bundle.social/blog/facebook-page-access-token)

### Inferences
- A bookstore posting publisher cover art risks the "reused photos" signal, since the same cover image is posted by many sellers. That signal mostly targets creators and monetization, but reduced distribution applies to everything an account shares. Mitigations: add something original to each image (the store's own shelf or hand photo when available, a branded 4:5 frame with price/availability); write varied captions (vary templates, include a short description or quote of the book's topic); ≤5 relevant hashtags; put the shop link in the first comment or link-in-bio rather than every post.
- Avoid identical captions across posts, and rotate templates. Never post the same book twice within a short window (the 506 duplicate error and the "repetitive content" signal).
- Treat 368, 459, 2207050 and 2207051 as **auto-pause** triggers. Retrying makes things worse and can't succeed until a human acts.
- Use a **system user** (Business Manager) token for the server, so a personal password change or a personal-account checkpoint doesn't kill the integration.

### Gaps
- Meta's commerce policies for book-sale posts weren't researched (prices, "DM to order" wording, restricted categories).
- Religious-content considerations (Islamic books: any distribution or ads sensitivities, Arabic content-moderation false positives) weren't researched. No sources found in this pass.
- No source quantifies the reach difference between API-published and natively published posts. Older folklore says API posts get less reach, but no 2025–2026 evidence was found.
- Instagram-specific originality ranking changes (2024–2025) weren't fetched.

## Q5. Reliability on Render: will in-process cron fire? Render Cron Jobs vs GitHub Actions vs external cron; idempotency

### Takeaway
A **free** Render web service spins down after 15 minutes without inbound traffic, so `@nestjs/schedule` in it won't fire reliably. A paid always-on instance (Starter or above) or a Render **Cron Job** ($1/month minimum, UTC schedules, at most one active run) is reliable. GitHub Actions `schedule` can be delayed or even dropped, and is disabled after 60 days of inactivity in public repos. Make every run idempotent with DB state, a DB lock, and a "check before re-publish" step.

### Cited Findings
- **Render free tier**:
  - A free web service spins down after **15 min with no inbound traffic** and takes about 1 min to spin back up.
  - There are 750 free instance hours per workspace per month. If they run out, all free web services are suspended until next month.
  - Free services can be restarted at any time, the filesystem is ephemeral, and one-off jobs aren't supported.
  - **Outbound SMTP ports 25/465/587 are blocked** (no SMTP email alerts from a free service).
  - Render may suspend services with unusually high outbound traffic. — [Render: Free instances](https://render.com/docs/free)
- **Render Cron Jobs**:
  - Billed per second of run time by compute plan, **minimum $1 per cron job service per month**.
  - Standard cron syntax, and "All day and time ranges use UTC".
  - A run is killed after 12 h.
  - **At most one active run per cron job**: a scheduled run waits for the active one, while a manual trigger cancels the active run.
  - The docs don't describe missed-run or retry behaviour. — [Render: Cron Jobs](https://render.com/docs/cronjobs)
- **GitHub Actions `schedule`**:
  - Runs "can be delayed during periods of high loads". Under enough load, some queued jobs **may be dropped**. The start of every hour is a high-load time, so avoid `:00`.
  - Minimum interval is 5 min. UTC by default (an IANA timezone can be set).
  - Workflows run only from the default branch.
  - In **public repos, scheduled workflows are disabled after 60 days of no repo activity**. — [GitHub Docs: Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Field report of a non-idempotent retry loop creating 12 IG duplicates after a misleading 403. — [dev.to](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2)

### Inferences
- Options, from most to least robust for this stack:
  - **(a)** If the API service is already on a paid always-on Render plan, `@nestjs/schedule` inside it is fine, but only with a DB-backed lock (e.g. a Postgres advisory lock or a `SELECT … FOR UPDATE SKIP LOCKED` row claim) in case of multiple instances or overlapping restarts.
  - **(b)** A Render Cron Job running a small Node script (sharing the Prisma client), every 5–15 min, picking due posts. Its cost is close to $1/month at short run times.
  - **(c)** An external trigger (cron-job.org, GitHub Actions) that calls an authenticated `POST /api/v1/admin/social/tick` endpoint. On a free service the first request wakes it (~1 min), so use a long HTTP timeout or "fire, then poll". GitHub Actions delays of minutes are acceptable for social posting, but dropped runs mean the tick must catch up on everything overdue, not only "now".
- Design each tick to be catch-up safe: "publish every APPROVED item whose `scheduledAt <= now` and `state` is not PUBLISHED or IN_FLIGHT". Do this rather than "publish the item for 14:00".
- Idempotency recipe:
  - Give each item a unique `(postId, platform)` row with states QUEUED → CONTAINER_CREATED (store `ig_container_id`) → PUBLISHING → PUBLISHED (store remote id) or FAILED/PAUSED.
  - Claim the row atomically before calling Meta.
  - After a timeout or ambiguous 4xx/5xx, reconcile before retrying. For IG, `GET container?fields=status_code`: PUBLISHED means done. Or list `/{ig-id}/media?fields=id,timestamp,caption` and match the caption or timestamp. For FB, list recent `/{page-id}/posts` and match.
- Pushing FB posts into Meta's own scheduler (Q1) removes the FB side's dependence on Render uptime. IG still needs the tick.

### Gaps
- Render Starter pricing and always-on behaviour weren't fetched in this pass (it's widely known that paid instances don't spin down, but this wasn't verified here).
- cron-job.org's reliability, limits and timeouts weren't researched.
- Render's handling of missed cron runs (e.g. during an outage) isn't documented.

## Q6. Hands-off operations: retries, error classification, auto-pause, alerting, heartbeat monitoring, token expiry, queue buffer

### Takeaway
Classify Meta errors into four buckets:
- **transient**: retry with backoff
- **throttled**: stop until `estimated_time_to_regain_access`
- **content-permanent**: skip the item and notify
- **account-level**: auto-pause the whole channel and alert

Pair that with a dead-man's-switch heartbeat (Healthchecks.io's free tier covers 20 checks), HTTP-based owner alerts (SMTP is blocked on Render free), token-health checks, and a buffer of pre-approved posts several weeks deep.

### Cited Findings
- **Transient per Meta**:
  - 1 and 2 (temporary downtime, wait and retry)
  - 4, 17 and 341 (throttling, wait and retry)
  - IG 2207001 (server error), 2207003 (download timeout), 2207032 (container creation failed)
  - 2207008 (retry 1–2× at 30 s–2 min, then create a new container)
  - 2207027/9007 (wait until FINISHED) — [Graph API Error Handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/); [IG Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes)
- **Throttling**: codes 4, 17, 32, 613, 80001 (Pages), 80002 (IG). Stop calling once limited, because continuing extends the block. Read `estimated_time_to_regain_access` from `X-Business-Use-Case-Usage`. — [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- **Permanent / needs human**:
  - 10 and 200–299 (permissions)
  - 102, 190, and subcodes 458/460/463/467 (token)
  - 459/464 (checkpoint or unconfirmed: log in on the web)
  - 492 (token user lost the Page role)
  - 506 (duplicate)
  - IG 2207004, 2207009, 36000, 36001, 36003, 36004 (bad media or caption)
  - 2207042 (daily limit: next day)
  - 2207050 (checkpoint or restricted)
  - 2207051 (possible spam) — [Graph API Error Handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/); [IG Error Codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes)
- **Code 368**: Meta's table says "wait and retry", but it means "temporarily blocked for policy violations". — [Graph API Error Handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/)
- Error payloads can carry `is_transient` (seen as `false` on a 2207051 spam block). Don't trust the top-level `code` alone (code 4 was paired with a spam subcode). — [dev.to](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2)
- **Healthchecks.io**: a dead-man's switch. The job pings `https://hc-ping.com/<uuid>`, with optional `/start`, `/fail` or `/<exitcode>`. Simple period+grace mode, or cron-expression mode (late at the scheduled time, Down after grace). Integrations include email, webhooks, SMS, Slack, PagerDuty and more. Treat ping URLs as secrets. — [Healthchecks.io docs](https://healthchecks.io/docs/). Free "Hobbyist" plan: **20 checks**, 100 log entries per check. SMS/WhatsApp credits only on paid plans (50 Business / 500 Business Plus). — [Healthchecks.io pricing](https://healthchecks.io/pricing/)
- **Token lifetimes**:
  - System-user tokens come as expiring (valid **60 days** from generation or refresh; refresh, then revoke the old one) or non-expiring. — [Meta: System users, generate/refresh/revoke tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)
  - Page tokens derived from a long-lived user token show "Expires: Never" in the Token Debugger, but die on a password change (third-party guides). — [bundle.social](https://bundle.social/blog/facebook-page-access-token)
- Render free blocks outbound SMTP, so alerts must go over HTTPS APIs (e.g. a Telegram bot, an email API like Resend/Postmark over HTTPS, or a Healthchecks integration). — [Render: Free instances](https://render.com/docs/free)

### Inferences
- **Retry policy**:
  - Transient errors: exponential backoff with jitter (e.g. 1 min → 5 → 15 → 60), max about 4 attempts per item per day. Then mark the item FAILED_TRANSIENT and retry next tick or day.
  - Throttle codes: no per-item retry. Set a channel-level `pausedUntil = now + estimated_time_to_regain_access` (default 1 h if the header is missing).
  - Always reconcile (check whether it already published) before any retry of `media_publish` or FB create.
- **Auto-pause rules**:
  - Pause the channel immediately on 190/102/458–467/492, 10/200–299, 368, 459, 2207050, 2207051, and alert the owner with the exact message. Never auto-retry these.
  - On 2207042: pause until `content_publishing_limit` shows quota available.
  - Circuit breaker: pause after N (e.g. 3) consecutive failures of any kind on a channel.
  - Per-item permanent media errors (2207009/36003/2207004/36000/36004/324): skip the item, flag it in the admin UI, and continue with the next one, so the queue keeps moving.
- **Alerting**: a Telegram Bot API `sendMessage` call is the simplest free, HTTPS-only channel for one owner, and it works in Algeria. WhatsApp Cloud API alerts outside a 24 h customer window need a pre-approved template (general knowledge, not verified here).
  - Send alerts on: channel paused, item skipped, token expiring within 14 days, queue below N days, heartbeat missed.
  - Add a daily or weekly digest ("posted 14, queue 23 days, next pause risk: none").
- **Heartbeat**: ping Healthchecks at the end of every tick (`/start` at the beginning, `/fail` on unhandled exceptions). Also add a second check pinged only on a successful publish, with a period of about 26–50 h, to catch "the job runs but nothing gets posted".
- **Token health**:
  - Run a daily `GET /debug_token` (or a cheap `GET /me?fields=id` with the Page token) and record `expires_at` / `data_access_expires_at`. Warn the owner 14 and 3 days ahead. Prefer a non-expiring system-user token.
  - For IG-Login tokens (60-day long-lived, refreshable), refresh automatically well before expiry. (Exact IG-Login refresh semantics weren't fetched in this pass.)
- **Queue buffer and auto-approval**: keep a queue of APPROVED posts at least 2–4 weeks deep (at 1–3/day that's about 30–80 items). Auto-generate candidates from books that:
  - have a real cover,
  - are in stock,
  - weren't posted in the last X months,
  - have a non-empty Arabic description.
  - The owner bulk-approves weekly. An optional "auto-approve if not rejected within 48 h" rule keeps the job running for weeks unattended.
  - When the queue empties, alert rather than posting unreviewed content.
  - Pre-flight every item: image URL returns 200 with image/jpeg; IG derivative is 4:5 and ≤8 MB; caption ≤2200 chars and ≤30 (recommended ≤5) hashtags; ASCII URL.
- Admin "kill switch": a single DB flag `socialAutopostEnabled` (per channel) that the owner can toggle from the admin or mobile app, plus a visible "paused because: …" banner.

### Gaps
- Healthchecks.io's Telegram/WhatsApp integration availability on the free plan wasn't confirmed on the fetched pages.
- Telegram Bot API and WhatsApp Cloud API template or pricing rules weren't researched in this pass.
- Exact `debug_token` fields and IG-Login token refresh rules (`/refresh_access_token`, 60-day window) weren't fetched. Verify before implementing.
- Meta docs don't publish a canonical "transient vs permanent" list. The classification above is inferred from each code's recommended action.

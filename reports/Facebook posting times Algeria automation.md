# Post evenings, buffer weeks, page humans rarely

No study measures when Algerians are online by the hour, and Meta no longer gives that data to automation tools. Start مكتبة البيان on a schedule weighted towards the evening: **one Facebook post a day at about 20:30 Algeria time (UTC+1), with Instagram 30–60 minutes later**. Move to an after-Taraweeh pattern in Ramadan and to evening-only posting on Bac exam days. Then let the Page's own per-post reach move the slots over 4–8 weeks. The global "best time" studies contradict each other by up to 15 hours. They agree on only one thing: test against your own analytics. They are also built on a Saturday–Sunday weekend that Algeria does not have. Getting the automation right matters more than getting the hour right. Facebook reaches **27.5M Algerians, about 9 in 10 adults**, against 13.5M on Instagram. Meta's feed now ranks on predicted engagement, not recency, and about a third of feed views come from accounts users don't follow. Truly hands-off running needs eight things. The credential must be a Business Manager **system-user token** that never expires, not one tied to the owner's personal login. Instagram must go through Facebook Login, not Instagram Login. The app must be **Live** on Standard Access. Each cover needs a 4:5 version for Instagram. The trigger must survive Render's free tier, which sleeps after 15 minutes; **the API runs on that tier today** (`render.yaml: plan: free`). Facebook posts should be loaded into Meta's own scheduler days ahead. Account-level errors should pause the channel automatically. And there should be a buffer of 2–4 weeks of approved posts. Once that is built, the owner gets an alert only for a short list of rare events: the annual Data Use Checkup, a security checkpoint, a spam or policy flag, or someone changing Page or Instagram ownership. Every one of them waits safely until after a 7am–7pm workday.

## Global studies disagree by 15 hours, so Algeria starts from a hypothesis

The large vendor studies cannot agree on a Facebook hour, even in the audience's own local time:

- **Hootsuite**: Tuesday 5 am is the top slot, with activity peaking at 5–8 am ([Hootsuite](https://blog.hootsuite.com/best-time-to-post-on-facebook/)).
- **Buffer**: Thursday 9 am is best, and 12–5 pm is the *worst* window on most days. Buffer analysed 14M+ posts ([Buffer](https://buffer.com/resources/best-time-to-post-on-facebook/)).
- **Sprout Social**: Tuesday and Wednesday 12–8 pm is best, the window Buffer calls worst. Sprout used about 2 billion engagements across 307,000 profiles from Nov 2025 to Feb 2026 ([Sprout Social](https://sproutsocial.com/insights/best-times-to-post-on-facebook/)).

Instagram is just as split. Later finds 3–6 am best, from 2024 data ([Later](https://later.com/blog/best-time-to-post-on-instagram/)), while Metricool puts the peak at about 8 pm ([Metricool](https://metricool.com/best-time-to-post-instagram/)). The disagreement partly reflects what each study measures: median engagement per post, total engagement volume, or engagement rate. An early-morning "win" can simply mean less competition. The only consistent signals are that Monday–Thursday beats the weekend and that every vendor says to test against your own data. Hootsuite calls its tables "a starting point" ([Hootsuite](https://blog.hootsuite.com/best-time-to-post-on-facebook/)), and Later says to take its times "with a grain of salt" ([Later](https://later.com/blog/best-time-to-post-on-instagram/)). The "weekend is worst" finding comes from Saturday–Sunday audiences. In Algeria, Sunday is a working day.

The industry splits closest to a bookstore come out similar to each other. Sprout's Retail and Education windows for Facebook overlap at roughly **10 am–1 pm on weekdays**, and Hootsuite's Retail category adds a 5–6 pm slot ([Sprout Social](https://sproutsocial.com/insights/best-times-to-post-on-facebook/); [Hootsuite](https://blog.hootsuite.com/best-time-to-post-on-facebook/)). No vendor publishes a books, publishing or religious category. Regional evidence is thin and old. A 2013 study of nine Arab countries, which did not include Algeria, found peaks ranging from 11 am in Bahrain to 10 pm in Saudi Arabia, and about 30% more usage in Ramadan ([Wamda](https://wamda.com/2013/07/how-the-arab-world-uses-facebook-and-twitter-during-ramadan)). French-language scheduling guides point mobile audiences to 20:00–23:00 ([Swello](https://swello.com/fr/blog/quand-poster-sur-facebook/)). No Algeria-specific hourly dataset from 2024–2026 was found, from Meta, Kepios, NapoleonCat or any local agency.

Meta's own documentation weakens the idea of an exact hour. Its Facebook Feed ranking explainer, updated 6 October 2026, lists past interactions, comments, time spent, shares, saves and content type as signals. It **does not list post age** ([Meta Transparency Center](https://transparency.meta.com/features/explaining-ranking/fb-feed/)). In the US, **35.7% of feed views** in Q1 2025 came from recommended posts by accounts the viewer doesn't follow ([Meta Widely Viewed Content Report](https://transparency.meta.com/data/widely-viewed-content-report)). Timing still matters indirectly, because early engagement from followers who are online feeds the predicted-engagement models. For a small Page, though, content quality and shareability outweigh the minute of posting.

On platform choice, Facebook is the reach channel. It has 27.5M ad-reachable users (57.7% of the population, 88.7% of adults, 58.4% male). Instagram has 13.5M, is closer to gender-balanced (47.5% female) and is growing faster (+16.9% a year) ([DataReportal](https://datareportal.com/reports/digital-2026-algeria)). Both are worth posting to, as separately tuned channels rather than one mirrored post.

On frequency, daily posting sits safely inside every recommendation:

- **Facebook**: Sprout suggests one to two posts a day ([Sprout Social](https://sproutsocial.com/insights/best-times-to-post-on-facebook/)), and Buffer says once a day ([Buffer](https://buffer.com/resources/how-often-post-social-media/)).
- **Instagram**: Buffer studied 2.1M posts, comparing each account with itself. Reach per post *rose* with frequency: **+18% at 6–9 posts a week** versus 1–2 a week, with diminishing returns but no decline ([Buffer](https://buffer.com/resources/how-often-to-post-on-instagram/)).

Single static photos are the weakest Facebook format in 2026 benchmarks. Reels lead on engagement and albums lead on shares ([Socialinsider](https://www.socialinsider.io/social-media-benchmarks/facebook)), while photos still make up about 62% of brand posts ([Emplifi](https://emplifi.io/resources/q2-2026-ecommerce-worldwide-benchmarks/)). Daily cover posts are a sound baseline. An occasional album (front cover, back cover, contents page) is the obvious upgrade.

## Algeria's calendar moves the week, the evening and the year

The working week is Sunday–Thursday and the weekend is **Friday–Saturday**, nationwide since 14 August 2009 ([Algérie360](https://www.algerie360.com/lalgerie-se-met-au-week-end-semi-universel/)). Public administrations work about **08:00–12:00 and 13:00–16:30** ([Algérie-Eco](https://algerie-eco.com/tag/horaire-de-travail/)), and summer timetables in some wilayas run from mid-June to 30 September ([Algérie360](https://www.algerie360.com/administrations-publiques-les-horaires-dete-entrent-en-vigueur-ce-dimanche-14-juin/)). Any "weekday" logic in the scheduler must mean Sunday–Thursday.

The prayer-time ranges below are estimates from solar position, not sourced figures. Check them against the Ministry of Religious Affairs timetable before relying on them:

- **Jumu'ah**: Algiers sits at about 3°E on UTC+1, so Jumu'ah falls around 12:40–13:05. With the khutba and travel, roughly **12:00–14:30 on Fridays** should be off-limits.
- **Maghrib**: about 17:30 in December and about 20:15 in late June. The after-dinner evening window therefore moves by about an hour with the seasons, which is why the schedule below has a summer profile.

Ramadan rearranges the day. Meta's MENA head reported about **5% more time on Meta's apps** during Ramadan, roughly 2M extra hours a day across the Middle East. He attributed it to later nights and shorter working days ([Arab News/AP](https://www.arabnews.com/media/in-mideast-fasting-and-facebook-go-together-data-shows-1503366)). Gulf-centred commentary describes peaks just before iftar and from after iftar to midnight, plus a suhoor peak between midnight and 4 am. Users also lean towards consuming content rather than creating it ([Arab News](https://www.arabnews.com/node/2285301/media)). **Ramadan 2027 is projected to begin Monday 8 February, with Eid al-Fitr on 9 or 10 March** ([Gulf News](https://gulfnews.com/uae/when-will-ramadan-2027-begin-uae-astronomers-share-latest-moon-sighting-forecasts-1.500705567); [The National](https://www.thenationalnews.com/news/uae/2026/09/02/expected-ramadan-2027-start-date-and-eid-al-fitr-holiday-dates-in-uae/)). Other projected dates, all subject to moon sighting:

- Eid al-Adha: 16 or 17 May 2027
- Islamic New Year 1449: about 6 June 2027 ([Khaleej Times](https://www.khaleejtimes.com/uae/ramadan-eid-al-fitr-eid-al-adha-2027-likely-dates))
- Mawlid: 14 or 15 August 2027 ([TrueCalendar](https://truecalendar.com/hijri/1449))

Because of this uncertainty, every religious date in the config should cover both candidate days. For an Islamic bookstore, Ramadan is the commercial peak for Qur'an editions, tafsir and books on the fiqh of fasting. It is also the one period where two posts a day are clearly justified.

The book seasons are concrete:

- **SILA 2026** (29th edition): 28 October – 7 November 2026, Palais des Expositions des Pins Maritimes, with 1,567 publishers from 51 countries ([APS](https://www.aps.dz/es/cultura/edicion/mvfh6kac-la-29-%C2%AA-edicion-del-sila-se-celebrara-del-28-de-octubre-al-7-de-noviembre); [TSA Algérie](https://www.tsa-algerie.com/sila-2026-benjamin-stora-yasmina-khadra-john-kaiser-et-plus-de-200-ecrivains-attendus/)). The autumn school holidays (27 October – 2 November 2026) overlapped it.
- **Rentrée 2026**: pupils returned on **21 September 2026**, after a presidential postponement from 6 September ([TSA Algérie](https://www.tsa-algerie.com/algerie-la-rentree-scolaire-reportee-sur-instruction-de-tebboune/)).
- **School holidays 2026–27**: winter 17 December – 3 January, spring 18 March – 4 April 2027 ([TSA Algérie](https://www.tsa-algerie.com/algerie-le-calendrier-des-examens-et-des-vacances-scolaires-devoile/)).

The baccalaureate is a separate problem. For years Algeria cut the internet nationwide for the whole Bac week. In **June 2025 Facebook and TikTok were specifically blocked** on exam mornings, with partial cuts ([TSA Algérie](https://www.tsa-algerie.com/bac-2025-en-algerie-pas-de-blocage-total-dinternet-une-premiere/)). In **June 2026 there was no general cut**, only cuts at and around exam centres ([TSA Algérie](https://www.tsa-algerie.com/bac-2026-lalgerie-met-fin-aux-coupures-generalisees-dinternet/)).

The server runs on Render, outside Algeria, so a block does not make the API call fail. The post publishes into an audience that cannot see it, misses its early engagement, and is wasted. The Bac 2027 date is unconfirmed. The ministry calendar lists a terminal-year evaluation for 9–13 May 2027 without calling it the Bac ([TSA Algérie](https://www.tsa-algerie.com/algerie-le-calendrier-des-examens-et-des-vacances-scolaires-devoile/)), and the exam has traditionally been held in June. The blackout must therefore be a date list in config, not a hard-coded rule. Its default should still protect against a reversal to 2025-style blocking.

## The Page's own numbers should overrule the default within two months

Meta removed the API metric that told tools when a Page's fans were online. `page_fans_online` was deprecated for all versions on **16 September 2024** and appears again on the November 2025 deprecation list ([Meta Pages API changelog](https://developers.facebook.com/documentation/pages-api/changelog); [Meta developer blog](https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/)). Metricool confirms that newly connected Pages now get generic best times instead of Page-specific ones ([Metricool](https://metricool.com/de/beste-zeit-fuer-facebook-posts/)). The server cannot download an audience heatmap. It has to run its own experiment.

That experiment is simple and can be fully automated. Each week, five of the seven Facebook posts go to the current best slot and two go to test slots, rotating through 08:30, 12:15, 17:30 and 22:30. Each night, the server pulls per-post reach and engagement through the post-level insights the API still offers. It buckets the results by local hour and by Sun–Thu, Friday or Saturday. After 4–8 weeks, it moves the main slot to the bucket with the best **median** reach. Medians matter because small Pages produce noisy per-post numbers.

Run the same loop separately for Instagram, whose younger and more female audience may peak at a different hour. Keep separate profiles for normal weeks, summer and Ramadan, because Ramadan data must not pollute the normal profile. Re-run the analysis each quarter.

The owner can glance at the "most active times" heatmap in Meta Business Suite (Insights → Audience) as a cross-check. It covers the past 28 days and only becomes reliable once the Page has a few hundred followers ([Brandwatch](https://www.brandwatch.com/blog/best-times-to-post-on-facebook/); [Shopify](https://www.shopify.com/blog/time-post-instagram)). Instagram shows these times in the *device's* time zone ([Shopify](https://www.shopify.com/blog/time-post-instagram)), so the phone must be set to Algeria time. No official Meta help page confirming the 2026 menu labels was found.

## Credentials and app settings cause most of the manual work

The most durable credential is a **regular system user** in the owner's Business Manager portfolio. The setup has four parts:

1. A **business-type app** owned by the same portfolio, installed on the system user.
2. The Page and the Instagram account **explicitly assigned** to the system user.
3. A token generated with the **"Never expires"** option ([Meta: System Users](https://developers.facebook.com/docs/marketing-api/system-users/overview); [Meta: Generate tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)).
4. At runtime, the server derives the Page token from `/{page-id}?fields=access_token`.

The alternative is a Page token derived from the owner's personal 60-day user token. It also shows "never expires", but it dies when the owner's personal account trips:

| Subcode | What happened |
|---|---|
| **460** | Password change |
| **458** | App removed |
| **459** | Security checkpoint |
| **492** | Lost Page role |

Each of these forces a manual re-login ([Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging); [Meta: Error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling)). Meta does not notify an app when a token dies; it learns on the next failed call ([Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)).

There is one catch. Meta states that "all integrations should adopt expiring tokens", and some businesses are *forced* onto 60-day system-user tokens ([Meta: Generate tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)). The server must therefore store the token in the database, not in a Render environment variable, and be able to refresh it with `fb_exchange_token` every ~30 days. Meta keeps the old token valid until its own expiry, so a refresh causes no downtime. The notes do not settle two points: whether a human admin's password change can ever touch a system-user token, and which businesses Meta forces onto expiring tokens.

For Instagram, use **Instagram API with Facebook Login** on `graph.facebook.com`, with the same system-user or Page token and the `instagram_basic` and `instagram_content_publish` permissions. Do not use the newer Instagram Login. Its long-lived token lasts **60 days** and must be refreshed after it is 24 hours old and before it expires, forever ([Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview); [Meta: refresh_access_token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token)). A single missed refresh window, from an outage or a cron bug, forces the owner to log in again.

For app access, posting to the business's own assets needs only **Standard Access**. Advanced Access, App Review and Business Verification are for serving people with no role on the app ([Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)). The app must not stay in Development mode: **posts from a dev-mode app are visible only to people with a role on the app** ([Meta: App Modes](https://developers.facebook.com/docs/development/build-and-test/app-modes)). Day one must include checking that a post is visible from a logged-out browser. One gap remains. No 2025–2026 Meta document explicitly confirms that a Live, Standard-only business app can post publicly without App Review. This is widely reported practice, but not verified here.

The **Data Use Checkup** is the main scheduled risk. It is annual. If it is missed, the app is **deactivated with no extensions**, and reactivation requires App Review. Meta warns by email and in the App Dashboard about **60, 30, 10 and 3 days** before the deadline ([Meta: DUC FAQ](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup/faq)). Meta's wording conflicts on whether a Live, Standard-only app with a use case must complete it. One page says it is "not required" for Standard Access ([Meta: Data Use Checkup](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup)), while the FAQ covers Live apps "published with a use case". Plan for a 15-minute task once a year, and make sure the developer email goes to an inbox someone actually reads.

Graph API versions are released two to three times a year. Each works for at least two years and expires two years after the *next* version ships. Calls to an expired version are silently routed to the oldest still-supported version ([Meta: Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning)). Some planning dates:

| Version | Expires |
|---|---|
| **v25.0** | **29 July 2028** |
| v21.0 | 21 January 2027 |
| v22.0 | 20 May 2027 |

Expiry dates come from Meta's changelog ([Meta: changelog](https://developers.facebook.com/docs/graph-api/changelog/versions/?locale=ko_KR)). v27.0 shipped on 4 November 2026 ([PPC Land](https://ppc.land/metas-api-v27-may-add-catalog-products-to-new-ads-by-default/)). Pin `v25.0` or newer in one config constant and bump it once a year. That is an integrator task, not an owner task. Platform-wide changes can bypass version pinning, so the success heartbeat described below is the real safety net.

Two silent blockers deserve a one-time check. Instagram publishing fails until **Page Publishing Authorization** is completed on Pages that require it, and it can fail without a specific error code if two-factor requirements aren't met ([Meta: Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)).

## Images, spam signals and Render's free tier are where unattended posting breaks

Instagram is strict about images:

- JPEG only, at most **8 MB**
- Aspect ratio **between 4:5 and 1.91:1**, 320–1440 px wide
- sRGB colour
- A public URL made of US-ASCII characters only ([Meta: IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media))

The current pipeline (`common/utils/cover-image.ts`) resizes covers to fit inside 2000 px while keeping their shape. A typical book cover is about 2:3 (0.667), which is narrower than Instagram's 4:5 minimum (0.8). Raw covers will therefore fail with error 2207009 or 36003. The fix is an Instagram-specific version: pad each cover onto a **1080×1350 branded frame**. Facebook's `/photos` endpoint accepts files up to 4 MB in common formats ([Meta: Page photos](https://developers.facebook.com/docs/graph-api/reference/page/photos/)), so the 2000 px master works there unchanged.

Instagram publishing has no native scheduling. A media container expires if it isn't published within **24 hours**, so the server must be awake at publish time. Read the daily quota at runtime from `content_publishing_limit`, because Meta's own pages say 50 in one place and 100 in another ([Meta: Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)).

Serve these images from an **R2 custom domain, never `r2.dev`**, which Cloudflare rate-limits and intends only for development ([Cloudflare](https://developers.cloudflare.com/r2/buckets/public-buckets/)). Exempt that hostname from Bot Fight Mode and hotlink rules, which can block Meta's `facebookexternalhit` crawler ([Ayrshare](https://www.ayrshare.com/docs/help-center/technical-support/meta_media_crawler_blocked)). Before each publish, a server-side check should confirm a 200 response with `image/jpeg` and an acceptable size. That turns an opaque error 9004 into a clear "fix the image" item.

Automation itself is not against the rules. Meta's spam policy targets posting at "very high frequencies" whether manual or automatic, and also "repetitive content" at lower frequencies ([Meta: Spam policy](https://transparency.meta.com/policies/community-standards/spam/)). Since July 2025, accounts that repeatedly reuse others' photos without meaningful additions get **reduced distribution on everything they share**. Meta's guidance from that announcement: captions without links, minimal capital letters and **no more than five hashtags** performed best ([Facebook Creators blog](https://creators.facebook.com/blog/combating-unoriginal-content)).

Publisher cover art is posted by every seller of the same book, which is the store's main originality risk. Four habits address it:

- Use the branded frame, adding price or availability and the store's own shelf photo when one exists.
- Rotate several Arabic caption templates and add a book-specific description.
- Never repeat a book within months.
- Keep links out of most posts.

Links matter for a second reason. In December 2025 Meta confirmed a test limiting some Pages to about **two organic link posts a month** without Meta Verified ([TechCrunch](https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages)). Bursting is dangerous too. A developer reported that 13 Instagram posts in one hour triggered a non-transient spam block (2207051). The same developer saw a 403 response on posts that had actually gone live, so blind retries created **12 duplicates** ([dev.to](https://dev.to/justjinoit/instagram-graph-api-lies-to-you-3-things-that-broke-my-automation-12n2)).

Hosting is the most immediate gap. A free Render web service **spins down after 15 minutes without inbound traffic** and blocks outbound SMTP ports 25, 465 and 587 ([Render: Free instances](https://render.com/docs/free)). An in-process `@nestjs/schedule` cron on today's `bookstore-api` would not fire reliably, and email alerts over SMTP would not send. The options are:

- **Render Cron Job**: billed by run time with a **$1 minimum per month**. Schedules are in UTC, and only one run is active at a time ([Render: Cron Jobs](https://render.com/docs/cronjobs)).
- **Paid always-on instance**: the in-process scheduler then works. Pricing was not verified here.
- **External trigger**: GitHub Actions or cron-job.org calling an authenticated tick endpoint. GitHub's scheduled runs can be delayed or even dropped under load, and are disabled after 60 days without activity in public repos ([GitHub Docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).

The recommended combination has two layers:

1. **A Render Cron Job runs a "tick" every 10 minutes.** It uses the existing Prisma client and publishes every approved item whose due time has passed and that hasn't been published, so missed runs catch up automatically. Algeria has no daylight saving time, so UTC is always Algeria time minus one hour.
2. **Each night, Facebook posts for the next 7–14 days go into Meta's own scheduler** with `published=false` and a `scheduled_publish_time`, which can be 10 minutes to 30 days ahead ([Meta: Pages API Posts](https://developers.facebook.com/docs/pages-api/posts/)). Facebook then publishes even if Render is down.

Every item moves through stored states: queued → container created → publishing → published or paused. The server claims each row atomically and reconciles before any retry. That means reading the container's `status_code` or listing recent media, and treating "already published" as success.

Error handling follows four classes. Meta's error codes ([Meta: Error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling/); [Meta: IG error codes](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes); [Meta: Rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)) map onto them like this:

| Class | Codes | Server action |
|---|---|---|
| Transient | 1, 2, 2207001, 2207003, 2207032, 2207008, 2207027/9007 | Reconcile, then retry with backoff (1 → 5 → 15 → 60 min, max 4/day) |
| Throttled | 4, 17, 32, 341, 613, 80001, 80002, 2207042 | Stop all calls on the channel until `estimated_time_to_regain_access` or quota resets |
| Bad item | 324, 2207004, 2207009, 36000, 36001, 36003, 36004, 9004, 506 | Skip the item, flag it in admin, move to the next book |
| Account-level | 190, 102, 458–467, 492, 10, 200–299, **368, 459, 2207050, 2207051** | **Auto-pause the channel**, never retry, alert with the exact fix |

Alerts must use HTTPS, because the free tier blocks SMTP. Options include a Telegram bot, an HTTPS email API, or a Healthchecks.io integration. Healthchecks.io's free plan covers **20 checks** ([Healthchecks.io pricing](https://healthchecks.io/pricing/)). Two checks are needed: one pinged by every tick (10-minute period, 30-minute grace) and one pinged only after a successful publish (about 26–50 hours). The second catches "runs, but posts nothing", including silent API changes and a deactivated app.

A daily `debug_token` call checks `is_valid`, `expires_at` and the granted scopes ([Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)). A rolling queue holds 2–4 weeks of approved posts. Candidates are generated automatically from books that have a real cover, are in stock, have an Arabic description, and haven't been posted recently. A candidate is **auto-approved unless the owner rejects it within 48 hours**.

Two design choices keep the owner's evenings free. Non-urgent messages (item skipped, queue below 10 days, weekly results) arrive as one digest at about 19:30 Algeria time. Because Facebook already has a week of posts scheduled on Meta's side and a paused channel keeps its state, even an "urgent" pause can safely wait until after work.

## Recommended default schedule, in Algeria time (UTC+1)

**Normal weeks.** Use the winter profile from October to mid-June. Use the summer profile from mid-June to 30 September, when every evening slot moves 60 minutes later. Each week, two of the five Sunday–Thursday Facebook posts move to a test slot (08:30, 12:15, 17:30 or 22:30) so the Page learns its own best hour.

| Day | Facebook | Instagram | Never post |
|---|---|---|---|
| Sunday–Wednesday | 20:30 (summer 21:30) | 21:15 (summer 22:15) | 00:30–07:00 |
| Thursday (weekend eve) | 20:30 (summer 21:30) | 21:15 (summer 22:15) | 00:30–07:00 |
| Friday | 20:30 (test alternative: 10:00) | 21:15 | **12:00–14:30 (Jumu'ah)** |
| Saturday | 11:00 (weekend reading) | 20:30 | 00:30–07:00 |
| Frequency | 7 a week; **14 a week in peak seasons** (add 12:15) | 7 a week | — |

The peak seasons are:

- Rentrée: 25 August to the pupils' return date (21 September in 2026)
- SILA: two weeks before opening through closing day
- Winter school holidays: 17 December – 3 January
- Ramadan
- The first ten days of Dhul-Hijjah: about 7–16 May 2027

**Ramadan profile** (projected 8 February – 9 March 2027). Iftar in Algiers is about 18:10–18:40; this is an estimate to check against the official timetable.

| Slot | Facebook | Instagram | Content |
|---|---|---|---|
| Pre-iftar | 17:00 | — | Short, light post: a verse, a Ramadan reading pick |
| Main | **22:00** (after Taraweeh) | 22:30 | Qur'an editions, tafsir, fiqh of fasting, gift sets |
| Suhoor test | 00:30, once a week | 00:45, once a week | Spiritual titles |
| Blackout | 18:00–20:30 daily | 18:00–20:30 | Iftar, Maghrib, Isha and Taraweeh |
| Last ten nights (about 28 Feb – 9 Mar) | Same times | Same | Spiritual books, Laylat al-Qadr themes |
| Eid al-Fitr (9–10 March) | Greeting only, **10:00 on 10 March** (Eid whichever day it falls) | Same | No selling until 20:30 on 11 March |

Eid al-Adha follows the same rule: a greeting only, at 10:00 on 17 May 2027, with selling resuming the next evening.

**Bac and BEM blackout.** The dates sit in config: candidates are 9–13 May 2027 per the ministry calendar, or June by custom.

| Exam day window | Rule |
|---|---|
| 00:00–18:00 | **No posts on either platform**; pull any Facebook post scheduled in this window back from Meta's scheduler |
| 21:00 Facebook, 21:30 Instagram | One post: revision books or encouragement, no hard selling |
| Owner toggle (optional) | "Full pause" if a nationwide Facebook block is announced; resumes by itself the day after the last exam |

## What the owner does once, what the server does forever, and what still needs a human

**One-time setup the owner must do personally.** These steps use the owner's own Meta identity. An integrator can sit beside them, but should never be handed the password.

| # | Step | Why it can't be automated |
|---|---|---|
| 1 | Make sure a Business portfolio owns the Page; switch Instagram to a **Professional (Business)** account and link it to the Page | Ownership and identity actions |
| 2 | Turn on two-factor authentication on the owner's Facebook account and finish any Page Publishing Authorization or verification prompts | Missing 2FA or PPA blocks publishing silently |
| 3 | Add the integrator as a **second admin** on the Business portfolio | Removes the single point of failure for the DUC and lost-admin cases |
| 4 | Create, or approve, the business-type app owned by the portfolio; fill in privacy policy URL, icon and category; switch it to **Live** (Standard Access only) | Developer-account owner action |
| 5 | Create a regular system user, assign the Page and Instagram account with full control, install the app, generate a **never-expiring** token with `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management` | Business Settings action; paste the token once into the admin's social settings screen, which stores it encrypted in the database |
| 6 | Make sure the Meta developer email goes to an inbox that is actually read | DUC warnings arrive there |
| 7 | Tap "Start" on the alert bot (Telegram or similar) | Recipient opt-in |
| 8 | Approve the first 2–4 weeks of queue, caption templates and the branded frame; check the first post from a logged-out phone | Confirms the app is truly Live |

**Handled automatically by the server, with no owner action.** The integrator builds and maintains these:

| Area | What the server does |
|---|---|
| Scheduling | Computes slots in Africa/Algiers from the active profile (normal, summer, Ramadan, Bac); runs the Render Cron tick every 10 minutes; pushes Facebook posts 7–14 days ahead into Meta's scheduler |
| Content | Generates candidates, auto-approves after 48 hours, rotates caption templates, keeps to five hashtags or fewer, keeps links out of most posts, never repeats a book within months |
| Images | Builds the 4:5, 1080×1350 Instagram version; serves it from the R2 custom domain with an ASCII key; checks status, type and size before publishing |
| Instagram flow | Creates the container minutes before the slot, polls until FINISHED, publishes, reconciles before any retry, reads the daily quota |
| Errors | Classifies each error, retries transient ones, waits out throttling, skips bad items, auto-pauses on account-level errors |
| Health | Runs a daily `debug_token` check; refreshes the token every ~30 days if Meta forced 60-day expiry; sends tick and publish-success heartbeats to Healthchecks.io |
| Learning | Pulls per-post insights nightly; runs the 5-best / 2-test slot rotation; moves the main slot after 4–8 weeks |
| Housekeeping | Sends the evening digest; sends a reminder 11 months after the last Data Use Checkup; flags Graph API version expiry 6 months ahead for the integrator |

**Rare events that will always need a human**, and how the system raises each one:

| Event | Detection | Alert and fix |
|---|---|---|
| Annual Data Use Checkup | Meta emails at 60, 30, 10 and 3 days; the server's own 11-month reminder | Owner or integrator completes it in the App Dashboard (about 15 minutes) |
| Security checkpoint or restricted account | 459, 464, 2207050 → channel auto-pauses | "Log in at facebook.com / open Instagram and clear the checkpoint", then press Resume |
| Spam or policy flag | 368, 2207051 → channel auto-pauses | Owner reviews Account Status / Support Home; integrator adjusts templates before resuming |
| Page or Instagram ownership or role change | 492, 10, 200–299, 190 → pause | Re-assign assets to the system user and regenerate the token in Business Settings |
| Meta forces token expiry and the refresh fails, or a new permission is required | `debug_token` shows missing scope or near expiry, alerted 14 and 3 days ahead | Regenerate the system-user token in Business Settings |
| Queue starvation | Fewer than 10 days of approved items | Add covers through Quick-Add; the server keeps posting what remains |
| Nationwide Facebook block outside configured exam dates | Not detectable from Render | Optional owner toggle; otherwise the system carries on |

## Conclusion

Most of the hard thinking here goes into the automation, not into choosing the hour. Hour-level benchmarks are noisy and built for Western weeks, and Meta has removed the audience-online data from the API. A schedule that learns from its own posts will beat any table within two months. The default above is simply a respectable place to start learning from. What Algeria adds that the global studies miss is the calendar: Friday prayer, the evening that follows Maghrib through the seasons, Ramadan's after-Taraweeh peak, and a Bac week that can make a perfectly published post invisible. These belong in config profiles, not in someone's memory.

The largest gap between this plan and the current codebase is hosting, not Meta. A free Render instance that sleeps after 15 minutes and cannot send SMTP cannot be the heartbeat of a zero-babysitting system. Fixing that with a $1 cron job, plus pre-loading Facebook posts into Meta's own scheduler, removes the most likely silent failure. After that, the owner's yearly workload comes down to roughly one Data Use Checkup and the occasional security prompt that only a human can clear. Each one arrives as a message saying exactly what to do, after work hours, with the queue already paused safely.

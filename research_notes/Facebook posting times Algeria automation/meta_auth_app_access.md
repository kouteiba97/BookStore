# Meta Graph API auth, app access levels and versioning for an unattended Page + Instagram poster

Context: a NestJS backend on Render posts one photo and caption a day to the owner's own Facebook Page and linked Instagram professional account. The goal is to find every Meta auth or app-model mechanism that could force manual intervention after go-live, and the most durable configuration. Research date: 2026-11-15. Meta's English docs often redirect to localized (French, Korean) renderings. Quotes from those were translated by the fetch tool.

## 1. Token types and lifetimes; what invalidates them; recommended unattended setup

### Takeaway
The most durable credential is a **System User token** generated in Business Manager (Business Settings) for a business-type app owned by the same business portfolio that owns the Page and IG account. Choose the **"never expire"** option and assign the Page and IG account to the system user. From it, derive a Page access token for Facebook posting. A long-lived Page token derived from a person's 60-day user token also has no time-based expiry. It is still tied to that person's session, password and Page role, so it is the more fragile fallback. Meta pushes integrations toward 60-day expiring system-user tokens, and some businesses are forced onto them. The server must therefore be able to refresh automatically if never-expire is refused.

### Cited Findings
**Short-lived and long-lived user tokens**
- Default User and Page tokens are short-lived and expire in hours. A long-lived user token "generally lasts about 60 days" (sample `expires_in` 5183944 s). It is obtained server-side with `GET oauth/access_token?grant_type=fb_exchange_token`, which needs the app secret. An expired token cannot be exchanged, so the user must log in again. — [Meta: Long-lived tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived)
- If no requests are made, a user token "will expire after about 60 days" and the person must log in again. Automatic refresh happens only through SDK and mobile-app use, so it does not help a server. — [Meta: Long-lived tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived)
- Meta warns: "Do not depend on these lifetimes remaining the same." Short-lived tokens last about 1–2 h; long-lived about 60 days. — [Meta: Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)

**Page access tokens**
- "Long-lived Page access token do not have an expiration date and only expire or are invalidated under certain conditions." They are obtained by calling `{app-scoped-user-id}/accounts` with a long-lived user token, and the person must have a role on the Page. — [Meta: Long-lived tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived)
- "Page access tokens are unique to each Page, admin, and app combination." — [Meta: Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)

**What invalidates tokens (from Meta's debugging and error pages)**
- Tokens "can be invalidated before the planned expiry date" for security reasons. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- Subcode 460: the user logged out of the app or **changed their password**. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- Subcode 458: the user **revoked authorization** (removed the app) or never authorized it. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- Subcode 459: the user is in a **security checkpoint** and must log in at facebook.com to resolve it. Subcode 464 means "unconfirmed user". — [Meta: Graph API error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- Subcode 492: "the user tied to the Page access token lacks an appropriate role on the Page". Losing the Page role kills the Page token. — [Meta: Graph API error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- "Facebook does not notify your app when a token becomes invalid"; the app learns of it only when an API call fails. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- Developers report long-lived tokens invalidated well before 60 days, with messages citing a password change or "Facebook changed the session for security reasons". — [Meta Developer Community thread](https://developers.facebook.com/community/threads/849474743510785); see also [Extended Life Access Token Keeps Expiring](https://developers.facebook.com/community/threads/856440172124814)

**System User tokens (Business Manager)**
- There are two kinds. The **admin system user** should only create other system users. The **regular system user** accesses only the assets it has been assigned and "is the one to use for most API calls". — [Meta: System Users overview](https://developers.facebook.com/docs/marketing-api/system-users/overview)
- Limits: with Standard access, 1 system user and 1 admin system user; with Advanced access, 10 and 1. — [Meta: System Users overview](https://developers.facebook.com/docs/marketing-api/system-users/overview)
- The app must be claimed, created or shared by the same Business Manager that owns the system user. "Creating a system user access token requires Standard Access" (to Ads Management), or allowlisting by a Meta representative. The page also says the app must go through App Review (and business verification, if applicable) for any permissions the system user needs. — [Meta: System Users overview](https://developers.facebook.com/docs/marketing-api/system-users/overview)
- Token expiry choices are **"Never expires"**, with no refresh needed, or **"Expires after 60 days (recommended)"**, with refresh required. Meta states: "All integrations should adopt expiring tokens." "Some businesses must use expiring tokens": for them, omitting `set_token_expires_in_60_days` or setting it to `false` causes an error. — [Meta: Install apps, generate, refresh and revoke tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)
- Installation: the app is installed on the system user with `POST /SYSTEM-USER-ID/applications`; only apps with Standard access or higher to the Ads Management API can be installed. The token is generated with `POST /SYSTEM-USER-ID/access_tokens` (params `business_app`, `scope`, `appsecret_proof`, optional `set_token_expires_in_60_days`) or in the Business Manager UI. Supported scopes include `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` and several `instagram_*` scopes. — [Meta: Install apps & generate tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)
- Refreshing an expiring system-user token: `GET oauth/access_token?grant_type=fb_exchange_token&set_token_expires_in_60_days=true&...`. The token is valid 60 days from generation or refresh. "The old token remains valid until it expires", so rotation has no downtime. Revocation through `oauth/revoke` is immediate. — [Meta: Install apps & generate tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)
- Marketing API Standard-access and System User tokens are "long-lived tokens that do not expire based on time" but "are still subject to invalidation for other reasons". — [Meta: Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)
- Facebook Login for Business: Business Integration System User tokens "default to never expire for the common offline server-to-server communication" and are "associated with your business client's business portfolio rather than a specific user". The app must be a business-type app, or have a use case that supports FLfB. — [Meta: Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)

**Practitioner reports (secondary)**
- 2026 practitioner write-up: the author moved to a system user because user tokens "expire after 60 days and break when the user changes their password or security settings". Steps:
  - Give the system user full control over the Page, the IG account and the app.
  - Add the app as a connected asset.
  - Add the "Facebook Page" use case to unlock `pages_manage_posts`.
  - For Facebook feed posts, exchange the system token for a Page token (`GET /{page-id}?fields=access_token`). Instagram accepts the system-user token directly.
  — [Crystal Hansen blog, 2026](https://crystalhansen.ca/blog/2026/building-sovereign-social-automation/)
- Practitioners warn that a Page shared into Business Manager but never explicitly assigned (with tasks) to the system user leaves the token unable to touch it. — summarized via search results citing [Teradek guide](https://guide.teradek.com/a/2091990-facebook-get-access-to-pages-managed-by-the-business-account) and [Nango: Facebook system user](https://nango.dev/docs/api-integrations/facebook-system-user/connect). Secondary; not verified against Meta docs.

### Inferences
- Recommended setup:
  1. A **business-type app** owned by the owner's business portfolio.
  2. A **regular system user**, with the Page (tasks including create content / full control) and the IG account **assigned** to it, and the app installed on it.
  3. A **never-expiring** system-user token with `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish` and `business_management`.
  4. At runtime, fetch the Page token from `/{page-id}?fields=access_token` (or `/me/accounts`). This removes the 60-day clock, the human password and the human session from the chain.
- If Meta forces 60-day expiry on the business, add a cron job that refreshes the system-user token every ~30–45 days and stores the new value in the DB. Render env vars are static, so the token must live in the database. The old token stays valid until its own expiry, so the refresh is low risk.
- A Page token derived from the owner's personal long-lived user token is the "next best" option. It has no time expiry, but it is exposed to subcodes 460 (password change), 458 (app removed), 459/464 (checkpoint) and 492 (role lost). Each of these needs the owner to log in again manually.
- Even a system-user token dies if the system user is deleted, the asset is unassigned, the app is removed from the business, or the app is deactivated (see section 4).

### Gaps
- Meta docs do not explicitly say whether a human admin's password change or checkpoint affects **system-user** tokens. By design they are not tied to a person, but I found no explicit statement.
- I found no official statement on whether a Page token derived from a system-user token inherits "never expire". Practitioner reports imply it does.
- I could not confirm from Meta which businesses are "forced" onto expiring system-user tokens, or the criteria.
- The system-user page says App Review is needed for the system user's permissions. For an app in Live mode with Standard Access on its own business assets, practitioners report it works without review, but I found no Meta statement that settles this.

## 2. Instagram API with Facebook Login vs Instagram API with Instagram Login

### Takeaway
For this use case (the IG account is already linked to the owner's Page), **Instagram API with Facebook Login for Business** is the more durable choice. It can use the same non-expiring system-user or Page token as the Facebook side, on `graph.facebook.com`. **Instagram Login** (Business Login for Instagram, 2024) needs no Page. Its token is an Instagram User token that expires in 60 days, so the server must call `refresh_access_token` before expiry, forever. If a refresh is missed, the owner must log in again.

### Cited Findings
- Instagram Login "serves Instagram professional accounts without requiring a linked Facebook Page". Facebook Login requires that "your app users' Instagram professional accounts must be connected to a Facebook Page". Both require a **professional** account. — [Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)
- Instagram Login: Instagram User token, host `graph.instagram.com`, permissions `instagram_business_basic` and `instagram_business_content_publish` (plus comments and messages). Facebook Login: Facebook User or Page token, host `graph.facebook.com`, permissions `instagram_basic`, `instagram_content_publish`, `pages_show_list` and `pages_read_engagement`. — [Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)
- A third setup, "Unified Login", uses a Business Integration System User token and requires a business portfolio. Meta recommends it for new integrations. — [Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)
- Instagram Login tokens: the authorization code and the short-lived token each last 1 hour. The long-lived token is "valid for 60 days and can be refreshed before they expire". — [Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)
- Refresh with `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...`. The token must be "at least 24 hours old but has not expired", needs `instagram_business_basic`, and "Refreshed tokens are valid for 60 days from the date at which they are refreshed." — [Meta: refresh_access_token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token)
- Content publishing permissions:
  - FB Login: `instagram_basic`, `instagram_content_publish` and `pages_read_engagement`, with a Page token.
  - Unified Login: `instagram_basic` and `instagram_content_publish`, with a BISU token.
  - IG Login: `instagram_business_basic` and `instagram_business_content_publish`, with an IG User token.
  - Publishing is available with Standard or Advanced Access.
  — [Meta: Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- Publishing gotchas:
  - "JPEG is the only image format supported."
  - The media must be on a "publicly accessible server at the time of the attempt".
  - Publishing is a two-step flow: create a container with `POST /{ig-id}/media`, then publish it with `POST /{ig-id}/media_publish`.
  - Containers expire if not published within 24 h.
  - The limit is 100 API-published posts per 24 h (the same page also says 50 for carousels, a conflict on Meta's page). Usage can be checked with `GET /{ig-id}/content_publishing_limit`.
  - A Page that requires **Page Publishing Authorization (PPA)** "cannot be published to until PPA has been completed".
  — [Meta: Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)

### Inferences
- A refresh-only 60-day token (IG Login) is a single point of failure. One missed refresh window, for example a Render outage or a cron bug lasting more than the remaining validity, forces the owner to log in again. FB Login with a system-user token avoids this.
- The covers are R2-hosted. They are already normalised to JPEG ≤2000 px (`common/utils/cover-image.ts`) and must be served over a public HTTPS URL, which fits the IG requirement.
- PPA is an owner-side action that can block publishing without warning. It is worth having the owner complete it up front.

### Gaps
- I did not verify whether the IG side accepts the system-user token directly or needs the Page token. The practitioner says it accepts the system-user token; Meta's content-publishing page lists a Page token for FB Login and a BISU token for Unified Login.

## 3. Permissions, Development mode vs Live, Standard vs Advanced Access, App Review and Business Verification

### Takeaway
To post to the owner's own Page and IG account, **Standard Access** is enough, because the owner (and the system user's business) has a role on the app or owns it. Advanced Access, App Review and Business Verification are needed only to serve people without a role. **Do not stay in Development mode**: content created by a dev-mode app is visible only to app role users. Switch the app to **Live** with Standard Access.

### Cited Findings
- Page publishing needs a Page access token with `pages_manage_posts` and `pages_read_engagement` (the docs also list `pages_manage_engagement` and `pages_read_user_engagement`), and the user must be able to do the `CREATE_CONTENT`, `MANAGE` and `MODERATE` tasks on the Page. Photos post with `POST /{page-id}/photos` and a `url`. Scheduled posts must be 10 min to 30 days ahead. — [Meta: Pages API Posts](https://developers.facebook.com/docs/pages-api/posts)
- Standard Access is the default; it "limits the data your app can get" and is meant for people with roles on the app, or for testing. Advanced Access "requires App Review and Business Verification" and is needed for users without a role on the app or on a claiming business portfolio. — [Meta: Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview)
- Development mode: only role users can use the app. Data such as **test posts is visible only to role users**, and dev-mode apps cannot be searched for by the public. New apps start in dev mode. When the app goes Live, data created in dev mode "will become visible to all app users once you switch". — [Meta: App Modes](https://developers.facebook.com/docs/development/build-and-test/app-modes)
- Live mode: apps "can request permissions from anyone, but only permissions approved through App Review". Consumer apps in Live mode can request Standard Access permissions only from role users. — [Meta: App Modes](https://developers.facebook.com/docs/development/build-and-test/app-modes)
- FLfB: "To serve businesses that you do not own or manage, your app must be approved for Advanced Access via Meta's App Review." Advanced-Access apps "are required to undergo Ongoing Review to retain access". "Advanced access to the public_profile permission is required for Facebook Login for Business apps before they go live." — [Meta: Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)
- Creating system-user tokens needs Standard Access to Ads Management. The system-user doc also mentions App Review / business verification "if applicable". — [Meta: System Users overview](https://developers.facebook.com/docs/marketing-api/system-users/overview)
- Since about 2024–2025, apps are built around "use cases" (for example a "Facebook Page" / manage-Page use case that unlocks `pages_manage_posts`). — [Crystal Hansen blog, 2026](https://crystalhansen.ca/blog/2026/building-sovereign-social-automation/) (secondary)

### Inferences
- The minimal-risk path is a business app owned by the owner's portfolio, Standard Access only (no Advanced Access, so less ongoing-review exposure), switched to **Live**, with privacy policy URL, icon and category filled in.
- Staying in dev mode would make posts invisible to the public, which defeats the purpose. Treat this as a critical gotcha to verify on day 1: log out, or use another account, and check that the post is visible.
- The FLfB statement that `public_profile` needs Advanced Access before going live may force a minimal App Review for an FLfB-configured app. A plain business app using a system-user token generated in Business Settings may avoid FLfB entirely. This needs hands-on verification.

### Gaps
- The App Modes page did not list the prerequisites for switching to Live (privacy policy URL, data deletion URL, category, icon). From experience these are required, but the fetched page did not confirm them.
- I found no 2025–2026 Meta doc explicitly confirming that a Live business app with only Standard Access can post publicly to its own business's Page without App Review. This is widely reported practice but unverified here.
- Business Verification requirements specific to a Standard-Access, own-assets setup were not confirmed.

## 4. Things that can disable the app or token unexpectedly, and how much warning is given

### Takeaway
The biggest scheduled risk is the **annual Data Use Checkup (DUC)**. If it is missed, the app is **deactivated** with no extensions. Meta warns about 60 days ahead, then 30, 10 and 3 days ahead, by email and in the App Dashboard Alerts Inbox. DUC applies to Live apps published with a use case or with Advanced Access, so the owner must keep a working admin login and read developer email. Unscheduled risks include security checkpoints, password changes (user tokens only), role or asset removal, app removal, policy blocks (code 368) and PPA.

### Cited Findings
- DUC is "an annual assessment". Since January 2024 it includes data-handling questions. The steps are: review permissions, features and products; certify compliance; answer data-handling questions; give testing instructions. — [Meta: Data Use Checkup](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup)
- Who must do it:
  - The DUC page says it is "required for developers whose apps have been published live with a use case" and also covers apps with Advanced Access, but "is not required for developers whose apps have Standard Access to permissions and features". — [Meta: Data Use Checkup](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup)
  - The FAQ says "Only Live Mode apps require Data Use Checkup", meaning Live apps published with a use case or with Advanced Access since the last DUC. — [Meta: DUC FAQ](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup/faq)
  - These statements sit in tension for a Live, Standard-only, use-case app.
- Warnings: a developer notification by email and in the Alerts Inbox about **60 days** before the deadline, then reminders at **30, 10 and 3 days**. The deadline is per app and is shown in the notification, the dashboard banner and the apps panel. — [Meta: DUC FAQ](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup/faq)
- Consequence: "your app will be deactivated until DUC is completed." "Extensions will not be provided." Inactive apps must get their use cases and permissions re-approved through App Review before they are reactivated. If changes are requested, there are 20 calendar days to resubmit. There is a form for regaining lost admin access. — [Meta: DUC FAQ](https://developers.facebook.com/docs/development/maintaining-data-access/data-use-checkup/faq)
- Advanced Access apps face "Ongoing Review to retain access". — [Meta: Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)
- Code 368: "temporarily blocked for policy violations — wait and retry". — [Meta: Graph API error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- Meta may change any API quickly "to fix security or privacy issues". — [Meta: Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning)
- v27.0 (Nov 2026) blocked six legacy Graph API features for new apps on all versions. This shows that platform-wide changes can bypass version pinning. — [PPC Land](https://ppc.land/metas-api-v27-may-add-catalog-products-to-new-ads-by-default/) (secondary)

### Inferences
- The developer-account email must go to an inbox the owner (or the integrator) actually reads. Also add a second admin, for example the integrator, on both the app and the business portfolio, so a DUC or lost-admin situation does not depend on one person.
- Keeping the app Standard-only is the best way to minimize DUC and Ongoing Review exposure, but Meta's wording is ambiguous for Live apps with a use case. Plan for a once-a-year, roughly 15-minute DUC task.

### Gaps
- No reliable 2025–2026 source was found on **app inactivity** auto-deactivation (for example, apps with no API calls for N days), developer-account re-verification cadence, or Platform Terms re-acceptance prompts that block the API. The "inactive apps" wording in the DUC FAQ refers to apps deactivated by DUC, not idle apps.
- Privacy-policy URL crawling (apps disabled when the policy URL 404s) is a known practice, but I found no current source for it in this session.

## 5. Graph API versioning

### Takeaway
New versions arrive roughly 2–3 times a year: v22 in Jan 2025, v23 in May 2025, v24 in Oct 2025, v25 in Feb 2026, v26 in Jul 2026, and v27 in Nov 2026. Each version works for at least 2 years, and it expires 2 years after the *next* version's release. Calls to an expired version are silently routed to the oldest still-supported version. Pin the version explicitly in the request path, and plan an upgrade about once a year.

### Cited Findings
- Each version is guaranteed to work for at least 2 years. It becomes unusable 2 years after the next version's release. Calls to an expired version "are routed, by default, to the next oldest usable version". Unversioned calls use the app's default version (App Dashboard > Settings > Advanced > "Upgrade API version"). Meta recommends specifying the version. The page lists the latest as v27.0. — [Meta: Graph API Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning)
- Release and expiry dates (Korean-locale changelog, more current than the English page):

  | Version | Released | Expires |
  |---|---|---|
  | v26.0 | 2026-07-29 | TBD |
  | v25.0 | 2026-02-18 | 2028-07-29 |
  | v24.0 | 2025-10-08 | 2028-02-18 |
  | v23.0 | 2025-05-29 | 2027-10-08 |
  | v22.0 | 2025-01-21 | 2027-05-20 |
  | v21.0 | 2024-10-02 | 2027-01-21 |
  | v20.0 | 2024-05-21 | 2026-09-24 (already expired) |

  — [Meta: Graph API changelog versions (ko_KR)](https://developers.facebook.com/docs/graph-api/changelog/versions/?locale=ko_KR)
- The English changelog page still showed "TBD" for some expiries and appeared stale. — [Meta: changelog versions](https://developers.facebook.com/docs/graph-api/changelog/versions)
- Graph/Marketing API v27.0 was released **2026-11-04** (secondary coverage). It adds the ability to set or remove a post's AI-generated self-disclosure, and Meta reiterated that v21.0 is removed on 2027-01-21 and v22.0 on 2027-05-20. — [PPC Land](https://ppc.land/metas-api-v27-may-add-catalog-products-to-new-ads-by-default/); [Relevant Audience](https://www.relevantaudience.com/meta/meta-marketing-api-v27-product-showcase-device-expansion-defaults/) (secondary). The Meta blog post itself was not retrieved.
- v25.0 announcement — [Meta blog, 2026-02-18](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25). v24.0 announcement — [Meta blog, 2025-10-08](https://developers.facebook.com/blog/post/2025/10/08/introducing-graph-api-v24-and-marketing-api-v24/).
- The Marketing API versions on its own schedule. — [Meta: Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning)

### Inferences
- As of Nov 2026, pinning `v25.0` (expires Jul 2028) or `v26.0`/`v27.0` gives at least 1.5–2+ years of runway. Keep the version in a single config constant (for example `META_GRAPH_VERSION`) and read the changelog when bumping it.
- Auto-routing on expiry means the poster will not hard-fail when a version expires, but behavior may change silently. A daily health check that verifies the post succeeded (see section 6) covers this.

### Gaps
- The expiry date for v26.0/v27.0 was not yet published in the sources fetched.

## 6. Detecting token and app problems programmatically

### Takeaway
Call `GET /debug_token` daily, before posting, and classify Graph errors by code and subcode. Alert the owner on anything that needs a human (459, 460, 464, 458, 492, missing permission 10/200-series, app deactivated). Retry automatically on throttling (4, 17, 368).

### Cited Findings
- `GET graph.facebook.com/debug_token?input_token=<token>&access_token=<app token or valid token>` returns:
  - `is_valid`, `expires_at` and `data_access_expires_at`
  - `scopes` and `granular_scopes`
  - `app_id`, `type`, `application`, `user_id` and `issued_at`
  Both tokens must come from the same app. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- Error map:

  | Code / subcode | Meaning | Action |
  |---|---|---|
  | 190 | Token expired or invalid | Get a new token |
  | 102 | Session error | Get a new token |
  | 10, 200–299 | Permission not granted or removed | Handle the missing permission |
  | 4, 17 | Throttling | Wait and retry |
  | 368 | Temporary policy block | Wait and retry |
  | 458 | App not installed / deauthorized | Re-authenticate |
  | 459 | Checkpoint | User must log in at facebook.com |
  | 460 | Password changed | User must log in to the app again |
  | 463 | Expired | Get a new token |
  | 464 | Unconfirmed user | User must log in at facebook.com |
  | 467 | Invalid token | Get a new token |
  | 492 | Page role missing | Restore the Page role |

  — [Meta: Graph API error handling](https://developers.facebook.com/docs/graph-api/guides/error-handling)
- Meta does not push token-invalidation notifications; failures surface only on API calls. — [Meta: Debugging & errors](https://developers.facebook.com/docs/facebook-login/guides/%20access-tokens/debugging)
- IG: `GET /{ig-id}/content_publishing_limit` shows quota usage. Container `status_code` can be `EXPIRED`, `ERROR`, `FINISHED` and so on. Poll once per minute for at most 5 minutes. — [Meta: Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)

### Inferences
- Suggested daily job:
  1. Call `debug_token` on the stored token. Alert if `is_valid=false`, if `expires_at` is non-zero and less than 14 days away, if a required scope is missing from `scopes`, or if `data_access_expires_at` is near. Zero means never.
  2. Publish.
  3. On error, branch on `error.code` / `error_subcode`: retry with backoff for 4/17/368/1/2; alert immediately for 190/102/10/200-299/458/459/460/464/467/492.
  4. Record a "last successful post" timestamp and alert if it is older than about 26 h. This also catches silent version or behavior changes and app deactivation.
- Send alerts through a channel the owner sees (WhatsApp, already used by the storefront, or email), and include the exact fix, for example "log into facebook.com to clear a checkpoint".
- If the token is an expiring system-user or IG-Login token, the same job refreshes it at about 30 days and writes the new value to the DB.

### Gaps
- I did not confirm what `data_access_expires_at` means for system-user or Page tokens. For user tokens it is the 90-day data-access window, but that was not confirmed in the fetched page.
- I found no documented error code or webhook that specifically signals "app deactivated due to DUC". The poster would probably see generic 190/10/200-series errors.

# Meta Marketing API — ops verification & Standard Access

> Companion to ADR 0008. Use this checklist before re-requesting Marketing API
> **Standard Access**. Do not generate fake Ads API traffic.

## 1. Server configuration (Railway)

Boot logs a non-sensitive summary: `[meta-config] accessToken=set|missing …`
(values are never logged). Ads endpoints return **503** if the access token is
missing; the process still starts so DB/health checks work.

| Variable | Required? | Purpose |
|---|---|---|
| `META_ACCESS_TOKEN` | **Yes** for Ads/Campaigns/insights/lead fetch | Business **system user** token with ads + leads permissions |
| `META_APP_SECRET` | **Yes** for webhook POST | `X-Hub-Signature-256` verification |
| `META_WEBHOOK_VERIFY_TOKEN` | **Yes** for webhook GET | Hub challenge for `/api/webhook/meta` |
| `META_APP_ID` | Optional | Meta app id for ops/docs; **not used by Graph client today** |
| `META_GRAPH_VERSION` | Optional (default `v22.0`) | Graph API version |
| `META_AD_ACCOUNT_IDS` | Optional | Allowlist (`act_…`, comma-separated); empty = discover via token |
| `META_GRAPH_BASE_URL` | Optional | Override Graph host (tests) |
| `META_CONNECT_TIMEOUT` / `META_READ_TIMEOUT` / `META_MAX_RETRIES` | Optional | HTTP client tuning |

Never put Meta secrets on Vercel. Frontend only needs `API_PROXY_TARGET`.

## 2. Functional verification (real business use)

Sign in as MANAGER / ADMIN / CEO on the CRM:

1. **Ad Channels** → **Run Meta diagnostic** (or `GET /api/marketing/meta/diagnostics`).
   Expect `status=OK` and `accessToken=set`. No secrets are returned.
2. **Ad Channels** → authorized accounts load.
3. **Campaigns** → list campaigns; change insights preset; refresh.
4. Confirm `GET /api/marketing/meta/usage?days=15` shows successful
   `diagnostics.*` / `adaccounts.list` / `campaigns.list` / `insights.list` rows.
5. (Optional) Submit a test Lead Ad → webhook creates a CRM lead; duplicate
   delivery does not create a second lead.

Diagnostic statuses: `CONFIG_MISSING`, `AUTH_FAILURE`, `PERMISSION_FAILURE`,
`ACCOUNT_INACCESSIBLE`, `RATE_LIMITED`, `UNAVAILABLE`, `OK`.

The diagnostic calls `GET /me?fields=id` and `GET /me/permissions` only. It
does not list campaigns. `capabilities.adsEnabled` is true only when the token
grants `ads_read` or `ads_management`. `capabilities.leadsEnabled` is true only
when it grants `leads_retrieval`. Page permissions are reported and do not
turn either switch on. Campaign, insight, and ad-account reads are skipped
when ads permission is missing. Lead fetch is skipped when `leads_retrieval`
is missing. A successful diagnostic is not Marketing API Standard Access
approval.

### 2.1 Campaign & insights live checklist (Phase 5)

Do **not** edit campaigns or increase spend. Read-only UI only.

| Step | Expected |
|---|---|
| Manager opens **Campaigns** | Account picker populated from diagnostic-visible accounts |
| Campaign table | Name, status/effective status, objective; **Load more** if `hasMore` |
| Empty account | “No campaigns…” empty state (not a fake success row) |
| Insights presets | last_7d / last_30d etc. refresh Performance table |
| Empty date range | “No insight rows for this range…” |
| Wrong/expired token | Error banner with actionable CRM message (no token leak) |
| SALES user | Cannot open Marketing routes (RBAC) / API returns 403 |

Automated coverage (mocked Graph): `MetaMarketingServiceTest`,
`MetaMarketingControllerTest`, `MetaMarketingAccessIT` (CRM role gate).

## 3. Webhook readiness (Lead Ads)

### 3.1 What the CRM implements (verified in code)

| Concern | Behaviour |
|---|---|
| Path | `GET` + `POST` `/api/webhook/meta` (public; JWT not used) |
| Auth | GET: `hub.mode=subscribe` + `hub.verify_token` == `META_WEBHOOK_VERIFY_TOKEN` (constant-time). POST: `X-Hub-Signature-256: sha256=<hex>` over **raw** body with `META_APP_SECRET` |
| Object / field | Accepts `object=page`, processes `changes[].field=leadgen` only; other objects/fields acknowledged with HTTP 200 (no Meta retry storm) |
| Ack | HTTP **200** after signature OK and parse; lead fetch + CRM create run in-request (idempotent on `meta_lead_id`) |
| Idempotency | Unique `meta_leadgen_events.meta_lead_id` + skip `PROCESSED`/`DUPLICATE`; `FAILED` may re-attempt on later delivery |
| Lead fetch | Graph `GET /{leadgen_id}?fields=id,created_time,field_data,platform` using server `META_ACCESS_TOKEN` |
| Association | Stores `page_id`, `form_id`, `ad_id`, `adgroup_id`, `campaign_id` on the event; remarks include non-PII custom answers |
| Safety | No field payloads in logs; failure messages strip `access_token=` / `EAA…` shapes; POST size cap 64 KiB → 400; rate-limited with other webhooks |
| Hosting | Secrets and callback live on **Railway backend only** — never configure Meta webhook to the Vercel frontend |

Automated tests: `MetaHubSignatureTest`, `MetaLeadgenServiceTest` (verify, signature, create, duplicate skip).

### 3.2 Callback URL (template — fill from Railway, do not invent)

```text
https://<YOUR-RAILWAY-BACKEND-PUBLIC-HOST>/api/webhook/meta
```

How to obtain the host (ops):

1. Railway → **backend** service → Settings → Networking → public HTTPS domain
   (or the value you already put in Vercel `API_PROXY_TARGET`, without any path).
2. Append `/api/webhook/meta` exactly. No trailing slash required.
3. Confirm publicly: `GET https://<host>/actuator/health` (Railway healthcheck)
   and/or `GET https://<host>/api/health` returns OK before Meta verify.

This repository **cannot** prove your live Railway domain, Page subscription, or
Meta app webhook subscription. Those are dashboard facts.

### 3.3 Meta dashboard steps (manual — do not claim done until Meta UI shows it)

Prerequisites on Railway (values never pasted into chat/docs commits):

- `META_ACCESS_TOKEN` — system user token that can read Lead Ads for the Page
- `META_APP_SECRET` — App → Settings → Basic
- `META_WEBHOOK_VERIFY_TOKEN` — a long random string **you** choose; paste the
  **same** value into Meta’s webhook Verify Token field

Then:

1. Meta Developers → your app → **Webhooks** → add/edit callback URL =
   `https://<host>/api/webhook/meta`, Verify Token = `META_WEBHOOK_VERIFY_TOKEN`.
2. Click **Verify and Save**. CRM returns `hub.challenge` as plain text on success.
3. Subscribe object **`page`**, field **`leadgen`** (not `user` / not feed-only).
4. Still required separately: **subscribe the Facebook Page** that owns the Lead
   Forms to this app (Page → Settings → Linked apps / Meta’s Page subscription
   UI, or Business settings). App webhook field subscription alone is **not**
   enough.
5. Permissions / assets typically needed for end-to-end lead pull (confirm in
   current Meta docs for your app type): leads-related + pages access on the
   system user / Business that owns the Page; token must see the form’s Page.
6. Send a real/test Lead Ad submission. Expect CRM lead + `meta_leadgen_events`
   row; a duplicate webhook delivery must **not** create a second lead.

Smoke GET (placeholders only):

```bash
curl -sS "https://<host>/api/webhook/meta?hub.mode=subscribe&hub.verify_token=<SAME_AS_RAILWAY>&hub.challenge=testchallenge"
# expect body: testchallenge
```

Do **not** claim “webhook live” until: Verify succeeds **and** Meta shows the
Page subscribed **and** a test lead lands in CRM.

## 4. Usage evidence hygiene

Table `meta_api_call_log` stores only:

- timestamp, operation, account id, HTTP status, success, error code, graph version, correlation id

It must **never** store access tokens, app secrets, or lead field values.
CRM UI exposes a sanitized summary at `GET /api/marketing/meta/usage` (default
`days=15`, max 90). Counts are **CRM → Graph HTTP attempts** written when an
authorized operator uses diagnostics / ad accounts / campaigns / insights —
not fabricated rows and not Meta’s own review clock.

**Retries:** transient failures (429 / 5xx) retry up to `META_MAX_RETRIES`.
Each attempt is a separate log row; attempts for one logical call share the
same `correlation_id`. Success and failure totals therefore include retries.

**Roles:** MANAGER / ADMIN / CEO only. SALES receives 403. Reading usage does
**not** require `META_ACCESS_TOKEN` (it is CRM metadata).

The Ad Channels panel must not imply Meta has approved the app.

## 5. Before re-applying for Standard Access

1. Confirm Meta still lists Development access and required permissions for your app.
2. Confirm ≥15 days of **genuine** Ads API calls from this integrated app
   (CRM UI / authorized sync — not scripts whose only purpose is volume).
3. Privacy policy URL, data deletion instructions, and reviewer notes are
   accurate for Trip On Himalaya CRM (not the public marketing site alone).
4. Reviewer path: login → Ad Channels → Campaigns → (optional) Lead Ads form.
5. Re-read Meta’s current eligibility criteria; do not assume approval after
   calendar time alone.

## 6. Security hardening (Phase 8)

| Control | Behaviour |
|---|---|
| CRM roles | `/api/marketing/meta/**` → MANAGER / ADMIN / CEO only |
| Fail closed | Missing `META_ACCESS_TOKEN` → 503 on Ads Graph calls |
| Allowlist | Prefer `META_AD_ACCOUNT_IDS` in production (prod boot warns if empty) |
| Account id | Must match `act_[0-9]+` after normalize (blocks path injection) |
| Insights inputs | Level allowlist; `since`/`until` must be `YYYY-MM-DD` |
| Graph client | HTTPS Meta hosts only (http loopback for tests); `META_GRAPH_VERSION` like `v22.0`; retries capped at 5; connect/read timeouts from env |
| Webhook | Signature + verify token; leadgen id charset/length check; payload size cap; rate limit |
| Secrets | Never in Vercel/`NEXT_PUBLIC_*`; never logged; usage log metadata-only |
| CORS | Prod should set `CORS_ALLOWED_ORIGINS` to Vercel origins (boot warns if localhost remains) |
| Railway isolation | Meta config via env/`AppProperties` only — no Railway SDK in `marketing/` |

## 7. Phase 9 verification (2026-10-16) — commands & outcomes

Ran against commit `4ca82e8` (+ this doc). **No production deploy was performed.**

| Check | Command | Result |
|---|---|---|
| Meta unit tests | `mvn -Dtest=MetaGraphClientTest,MetaMarketingServiceTest,MetaMarketingControllerTest,MetaLeadgenServiceTest,MetaDiagnosticsTest,MetaApiCallLogHygieneTest,MetaHubSignatureTest,MetaWebhookControllerTest,MetaConfigReporterTest test` (Docker `maven:3.9-eclipse-temurin-25`) | **PASS** (exit 0) |
| Meta access IT | `mvn -Dtest=MetaMarketingAccessIT test` with `SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/securetravels_test` on compose network | **PASS** (exit 0); Flyway validated **28** migrations, schema at **v28** |
| Frontend typecheck | `npx tsc --noEmit` in `frontend/` | **PASS** (exit 0) |
| Frontend lint | `npm run lint` | **PASS** (exit 0) |
| Frontend build | `npm run build` (after clearing stale `.next`) | **PASS** (exit 0); includes `/campaigns`, `/ad-channels` |

Migration implication: Meta tables/indexes ship in **`V28__meta_marketing.sql`** only. No new Flyway version in Phases 2–9 code hardening. Deploying backend that includes V28 applies it once on boot via Flyway — non-destructive additive DDL.

## 8. Railway + Vercel deploy plan (await explicit approval)

Do **not** treat git push as a finished production cutover. Apply variables, confirm health, then exercise CRM Meta UI.

### 8.1 Where things run

| Layer | Host | Meta secrets? |
|---|---|---|
| Spring Boot API + webhook | **Railway** backend service (`Dockerfile` / `railway.toml`) | **Yes** — all `META_*` |
| Postgres | Railway Postgres plugin | N/A (Flyway on boot) |
| Next.js CRM UI | **Vercel** (`frontend/`, `API_PROXY_TARGET` only) | **Never** |

### 8.2 Railway backend checklist

1. Service root = repo with `Dockerfile`; healthcheck = `/actuator/health` (`railway.toml`).
2. Set platform vars: `SPRING_PROFILES_ACTIVE=prod`, DB (`DATABASE_URL` or `DB_*`), `JWT_SECRET`, `WEBHOOK_SECRET`, `CORS_ALLOWED_ORIGINS=https://<vercel-app>`.
3. Set Meta vars (values only in Railway UI — see `ops/ENV.production.example`):
   - Required for Ads UI: `META_ACCESS_TOKEN`
   - Required for Lead Ads webhook: `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
   - Recommended prod: `META_AD_ACCOUNT_IDS=act_…`
   - Optional: `META_GRAPH_VERSION`, `META_APP_ID`
4. Public HTTPS domain on the **backend** service.
5. After deploy, logs should show `[meta-config] accessToken=set …` (never values).
6. Confirm: `GET https://<railway-host>/actuator/health` and/or `/api/health`.

### 8.3 Vercel frontend checklist

1. Root Directory = `frontend`.
2. `API_PROXY_TARGET=https://<railway-host>` (no path, no Meta secrets, no `NEXT_PUBLIC_META_*`).
3. Redeploy after Railway domain/proxy changes.

### 8.4 Post-deploy smoke (operator)

1. Login as MANAGER/ADMIN/CEO → **Ad Channels** → **Run Meta diagnostic** → expect `OK` when token is valid.
2. **Campaigns** → list + insights preset (read-only; no spend changes).
3. **Usage** panel shows recent ops (CRM evidence, not Meta approval).
4. Only then: Meta webhook callback `https://<railway-host>/api/webhook/meta` + Page `leadgen` subscribe (see §3).

### 8.5 Rollback

- Railway: redeploy previous successful deployment / image for the backend service.
- Vercel: promote previous deployment.
- DB: V28 is additive; rolling back app code leaves new tables unused (do **not** drop Meta tables without an explicit approved migration).

### 8.6 Out of scope until you approve

- Triggering Railway/Vercel production deploy from this agent
- Meta dashboard subscribe / Standard Access re-application
- Destructive DB operations

## 9. What we will not do

- Fake usage loops
- Hardcoding personal explorer tokens
- Calling Graph from the browser with privileged tokens
- Claiming webhooks are live before Railway HTTPS + Page subscription
- Auto-deploy or auto-submit Meta Standard Access

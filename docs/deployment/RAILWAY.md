# Railway — Trip On Himalaya CRM API (production)

This service is the **system of record** for lead → deal → booking → payment →
departure (CRM desks, Finance ERP login, webhooks / IVR callbacks). Treat it
like a Salesforce org: **no public desk without Postgres, secrets, CORS, and a
public HTTPS domain**.

Vercel hosts only the Next.js UI. It never holds JWT or DB secrets.

## Why the deploy showed CRASHED / login failed

| Symptom | Cause |
|---|---|
| **`Connection to 127.0.0.1:5432 refused`** | No Railway Postgres wired. App fell back to the laptop default in `application.yml`. Set `DATABASE_URL=${{Postgres.DATABASE_URL}}` and remove any localhost `DB_URL`. |
| **0 Variables** | Secrets are **not** set in `railway.toml`. Variables live only in the **Variables** tab. |
| **Crashed** | API **refuses to boot** without secrets, CORS, and a **non-localhost** database. That is intentional. |
| **Unexposed service** | No public domain → Vercel `API_PROXY_TARGET` cannot reach login. |
| **Vercel: API proxy not configured** | Set `API_PROXY_TARGET` on Vercel to the Railway HTTPS origin and redeploy. |

Short path: [`GO_LIVE_LOGIN.md`](./GO_LIVE_LOGIN.md).

Frontend-only commits no longer redeploy this API (`watchPatterns` in `railway.toml`).

## One-time production setup (do in order)

### 1. Postgres

1. Railway project → **New** → **Database** → PostgreSQL.
2. Name it `Postgres` (or note the exact service name for `${{…}}` references).

### 2. API service

1. Service from GitHub `anilrana004/trip-on-himalya-adventure-pvt-ltd` (root).
2. Builder: **Dockerfile** / `Dockerfile` at repo root (builds `backend/` only).
3. Confirm `railway.toml` healthcheck: `/actuator/health`.

### 3. Variables (required — this fixes the crash)

Open **API service → Variables**. Use Raw Editor and paste from repo
`.env.example` / `ops/ENV.production.example`, then fill secrets.

Generate secrets on your machine:

```powershell
powershell -File ops/gen-prod-secrets.ps1
```

Minimum set:

| Variable | Value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (also defaulted in the Docker image) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (match your Postgres service name) |
| `JWT_SECRET` | from gen script (≥ 32 chars) |
| `WEBHOOK_SECRET` | from gen script |
| `EMAIL_WEBHOOK_SECRET` | from gen script |
| `SMS_WEBHOOK_SECRET` | from gen script |
| `CORS_ALLOWED_ORIGINS` | Exact Vercel URL, e.g. `https://your-app.vercel.app` — no trailing slash, no `*`, no localhost |

Recommended: `APP_PUBLIC_URL`, `BOOTSTRAP_ADMIN_*`, `FINANCE_BOOTSTRAP_PASSWORD`.

Leave `COOKIE_DOMAIN` **empty** while Next.js proxies `/api`.

### 4. Public networking (required for login)

1. API service → **Settings → Networking → Generate Domain**.
2. Copy `https://….up.railway.app` (no path).
3. Vercel → frontend → `API_PROXY_TARGET` = that origin → **Redeploy**.

Until the domain exists the service stays **Unexposed** and CRM/ERP login cannot work.

### 5. Verify

1. Railway deploy → **Active**, health green.
2. `GET https://<railway-domain>/actuator/health` → `{"status":"UP",…}`.
3. Vercel `/login` and `/finance/login` → Sign in succeeds.
4. Network tab: browser calls **Vercel** `/api/auth/login`, not Railway directly.

## Topology (permanent)

```text
Staff browser
  → Vercel (CRM + Finance ERP UI)
      → /api/*  App Router BFF (API_PROXY_TARGET)
          → Railway API (this service) + Postgres
              → Meta / website / SMS / email webhooks (signed)
```

## Rollback

Redeploy the previous successful Railway deployment. Coordinate with Vercel only
if the API contract changed.

## Do not

- Put JWT, DB, or Meta secrets on Vercel / `NEXT_PUBLIC_*`
- Set `CORS_ALLOWED_ORIGINS=*` or localhost in prod
- Mount a volume on the API for Postgres data (use the plugin)
- Expect `railway.toml` to store secrets

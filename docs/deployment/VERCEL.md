# Vercel (frontend)

CRM and Finance ERP share one Next.js app. Browser login always calls
**same-origin** `/api/auth/*` (never the Railway host from the page).

## Root cause of login `Request failed (404)`

Build-time `next.config` rewrites to `localhost:8080` (default when
`API_PROXY_TARGET` was missing at build) run **before** App Router dynamic
routes. On Vercel that shadows `/api` and returns 404. Production no longer
registers those rewrites.

## Correct production path

```text
Browser (CRM /finance/login)
  → POST https://<vercel>/api/auth/login
  → App Router  src/app/api/[...path]/route.ts  (runtime)
  → API_PROXY_TARGET  →  https://<railway>/api/auth/login
```

## Project settings

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework | Next.js (`frontend/vercel.json`) |
| **Required env (Production + Preview)** | `API_PROXY_TARGET=https://<railway-public-host>` |

Rules for `API_PROXY_TARGET`:

- Exact Railway HTTPS origin from **Settings → Networking → Public domain**
- No trailing slash, no `/api` suffix
- Example: `https://securetravels-crm-production.up.railway.app`
- Set for **Production** (and Preview if you test preview deploys)
- After changing the value: **Redeploy** (env is read at request time by the
  route handler; a new deployment ensures the serverless bundle is current)

## Do not put on Vercel

JWT secrets, DB URLs, Meta tokens, or any `NEXT_PUBLIC_*` secret. Frontend
only needs `API_PROXY_TARGET`.

## Cookies / CORS (Railway)

While this proxy is used:

- Leave `COOKIE_DOMAIN` empty on the API (host-only on the Vercel app host)
- `CORS_ALLOWED_ORIGINS` = exact Vercel (or custom) app origin, e.g.
  `https://your-app.vercel.app` — no `*`, no localhost in prod
- Refresh cookie path stays `/api/auth`; proxy strips any `Domain=` and
  ensures `Secure` on HTTPS

## Verify after deploy

1. Open CRM `/login` and Finance `/finance/login`
2. Sign in — expect 200, not 404/502/503
3. If 503: `API_PROXY_TARGET` missing → set env and redeploy
4. If 502 “Application not found”: Railway domain wrong or service stopped
5. DevTools → Network → `/api/auth/login` should hit the **Vercel** host

Rollback: promote previous Vercel deployment independently of Railway when UI-only.

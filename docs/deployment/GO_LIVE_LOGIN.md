# Go-live: CRM + Finance ERP login (Vercel + Railway)

Do these steps in order. Skipping Postgres or `API_PROXY_TARGET` is why login fails.

## A. Railway API (fixes `127.0.0.1:5432 refused`)

If health shows **Application failed to respond**, the container is exiting.
Common cause: `DATABASE_URL` is correct **and** a leftover `DB_URL=127.0.0.1`
exists — **delete `DB_URL` / `DB_USER` / `DB_PASSWORD`**, keep only
`DATABASE_URL`, redeploy. Deploy logs should print
`[entrypoint] datasource host=postgres.railway.internal:5432`.

### Click path (do exactly this)

1. Open your Railway project canvas (`daring-mindfulness` / production).
2. Click **+ Create** → **Database** → **Add PostgreSQL**. Wait until it is green.
3. Click your **API** service (the one that shows Crashed) → tab **Variables**.
4. Click **+ New Variable** → **Add Reference** (or “Shared Variable” / Variable Reference).
5. Choose the **Postgres** service → variable **`DATABASE_URL`**.  
   The value must look like `${{Postgres.DATABASE_URL}}` (Railway fills it).
6. **Do not** type `127.0.0.1` or paste a laptop JDBC URL.
7. Delete any variable named `DB_URL` / `DB_USER` / `DB_PASSWORD` that mentions localhost.
8. Redeploy the API. Logs should show Hikari connecting to `*.railway.internal` or similar — **never** `127.0.0.1`.

2. **Also set these Variables** (Raw Editor OK for secrets). Paste and fill:

```env
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<from ops/gen-prod-secrets.ps1>
WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
EMAIL_WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
SMS_WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
CORS_ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
APP_PUBLIC_URL=https://YOUR-APP.vercel.app
# If CORS_ALLOWED_ORIGINS is omitted, APP_PUBLIC_URL alone is enough (must be https).
BOOTSTRAP_ADMIN_EMAIL=admin@securetravels.in
BOOTSTRAP_ADMIN_PASSWORD=<strong password>
# Optional recovery: set true once, redeploy, sign in, then delete the force var.
# BOOTSTRAP_ADMIN_FORCE_PASSWORD=true
FINANCE_BOOTSTRAP_PASSWORD=<strong password>
```

**Login passwords:** production does **not** accept local demo passwords
(`admin123` / `finance123`). Sign in with `BOOTSTRAP_ADMIN_PASSWORD` (CRM) or
`FINANCE_BOOTSTRAP_PASSWORD` (Finance ERP) from Railway Variables.


Generate secrets:

```powershell
powershell -File ops/gen-prod-secrets.ps1
```

If your Postgres service is **not** named `Postgres`, change the reference, e.g. `${{Postgres-abc.DATABASE_URL}}` (use the Variable reference picker in Railway).

3. **Delete** any `DB_URL` / `DB_USER` / `DB_PASSWORD` that point at `127.0.0.1` or `localhost`.

4. **Settings → Networking → Generate Domain**  
   Copy `https://….up.railway.app` (no path).

5. Redeploy. Logs must show Flyway connecting to `*.railway.internal` / Railway host — **not** `127.0.0.1`.  
   Then `GET https://<domain>/actuator/health` → `UP`.

## B. Vercel frontend (fixes “API proxy not configured”)

1. Project → Settings → Environment Variables  
2. Add for **Production** (and Preview if needed):

| Name | Value |
|---|---|
| `API_PROXY_TARGET` | `https://….up.railway.app` from step A4 |

3. **Redeploy** the frontend.

4. Login at `/login` and `/finance/login`.

## C. Quick checks

| Symptom | Fix |
|---|---|
| `127.0.0.1:5432 refused` | Missing/wrong `DATABASE_URL`; add Postgres plugin reference |
| `API proxy not configured` | Set Vercel `API_PROXY_TARGET` + redeploy |
| Unexposed service | Generate Domain on Railway |
| CORS / cookie issues | `CORS_ALLOWED_ORIGINS` / `APP_PUBLIC_URL` = production Vercel https URL (preview hosts are derived) |
| `Invalid email or password` / demo-password message | Use Railway `BOOTSTRAP_ADMIN_PASSWORD`, not `admin123`. To rotate: set new password + `BOOTSTRAP_ADMIN_FORCE_PASSWORD=true`, redeploy, then unset force |
| `Too many login attempts` / `RATE_LIMITED` | Failed-password lockout (8 / account / 15 min). Wait for `Retry-After`, or redeploy API to clear in-memory windows. Correct password clears that account's failures. |

Full detail: [`RAILWAY.md`](./RAILWAY.md), [`VERCEL.md`](./VERCEL.md).

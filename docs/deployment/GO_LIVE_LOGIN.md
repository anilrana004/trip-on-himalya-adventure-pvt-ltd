# Go-live: CRM + Finance ERP login (Vercel + Railway)

Do these steps in order. Skipping Postgres or `API_PROXY_TARGET` is why login fails.

## A. Railway API (fixes `127.0.0.1:5432 refused`)

1. **Add Postgres**  
   Project → New → Database → PostgreSQL.  
   Note the service name (default often `Postgres`).

2. **API service → Variables** (Raw Editor). Paste and fill:

```env
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<from ops/gen-prod-secrets.ps1>
WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
EMAIL_WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
SMS_WEBHOOK_SECRET=<from ops/gen-prod-secrets.ps1>
CORS_ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
APP_PUBLIC_URL=https://YOUR-APP.vercel.app
BOOTSTRAP_ADMIN_EMAIL=admin@securetravels.in
BOOTSTRAP_ADMIN_PASSWORD=<strong password>
FINANCE_BOOTSTRAP_PASSWORD=<strong password>
```

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
| CORS / cookie issues | `CORS_ALLOWED_ORIGINS` = exact Vercel URL; leave `COOKIE_DOMAIN` empty |

Full detail: [`RAILWAY.md`](./RAILWAY.md), [`VERCEL.md`](./VERCEL.md).

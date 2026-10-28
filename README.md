# Trip On Himalaya — Basecamp OS

Travel CRM and ERP for a Dehradun Himalayan trek and pilgrimage operator.
One journey: lead, enquiry, quotation, deal, booking, payment, operations
handoff, departure, Customer 360.

**Maintainer:** Anil Singh Rana (`anilrana004`)

The UI says Trip On Himalaya. The Java package remains `com.securetravels`
(see `architecture/adr/0009-product-name-versus-package.md`). Older docs under
`docs/` and `architecture/` still say SecureTravels and still describe early
phases as unfinished. When a doc and the code disagree, trust the code and
this file.

## Stack

Java 25, Spring Boot 3.5, Spring Security, JWT, PostgreSQL 16, Flyway (`V1`–`V41`),
JPA with `ddl-auto: validate`. Next.js 15, React 19, Tailwind 4. The frontend
calls a typed client generated from the OpenAPI spec.

Backend `:8080`. Frontend dev server `:3000`. Docker Compose publishes the UI on
host **3002** (container 3000) because Grafana, when started, uses 3001.
Postgres `:5432`.

```bash
docker compose up --build
```

That Compose file sets `SPRING_PROFILES_ACTIVE=dev`, which is the only profile
that seeds demo users.

Without Docker, from `backend` then `frontend`:

```bash
# backend — demo users only with the dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# frontend
npm install
npm run dev
```

The browser keeps the access token in memory. The refresh token is an HttpOnly
cookie named `toh_refresh`, sent only to `/api/auth`. Next.js proxies `/api` and
forwards that cookie to the API. On `https://app.<domain>` and
`https://api.<domain>`, set `CORS_ALLOWED_ORIGINS` to the exact app origin.
Leave `COOKIE_DOMAIN` empty while the proxy is in front.

A boot with no profile does not seed demo users. The `prod` profile and any
Railway boot never seed them, even if `app.bootstrap-demo-data` is set true.
Railway (`railway.toml`) sets `SPRING_PROFILES_ACTIVE=prod`. That boot refuses
to start when `JWT_SECRET` or `WEBHOOK_SECRET` is missing or still the
checked-in default, or when `EMAIL_WEBHOOK_SECRET` or `SMS_WEBHOOK_SECRET` is
blank. The first real account is `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD` on an empty `users` table, not a demo password.

Demo logins exist only on the `dev` profile:

| Role | Email | Password |
|---|---|---|
| Admin | admin@securetravels.in | admin123 |
| Manager | manager@securetravels.in | manager123 |
| Sales | sales.ravi@securetravels.in | sales123 |
| Sales | sales.meera@securetravels.in | sales123 |
| Ops | ops.suresh@securetravels.in | ops123 |
| Finance | finance@securetravels.in | finance123 |

## Roles

`SALES`, `OPS`, `MANAGER`, `ADMIN`, `CEO`, `FINANCE`, `TRANSPORT`, `VENDOR`.

Sales sees their own leads and the bookings they created. Managers see the team.
Finance, admin, and CEO write money. Transport and vendor users see their
assignments, not the rest of the API.

## What the app actually does

Leads (including an HMAC website webhook), trips and batches, bookings, payments,
operations handoff, tasks, customer 360, dashboards, accounts, pipeline,
forecast, commission, WhatsApp/email/SMS (sandbox unless credentials are set),
workflow rules, Meta ads read APIs, documents with presigned uploads, vendors,
GST invoices and expenses, basecamp attendance, leave, payroll, and inventory,
field incidents, and partner logins.

Not built: Razorpay or Cashfree collection, Google Ads, Keycloak, OpenSearch,
a ticket desk (`/support` is a stub). Prometheus and Swagger are on for local
and test boots. The prod profile does not publish them.

Email and SMS webhooks require a signature. A blank secret is a rejection, not
an open endpoint.

## Checks

```bash
cd backend && mvn -B verify
cd frontend && npm run lint && npm run typecheck && npm run build
```

`mvn verify` needs Postgres at `jdbc:postgresql://127.0.0.1:5432/securetravels_test`
(see `backend/src/test/resources/application-test.yml`).

## Deploy (Vercel + Railway)

**First login:** follow [`docs/deployment/GO_LIVE_LOGIN.md`](docs/deployment/GO_LIVE_LOGIN.md)
(Postgres → Variables → Generate Domain → Vercel `API_PROXY_TARGET`). That fixes
`127.0.0.1:5432` and “API proxy not configured”.

Never commit real secrets. Template: `ops/ENV.production.example`. Secrets:
`ops/gen-prod-secrets.ps1`. Checklist: `docs/operations/PRODUCTION_CHECKLIST.md`.

### Railway (API + Postgres)

1. Deploy from this repo (root Dockerfile / `railway.toml`).
2. Add Postgres; set `DATABASE_URL=${{Postgres.DATABASE_URL}}` (never localhost).
3. Set JWT / webhook secrets + `CORS_ALLOWED_ORIGINS` (exact Vercel origin).
4. Generate public domain; healthcheck `/actuator/health`.
5. Optional daily backups: `infra/backup/` as a separate Cron service + dedicated bucket.

### Vercel (frontend)

1. Import this repo; **Root Directory** = `frontend`.
2. Complete Railway Variables + public domain first.
3. Set `API_PROXY_TARGET` to the Railway HTTPS origin (no `/api` path) → Redeploy.
4. Do not set `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` or any backend secrets.

Browser → Vercel `/api` App Router proxy → Railway. Leave `COOKIE_DOMAIN` empty while
that proxy is in front. Detail: `docs/deployment/VERCEL.md`, `docs/deployment/RAILWAY.md`.

## Layout

```
backend/     Spring Boot API
frontend/    Next.js app
docs/        Design notes + architecture / DR / ops
infra/backup/  Railway Cron PostgreSQL backup image
architecture/adr/   Decisions, including why this stayed one process
ops/         Env examples, Prometheus/Grafana (optional)
```

The old Fastify API and Vite UI were removed from this tree. They remain in
git history.

# Trip On Himalaya — Basecamp OS

Travel CRM and ERP for a Dehradun Himalayan trek and pilgrimage operator.
One journey: lead, enquiry, quotation, deal, booking, payment, operations
handoff, departure, Customer 360.

The UI says Trip On Himalaya. The Java package remains `com.securetravels`
(see `architecture/adr/0009-product-name-versus-package.md`). Older docs under
`docs/` and `architecture/` still say SecureTravels and still describe early
phases as unfinished. When a doc and the code disagree, trust the code and
this file.

## Stack

Java 25, Spring Boot 3.5, Spring Security, JWT, PostgreSQL 16, Flyway (`V1`–`V37`),
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

## Layout

```
backend/     Spring Boot API
frontend/    Next.js app
docs/        Design notes. Several are behind the code.
architecture/adr/   Decisions, including why this stayed one process
ops/         Prometheus and Grafana, optional Compose profile "monitoring"
```

The old Fastify API and Vite UI were removed from this tree. They remain in
git history.

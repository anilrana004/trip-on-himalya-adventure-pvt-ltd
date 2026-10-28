# Existing System Audit — Trip On Himalaya / SecureTravels CRM

> **Phase 0 discovery.** Read-only audit of the repository as of 2026-10-28.  
> No production infrastructure was changed. No credentials are recorded here.  
> Source of truth: `securetravels-crm/` code + config (not aspirational docs alone).

---

## 1. Verified technology stack

| Layer | Verified technology | Evidence |
|---|---|---|
| Frontend | Next.js ^15.3.4, React 19, TypeScript 5.8, Tailwind 4 | `frontend/package.json` |
| Frontend runtime | Node 24 (Docker + CI) | `frontend/Dockerfile`, `.github/workflows/ci.yml` |
| Backend | Spring Boot 3.5.16, Java 25 | `backend/pom.xml` |
| ORM | Spring Data JPA + Hibernate (`ddl-auto: validate`) | `application.yml` |
| Migrations | **Flyway** V1–V41 (PostgreSQL) | `backend/src/main/resources/db/migration/` |
| Database | PostgreSQL 16 (local Compose + CI; Railway plugin intended) | `docker-compose.yml`, `docs/DEPLOYMENT.md` |
| Auth | JWT access (Bearer, ~15m) + HttpOnly refresh cookie `toh_refresh` | `AuthService`, `RefreshCookie` |
| Roles | SALES, OPS, MANAGER, ADMIN, CEO, FINANCE, TRANSPORT, VENDOR | `user/Role.java` |
| Object storage | S3-compatible **presigned PUT** (`STORAGE_*`) | `SignedUploadUrlService` |
| Messaging | Optional RabbitMQ; default **`MESSAGING_MODE=INLINE`** (same JVM) | `railway.toml`, `application.yml` |
| Redis / BullMQ | **Not present** | no dependency / no worker package |
| CI | GitHub Actions: `mvn verify` + frontend lint/typecheck/build; gitleaks | `.github/workflows/` |
| CD | **No automated deploy** from CI | workflows |

**Architecture shape:** modular monolith (single Spring Boot JAR + Next.js app). ADR 0002 explicitly rejects premature microservices.

**Doc drift:** README / older docs still say Flyway through V37 in places; disk has **V41**. Prefer migration folder + `git` over stale prose.

---

## 2. Existing architecture (as implemented)

```text
Browser
  |
  | HTTPS (prod) / same-origin /api
  v
Next.js (Vercel intended; local :3001/:3002)
  | rewrite /api/* → API_PROXY_TARGET
  v
Spring Boot API (Railway intended; local :8080)
  |
  +── PostgreSQL (business data, sessions hashes, assignment_state, Flyway)
  +── S3-compatible storage (documents via presign; MinIO locally)
  +── Optional RabbitMQ (only if MESSAGING_MODE=BROKER)
  +── External: website webhook HMAC, Interakt WhatsApp (sandbox default),
  |             Meta Ads/Lead Ads (code present; META_* often unset),
  |             SES / MSG91 (sandbox until mode flipped)
  +── @Scheduled jobs in-process (follow-ups, seat holds, capacity, attendance, …)
```

### Frontend ↔ backend

1. Browser calls same-origin `/api/...` with `Authorization: Bearer` + `credentials: "include"`.
2. `frontend/next.config.ts` rewrites `/api/:path*` → `${API_ORIGIN}/api/:path*`.
3. Prod: Vercel `API_PROXY_TARGET` = Railway public API URL. Cookie stays host-only on the **app** origin (`COOKIE_DOMAIN` empty) — see `docs/DEPLOYMENT.md` §0.

### Backend ↔ PostgreSQL

- Env: `DB_URL` / `DB_USER` / `DB_PASSWORD`.
- Railway: `RailwayEnvironmentPostProcessor` maps `DATABASE_URL` / `POSTGRES_URL` / `DATABASE_PRIVATE_URL` → JDBC.
- Hikari pool size 10; Flyway on boot; JPA validate-only (no Hibernate DDL invent).

### Neon / Supabase

- **No Neon or Supabase references** in the repository.
- Current documented target: **Railway Postgres plugin** beside the API service.

---

## 3. Database structure (high level)

Business domain lives in PostgreSQL tables managed by Flyway. Major areas:

| Domain | Examples |
|---|---|
| Identity | `users`, refresh tokens, login sessions (V40–V41) |
| Sales journey | `leads`, tasks/follow-ups, bookings, payments, customers/360 |
| Catalogue | `trips`, batches, reviews/FAQs/highlights/tags/waypoints (V29+) |
| Ops | handoffs, vendors, compliance, incidents (V36) |
| Finance | expenses, invoices/payouts, targets |
| Marketing | Meta leadgen events (V28) |
| Automation | workflow definitions/runtime |
| Assignment | `assignment_state`, `webhook_logs` (V6) |
| HR | attendance punches/day rules (V38–V39), leave |

ERD sketch: `architecture/diagrams/erd.md` (may lag latest migrations).

---

## 4. Deployment topology

| Surface | Config | Notes |
|---|---|---|
| API | Root + `backend/railway.toml`, Docker Temurin 25 | Healthcheck `/actuator/health`, timeout 300s |
| UI | `frontend/vercel.json` (`framework: nextjs`) | Root Directory = `frontend` |
| Local | `docker-compose.yml` | Postgres 16 + API + UI; optional Prometheus/Grafana profile |
| Secrets template | `ops/ENV.production.example` | Never commit real values |
| Prod profile | `application-prod.yml` | Actuator = health only; swagger off; ECS JSON logs; demo seed off |

**Production readiness of hosting:** Docs and Docker/Railway/Vercel config exist. Whether a live Railway/Vercel project is provisioned and secret-complete is **unknown without dashboard access** — treat as “configured in repo, verify in ops console.”

---

## 5. Authentication flow

1. `POST /api/auth/login` → access JWT + set HttpOnly refresh cookie.
2. API calls use Bearer access token; refresh via `/api/auth` cookie path.
3. Refresh tokens stored as **SHA-256 hashes**; rotate-on-use; reuse kills family (ADR 0010).
4. Login sessions track presence / day hours (V40–V41).
5. Spring Security **STATELESS**; `@PreAuthorize` + service ownership. Partner roles (TRANSPORT/VENDOR) scoped to partner desk.
6. Prod boot: `ProdSecretsValidator` refuses weak/default JWT, blank webhook secrets, CORS `*` / localhost.

---

## 6. External dependencies (business-critical vs optional)

| Integration | Criticality | Status in code |
|---|---|---|
| PostgreSQL | **Critical** | Required |
| Website lead webhook | High (inbound demand) | Built + HMAC |
| Meta Lead Ads / Ads insights | High (intended primary lead source) | Built; needs `META_*` |
| Object storage | High when documents in use | Presign; needs `STORAGE_*` |
| WhatsApp (Interakt) | Medium | Sandbox default |
| Email (SES) / SMS (MSG91) | Medium | Sandbox until live mode |
| RabbitMQ | Low currently | INLINE avoids broker |
| Razorpay / Cashfree | Planned | **Not built** |
| Redis | Not required today | Absent |

---

## 7. Current backup coverage

| Piece | Path | State |
|---|---|---|
| Policy + RTO/RPO targets | `docs/DISASTER_RECOVERY.md` | Documented (RTO &lt; 6h, RPO ≤ 24h aspirational) |
| `pg_dump -Fc` script | `scripts/backup-postgres.sh` | Implemented; local self-test / MinIO drill documented |
| systemd timer | `scripts/systemd/securetravels-backup.*` | Written; **not installed** (VPS-era design) |
| Provider PITR | Railway / Neon | **Not verified active** in this audit |
| Independent backup bucket | Intended via `STORAGE_*` under `backups/postgres/` | Same vars as docs bucket — **should be separate bucket/account in prod** |
| Client encryption | Optional `BACKUP_AGE_PASSPHRASE` (age) | Opt-in |
| Alerts for missed backup | Not automated in Railway cron yet | Gap |

**Verdict:** Backup *capability* exists as a script; **production-scheduled independent backups on Railway are not evidenced as running.**

---

## 8. Findings by severity

### P0 — Critical (data-loss or security)

| ID | Finding | Notes |
|---|---|---|
| P0-1 | **No verified automated off-box backup on Railway** | Script exists; systemd is VPS-shaped; risk if only provider snapshot assumed |
| P0-2 | **Prod secrets / Meta / storage may be incomplete on live hosts** | Boot validator helps API; Meta leadgen + documents fail closed or soft-fail if unset |
| P0-3 | **Large dirty working tree on `main` (ahead 10 of `himalaya/main`)** | Uncommitted product work (presence, distribution, phone UI, Flyway V29–V41). Risk of lost work or accidental incomplete deploy |

### P1 — Production reliability

| ID | Finding | Notes |
|---|---|---|
| P1-1 | CI has **no deploy**; human Railway/Vercel promotion | Rollback documented; still operator-dependent |
| P1-2 | Flyway runs **on every API boot** | Acceptable for single replica; multi-replica needs care (leader/migration job) |
| P1-3 | Health is `/actuator/health` only in prod | Good; dedicated `/health/live` vs `/health/ready` naming not separate public paths (groups exist on actuator) |
| P1-4 | In-process `@Scheduled` + INLINE messaging | Fine at early scale; multi-instance duplicates schedules unless locked |
| P1-5 | Rate limit is in-memory (Bucket4j) | Weak under horizontal scale |
| P1-6 | Backup + document storage share `STORAGE_*` design | Docs warn to use separate backup bucket — enforce operationally |

### P2 — Performance / maintainability

| ID | Finding | Notes |
|---|---|---|
| P2-1 | Doc drift (Flyway version, INTEGRATIONS vs observability) | Confuses operators |
| P2-2 | Hikari max 10 | Tune with Railway Postgres connection limits |
| P2-3 | OpenAPI / frontend `generated.ts` can lag DTOs | Manual sync risk |
| P2-4 | Finance shell still desktop-oriented vs phone CRM shells | UX debt, not infra |

### P3 — Optional / future

| ID | Finding | Notes |
|---|---|---|
| P3-1 | Neon evaluation | Only if Railway Postgres cost/limits or branching justify migration |
| P3-2 | Redis / BullMQ | Only if schedule duplication or heavy async queues appear |
| P3-3 | Kafka | Explicitly gated (ADR 0007) |
| P3-4 | Payment gateways | Product gap, not hosting |

---

## 9. Security risks (concise)

- Dev defaults for JWT/webhooks in `application.yml` — **blocked on prod profile** by `ProdSecretsValidator`.
- CSRF disabled (Bearer SPA pattern); relies on CORS allowlist + cookie path scoping.
- Public webhook paths must keep HMAC verification.
- `backend/src/.env` may exist locally (gitignored) — never force-add.
- Demo credentials in README are for **dev** only.
- Grafana anonymous viewer in Compose — local monitoring only.

---

## 10. Performance / scaling limitations

- Single modular monolith: correct for current stage.
- Horizontal API scale without Redis/leader election → duplicate cron + weaker rate limits.
- Connection pool and Railway Postgres plan limits will hit before CPU if unpooled serverless clients appear (Next does not talk to DB — good).
- Meta lead bursts already use sticky assignment + RR; DB remains source of truth.

---

## 11. Recommended improvements (priority order)

1. **Preserve and commit/branch** the large uncommitted CRM work (do not discard).
2. **Confirm live Railway Postgres + PITR/snapshots** and whether any backup cron exists.
3. Adapt backup to a **Railway scheduled job / sidecar** using a **dedicated backup bucket** (R2 or S3-compatible), not VPS systemd alone.
4. Complete **production checklist** secrets (JWT, webhooks, CORS, `APP_PUBLIC_URL`, Meta, storage).
5. Keep Neon as an **optional evaluation**, not a default migration.
6. Defer Redis until multi-instance or job backlog requires it.
7. Separate liveness/readiness documentation and optional thin wrappers only if Railway needs them.
8. Refresh operator docs under `docs/architecture/` + link from README (this file + plan).

---

## 12. What must not be redesigned without cause

- Spring Boot + Flyway + JPA validate
- Next.js + `/api` rewrite proxy
- JWT + HttpOnly refresh model
- INLINE messaging default
- Lead → booking → payment journey in Postgres
- Existing Modular monolith / ADR decisions

---

*End of Phase 0 audit.*

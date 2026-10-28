# Implementation Plan — Production Hardening (Phases 1–11)

> Built after Phase 0 audit (`EXISTING_SYSTEM_AUDIT.md`).  
> **No production credentials, Neon cutover, or paid provisioning in this step.**  
> **STOP for explicit approval** before any destructive DB action, paid resource, or live secret rotation.

---

## 0. Safety baseline (checked 2026-10-28)

| Check | Result |
|---|---|
| Git root | `securetravels-crm` (remote tracking `himalaya/main`) |
| Branch | `main`, **ahead 10** of `himalaya/main` |
| Working tree | **Large dirty tree** — many modified + untracked files (presence, Meta, lead distribution, phone UI, Flyway V29–V41, etc.) |
| Action | **Do not discard, reset, or force-push.** Prefer a feature branch / commit slices when the owner requests commits |
| Live DB | Local/dev Postgres exercised in this workspace; **production data presence unknown** without Railway console |
| Existing backups | Script + DR doc exist; **prod schedule not verified** |
| Baseline tests (recent session) | `RoundRobinStickyTest` + `MetaLeadgenServiceTest` green; earlier `DashboardAndTargetsIT` / presence suites used in prior work. Full `mvn verify` + frontend build **not re-run as a freeze gate in this Phase 1 doc pass** — run before merge |

### Rollback philosophy

- Application: Railway / Vercel previous deployment promotion (`docs/DEPLOYMENT.md` §0).
- Schema: Flyway forward-only; avoid destructive down migrations; expand → dual-write → contract.
- Data: restore into **isolated** DB only; never restore over prod by default (`docs/DISASTER_RECOVERY.md`).

---

## 1. What is genuinely required vs reuse

### Reuse (do not reinvent)

| Component | Path / note |
|---|---|
| API Docker + Railway healthcheck | `Dockerfile`, `railway.toml` |
| Prod secret gate | `ProdSecretsValidator` |
| Railway DB URL mapping | `RailwayEnvironmentPostProcessor` |
| Backup script | `scripts/backup-postgres.sh` |
| DR policy | `docs/DISASTER_RECOVERY.md` |
| Env template | `ops/ENV.production.example` |
| CI verify | `.github/workflows/ci.yml` |
| Observability local stack | `ops/observability/` |
| Auth / roles / Flyway | existing modules |

### Required gaps (implementation candidates)

| Priority | Change | Why |
|---|---|---|
| P0 | Verify / install **scheduled independent Postgres backups** on Railway (or documented managed PITR + dump) | Data-loss risk |
| P0 | Dedicated backup object store (R2/S3) + optional age encryption | Independence from app docs bucket |
| P0 | Protect developer WIP (branch/commit plan) | Avoid losing uncommitted CRM work |
| P1 | Production checklist execution (secrets, CORS, Meta, storage, domains) | Boot + integrations |
| P1 | Document / optional thin live vs ready health if ops needs it | Railway already uses actuator |
| P1 | Multi-instance schedule safety (shedlock or single worker) **when** scaling past 1 API replica | Reliability |
| P2 | Doc consolidation under `docs/architecture/` + cost/scaling | Maintainability |
| P2 | Backup failure / missing-backup alerts via existing notifier | Observability |
| P3 | Neon evaluation only if Railway Postgres fails cost/limits/latency test | Avoid needless migration |
| P3 | Redis only if rate-limit or job fan-out demands it | Cost |

### Explicitly **out of scope** until approved

- Migrating production data to Neon
- Adding Kubernetes / Kafka / second CRM database
- Replacing Flyway or Spring Data JPA
- Moving business logic into Vercel
- Silent paid Cloudflare / Redis / Neon provisioning
- Destructive restore into production

---

## 2. Database decision (Phase 3 recommendation)

| Option | Recommendation |
|---|---|
| **Keep Railway Postgres (or current Railway-attached PG)** | **Default.** Already integrated (`DATABASE_URL` post-processor), low migration risk, matches `DEPLOYMENT.md`. |
| Neon | **Evaluate later** if: branching/PITR UX, free-tier math, or cold-start tradeoffs win a written comparison. Requires export → staging restore → approval → cutover. |
| Supabase | Only if product already depends on Supabase features (it does not). |

**Decision for now:** **Retain PostgreSQL on the current Railway-oriented path. Do not migrate to Neon without a separate approval packet.**

Connection pooling, TLS, Flyway-on-boot, and `ddl-auto: validate` stay as-is for single-replica early production. Revisit Flyway leadership when adding a second API replica.

---

## 3. Backup / DR plan (Phases 4–5) — design only until approved

Target (aligns with existing script + master prompt):

```text
Railway Postgres
  ├── Provider snapshots / PITR (confirm in console)
  └── Scheduled pg_dump -Fc (Railway Cron service or one-off job image)
          → validate (pg_restore --list)
          → optional age encrypt
          → upload to dedicated R2/S3 prefix backups/postgres/
          → alert on failure / missing day
```

**Reuse:** `scripts/backup-postgres.sh` (adapt Dockerfile/entrypoint under `infra/backup/` **only if** systemd path is insufficient for Railway).

**Do not:** run dumps inside user HTTP requests; share deletion rights with the app IAM user; claim RPO/RTO until a restore drill is logged against an isolated DB.

**Docs to extend (prefer edit over duplicate):**

- `docs/DISASTER_RECOVERY.md`
- Later: `docs/disaster-recovery/BACKUP_POLICY.md`, `RESTORE_RUNBOOK.md`, `RECOVERY_TEST.md` as thin wrappers/links if structure is required by handover

---

## 4. Railway / Vercel hardening (Phases 6–7) — incremental

Only add what is missing after verifying live config:

| Item | Status in repo | Next action |
|---|---|---|
| Graceful shutdown / OOM exit | Docker `ExitOnOutOfMemoryError` | Confirm Railway stop timeout |
| Healthcheck | `/actuator/health` | Keep; document liveness/readiness groups |
| Structured logs | ECS JSON in prod | Keep |
| CORS / cookies | Validator + docs | Set exact app origin in dashboard |
| Webhook HMAC | Present | Keep Meta/website secrets filled |
| Separate `/health/live` & `/health/ready` | Actuator groups | Optional aliases — **not blocking** |
| Vercel `API_PROXY_TARGET` | Documented | Verify in Vercel env |
| No backend secrets on `NEXT_PUBLIC_*` | Example warns | Enforce in checklist |

---

## 5. Redis / workers (Phase 8)

**Do not add Redis/BullMQ now.** Scheduling and automation already run in-process. Introduce Redis only with a measured need (multi-instance rate limit, shared locks, or a dedicated worker service).

---

## 6. Cost sketch (Phase 9) — early CRM

Order-of-magnitude **for planning only** (verify current vendor pricing before budgeting):

| Service | Early-stage approach |
|---|---|
| Vercel | Hobby/Pro — Next SSR + rewrites |
| Railway API | One service, right-size RAM (Docker MaxRAMPercentage already set) |
| Railway Postgres | Plugin plan; watch storage + connections |
| Object storage | Cloudflare R2 or S3 — docs + **separate** backups |
| Redis | $0 until required |
| Email/SMS | Sandbox until volume justifies SES/MSG91 spend |
| Monitoring | Railway logs + `/actuator/health`; Prometheus optional locally |

Full write-up deferred to `docs/operations/COST_AND_SCALING.md` after console plan names are confirmed.

---

## 7. Files likely to change (when implementation resumes)

| Area | Likely paths |
|---|---|
| Backup on Railway | `infra/backup/*` (new) **or** docs + existing `scripts/backup-postgres.sh` |
| Ops docs | `docs/architecture/*`, `docs/operations/*`, `docs/disaster-recovery/*` (links/wrappers) |
| Optional health aliases | thin controller only if needed |
| Env examples | `ops/ENV.production.example` (backup bucket vars) |
| **Avoid touching** | Unrelated CRM UI/business logic except when fixing P0 regressions |

**Compatibility risks:** Flyway V29–V41 in working tree must ship with the same deploy as Java entities; partial deploy = boot failure (`ddl-auto: validate`).

---

## 8. Verification strategy

1. `mvn -B verify` (backend) against Postgres 16.
2. `npm ci && npm run lint && npx tsc --noEmit && npm run build` (frontend).
3. Prod-profile boot against empty + restored dump (local), secrets validator paths.
4. `./scripts/backup-postgres.sh --self-test` then dry-run dump to non-prod bucket.
5. Isolated restore drill; record counts for leads/users/bookings.
6. Smoke: login, refresh cookie via proxy, create lead, complete first-call task, dashboard summary.

---

## 9. Estimated operational costs

| Item | Estimate class |
|---|---|
| Engineering (this hardening track) | Docs + backup packaging + checklist: small; Neon migration: large |
| New paid services | Backup storage only if not already provisioned; Redis/Neon **$0 until approved** |
| Ongoing | Railway + Vercel + PG + object storage — dominate; backups should be a small fraction of DB size |

Exact INR/USD figures require live plan SKUs — do not invent.

---

## 10. Approval gates (STOP)

**Request explicit approval before:**

1. Creating paid Cloudflare R2 / Neon / Redis resources.
2. Any production database migration or cutover.
3. Rotating production JWT / webhook / storage keys (coordinate downtime).
4. Installing a cron that can read prod DB credentials.
5. Force-push, hard reset, or discarding the dirty working tree.
6. Claiming production readiness without a logged restore drill.

---

## 11. Proposed next execution order (after approval)

```text
A. Owner commits or branches WIP on main (preserve work)
B. Confirm Railway Postgres backup/PITR + Vercel/Railway env checklist (manual)
C. Package backup runner for Railway Cron + dedicated bucket (code + docs)
D. Isolated restore drill + alert hook
E. Optional: health path aliases, COST_AND_SCALING.md, FINAL_ARCHITECTURE.md
F. Full CI baseline green on the release branch
```

---

## 12. Immediate deliverables of this phase

| Deliverable | Status |
|---|---|
| `docs/architecture/EXISTING_SYSTEM_AUDIT.md` | Written |
| `docs/architecture/IMPLEMENTATION_PLAN.md` | Written (this file) |
| `infra/backup/` Railway Cron image + restore/verify | **Packaged (2026-10-28)** — not provisioned in cloud |
| DR / ops / deployment doc set | Written / linked |
| Neon migration | **Not started** (deferred) |
| Redis | **Not started** (deferred) |
| Live Railway cron + paid R2 bucket | **Requires operator approval + dashboard work** |

---

*Phase 1 docs + Phase 4 packaging (in-repo) done. Cloud provisioning still gated on operator action.*

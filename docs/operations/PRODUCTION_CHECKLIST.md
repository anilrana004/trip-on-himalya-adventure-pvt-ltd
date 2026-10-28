# Production checklist

Use with [`../DEPLOYMENT.md`](../DEPLOYMENT.md) and [`../../ops/ENV.production.example`](../../ops/ENV.production.example).  
Do not paste real secrets into tickets or git.

## A. Git / release hygiene

- [ ] Uncommitted CRM WIP reviewed; release branch or commit slices agreed
- [ ] Flyway migrations in the image match entity code (`ddl-auto: validate`)
- [ ] CI green on the commit you deploy (`.github/workflows/ci.yml`)

## B. Railway — API

- [ ] Service builds from repo `Dockerfile` / `railway.toml`
- [ ] `SPRING_PROFILES_ACTIVE=prod`
- [ ] `DB_URL` / `DB_USER` / `DB_PASSWORD` **or** plugin `DATABASE_URL` mapped
- [ ] `JWT_SECRET` strong (≥ 32 bytes random)
- [ ] `WEBHOOK_SECRET`, `EMAIL_WEBHOOK_SECRET`, `SMS_WEBHOOK_SECRET` set
- [ ] `CORS_ALLOWED_ORIGINS` = exact app origin (no `*`, no localhost)
- [ ] `APP_PUBLIC_URL` = public app URL (follow-up emails)
- [ ] `COOKIE_DOMAIN` empty while Next proxies `/api`
- [ ] Healthcheck `/actuator/health` passing before traffic switch
- [ ] Custom domain `api.<domain>` (optional but recommended)

## C. Vercel — frontend

- [ ] Root Directory = `frontend`
- [ ] `API_PROXY_TARGET` = Railway HTTPS API origin
- [ ] No `NEXT_PUBLIC_*` secrets
- [ ] `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` unset
- [ ] Custom domain `app.<domain>`

## D. Storage

- [ ] Documents bucket: `STORAGE_*` on API service
- [ ] **Backup bucket separate** (cron service only) — Put-only keys preferred
- [ ] Bucket not public

## E. Backups (manual provision — approval)

- [ ] Railway Cron service from `infra/backup/Dockerfile`
- [ ] Schedule daily (e.g. 01:00 UTC)
- [ ] First successful object under `backups/postgres/`
- [ ] Failure notification enabled
- [ ] Isolated restore drill logged in `docs/disaster-recovery/RECOVERY_TEST.md`
- [ ] Provider snapshot / PITR status recorded

## F. Integrations

- [ ] Meta: `META_*` if Lead Ads live; webhook verified
- [ ] WhatsApp / SES / MSG91 modes intentional (sandbox vs live)
- [ ] Website form webhook HMAC matches `WEBHOOK_SECRET`

## G. Smoke after deploy

- [ ] Login + refresh (cookie via app host)
- [ ] Create / list lead
- [ ] Tasks / first-call visible
- [ ] Dashboard summary loads
- [ ] Document upload (if storage configured)
- [ ] `/actuator/health` → UP (no details leak)

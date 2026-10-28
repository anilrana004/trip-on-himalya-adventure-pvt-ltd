# Railway (API + Postgres + optional backup cron)

Primary deploy narrative: [`../DEPLOYMENT.md`](../DEPLOYMENT.md) §0.

## API service

- Builder: Dockerfile at repo root (or `backend/`).
- Health: `/actuator/health` (see `railway.toml`).
- Profile: `SPRING_PROFILES_ACTIVE=prod`.
- DB: Postgres plugin → `DATABASE_URL` mapped by `RailwayEnvironmentPostProcessor`, or explicit `DB_*`.

## Backup cron (optional second service)

- Dockerfile: `infra/backup/Dockerfile`
- Config sketch: `infra/backup/railway.toml`
- Env: production DB URL + **backup-only** `STORAGE_*`
- Schedule: daily; alert on failure

Do not mount a volume on the API service for Postgres data — use the plugin.

## Rollback

Redeploy the previous successful Railway deployment. Coordinate with Vercel if the API contract changed.

# Restore runbook

Safety wrapper: [`../../infra/backup/restore.sh`](../../infra/backup/restore.sh).  
Never restore into production by default.

## Preconditions

- Isolated PostgreSQL 16 database (name e.g. `securetravels_restore`).
- Dump file obtained from the backup bucket (or local drill artifact).
- `CONFIRM_RESTORE=YES` set consciously.
- For remote managed hosts: `FORCE_REMOTE_RESTORE=YES` only after approval.
- For names containing `prod` / `production` / `live`: `FORCE_PROD_RESTORE=YES` only after written approval.

## Steps

1. Download object `backups/postgres/<db>-<stamp>.dump` (and `.sha256` if present).
2. `./infra/backup/verify.sh /path/to/file.dump`
3. Create empty destination DB.
4. Restore:

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=… \
       PGDATABASE=securetravels_restore CONFIRM_RESTORE=YES
./infra/backup/restore.sh /path/to/file.dump
```

5. Point a **non-production** API instance at that DB.
6. Prefer Flyway **validate** against the restored schema (dump already includes schema history). Do not casually re-migrate a full restore unless you know why.
7. Smoke: `/actuator/health`, login, spot-check `leads` / `bookings` / `payments` counts vs manifest.
8. Tear down the scratch DB when done; record the drill in [`RECOVERY_TEST.md`](RECOVERY_TEST.md) and [`../DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md).

## Scenario pointers

| Scenario | First moves |
|---|---|
| Frontend outage | Check Vercel; API/DB untouched |
| Backend outage | Railway logs → redeploy previous; preserve DB |
| Accidental row delete | Prefer PITR into isolated DB if available; else selective extract from dump |
| DB corruption | Stop writers; preserve evidence; restore to clean instance; controlled cutover |
| Provider failure | New PG + restore from independent bucket; redeploy API; re-point `API_PROXY_TARGET` |
| Security compromise | Isolate, revoke secrets, restore clean point, rotate, reopen |

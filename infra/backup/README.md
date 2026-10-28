# PostgreSQL backup job (Railway Cron / container)

Reuses `scripts/backup-postgres.sh`. This image does **not** start the CRM API.

## Build

From repository root:

```bash
docker build -f infra/backup/Dockerfile -t securetravels-backup .
```

## Run locally

```bash
docker run --rm \
  -e DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:5432/securetravels_crm' \
  -e STORAGE_ENDPOINT=http://host.docker.internal:9000 \
  -e STORAGE_REGION=us-east-1 \
  -e STORAGE_BUCKET=securetravels-backups \
  -e STORAGE_ACCESS_KEY=… \
  -e STORAGE_SECRET_KEY=… \
  securetravels-backup
```

Self-test only:

```bash
docker run --rm securetravels-backup self-test
```

## Railway

See `railway.toml` in this folder and `docs/disaster-recovery/BACKUP_POLICY.md`.

**Approval required** before creating a paid bucket or attaching production `DATABASE_URL` to a cron service.

## Commands

| Arg | Behaviour |
|---|---|
| (default) / `backup` | SigV4 self-test then full dump + upload |
| `self-test` | Signer only |
| `dry-run` | Dump + validate; skip upload |
| `restore` | Delegates to `restore.sh` (needs `CONFIRM_RESTORE=YES`) |
| `verify` | Local dump integrity |

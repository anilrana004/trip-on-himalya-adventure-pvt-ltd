# Backup policy

Canonical narrative and drill log: [`../DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md).  
Runner image: [`../../infra/backup/`](../../infra/backup/).

## Objectives (targets — not SLAs until drilled in prod)

| Metric | Target | Notes |
|---|---|---|
| RPO | ≤ 24 h initially | Daily `pg_dump -Fc`; improve if Railway PITR confirmed |
| RTO | &lt; 6 h | Local drills measured seconds; prod network/size TBD |
| Retention | 30 days daily objects | Configure **bucket lifecycle** (script never deletes remote objects) |

## What is backed up

- Full logical dump of the CRM PostgreSQL database (`pg_dump -Fc`).
- Optional client-side encryption when `BACKUP_AGE_PASSPHRASE` is set (requires `age` in the image — not installed by default; add only if you enable encryption).

## What is not covered by this job

- Object-storage document bytes (use bucket versioning / separate lifecycle on the **documents** bucket).
- Vercel / Railway app config (export env from dashboards periodically).
- Secrets (password manager / Railway shared variables — rotate on compromise).

## Schedule

| Environment | Mechanism | Suggested cadence |
|---|---|---|
| Production | Railway Cron service (`infra/backup`) | `0 1 * * *` UTC daily |
| Legacy VPS | `scripts/systemd/securetravels-backup.timer` | Same |
| Dev | Manual / `--dry-run` | As needed |

Make schedule configurable in the Railway Cron UI.

## Storage rules

1. Use a **dedicated backup bucket** (or account), not the documents `STORAGE_BUCKET`.
2. Prefix: `backups/postgres/` (override with `BACKUP_PREFIX`).
3. Prefer private bucket; no public ACLs.
4. Prefer separate access keys with **PutObject** only (no DeleteObject if the provider allows).
5. Do not store age passphrases next to the dumps.

## Validation on every run

1. Non-empty dump ≥ `BACKUP_MIN_BYTES`.
2. `pg_restore --list` succeeds.
3. Upload HTTP 2xx.
4. Job exit code ≠ 0 on any failure (platform alert hook).

## Monitoring

Alert when:

- Cron / container exits non-zero
- No successful object under `backups/postgres/` for &gt; 36 hours (manual or external check)
- Storage auth failures (403)

Wire alerts in Railway notifications or an existing email path — do not add a second email vendor solely for backups.

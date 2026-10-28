# Dedicated PostgreSQL backup job for Railway Cron (or any container host).
# Does NOT run the CRM API. Uses the same scripts/backup-postgres.sh the VPS
# systemd unit already exercises.
#
# Build from repo root:
#   docker build -f infra/backup/Dockerfile -t securetravels-backup .
#
# Required env (see ops/ENV.production.example § Backup):
#   DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE
#   STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY
# Optional:
#   BACKUP_PREFIX, BACKUP_AGE_PASSPHRASE, BACKUP_MIN_BYTES, BACKUP_RETAIN_DAYS

FROM postgres:16-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl openssl ca-certificates xxd bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /backup
COPY scripts/backup-postgres.sh /backup/backup-postgres.sh
COPY infra/backup/entrypoint.sh /backup/entrypoint.sh
COPY infra/backup/restore.sh /backup/restore.sh
COPY infra/backup/verify.sh /backup/verify.sh
# Strip Windows CRLF so shebangs work when the repo is checked out on Windows.
RUN sed -i 's/\r$//' /backup/*.sh \
    && chmod +x /backup/*.sh

# Non-root: postgres image already has uid 999 (postgres).
USER postgres
ENTRYPOINT ["/backup/entrypoint.sh"]

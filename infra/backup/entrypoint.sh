#!/usr/bin/env bash
# Railway Cron / one-shot entrypoint. Exits non-zero on any backup failure so
# the platform can mark the job failed (wire alerts on that).
set -Eeuo pipefail

cd /backup

case "${1:-backup}" in
  backup|"")
    ./backup-postgres.sh --self-test
    exec ./backup-postgres.sh
    ;;
  self-test)
    exec ./backup-postgres.sh --self-test
    ;;
  dry-run)
    ./backup-postgres.sh --self-test
    exec ./backup-postgres.sh --dry-run
    ;;
  restore)
    shift
    exec ./restore.sh "$@"
    ;;
  verify)
    shift
    exec ./verify.sh "$@"
    ;;
  *)
    echo "usage: entrypoint.sh [backup|self-test|dry-run|restore|verify] …" >&2
    exit 2
    ;;
esac

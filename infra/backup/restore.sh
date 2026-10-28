#!/usr/bin/env bash
# Restore a pg_dump -Fc archive into an EXPLICIT destination database.
# Never defaults to production hostnames. Requires typed confirmation.
#
# Usage:
#   PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… PGDATABASE=securetravels_restore \
#     ./restore.sh /path/to/backup.dump
#
# Safety:
#   - Refuses empty args
#   - Refuses destination names that look like production unless FORCE_PROD_RESTORE=YES
#   - Requires CONFIRM_RESTORE=YES
set -Eeuo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

DUMP="${1:-}"
[ -n "$DUMP" ] || die "usage: restore.sh <dump-file.dump>"
[ -f "$DUMP" ] || die "dump not found: $DUMP"

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required (destination database name)}"
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD is required}"
PGPORT="${PGPORT:-5432}"

case "$PGDATABASE" in
  *prod*|*production*|*live*)
    [ "${FORCE_PROD_RESTORE:-}" = "YES" ] \
      || die "destination '${PGDATABASE}' looks production — set FORCE_PROD_RESTORE=YES only after explicit approval"
    ;;
esac

case "${PGHOST}" in
  *railway*|*amazonaws*|*neon.tech*|*supabase*)
    [ "${FORCE_REMOTE_RESTORE:-}" = "YES" ] \
      || die "host '${PGHOST}' looks remote managed PG — restore into an isolated DB and set FORCE_REMOTE_RESTORE=YES"
    ;;
esac

[ "${CONFIRM_RESTORE:-}" = "YES" ] \
  || die "set CONFIRM_RESTORE=YES to acknowledge this will write to ${PGHOST}/${PGDATABASE}"

command -v pg_restore >/dev/null 2>&1 || die "pg_restore not on PATH"

log "listing archive TOC"
pg_restore --list "$DUMP" >/dev/null || die "dump failed integrity list"

log "restoring into ${PGHOST}:${PGPORT}/${PGDATABASE} (clean, if-exists)"
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --clean --if-exists --no-owner --no-privileges \
  "$DUMP" || die "pg_restore FAILED"

log "restore COMPLETE — boot API against this DB with flyway validate (do not migrate over a full dump blindly)"

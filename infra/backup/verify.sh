#!/usr/bin/env bash
# Verify a local dump file (TOC + optional sha256) without touching a database.
set -Eeuo pipefail

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

DUMP="${1:-}"
[ -n "$DUMP" ] || die "usage: verify.sh <dump-file.dump>"
[ -f "$DUMP" ] || die "not found: $DUMP"

command -v pg_restore >/dev/null 2>&1 || die "pg_restore not on PATH"

size="$(wc -c < "$DUMP" | tr -d ' ')"
[ "$size" -ge "${BACKUP_MIN_BYTES:-1024}" ] || die "file too small (${size} bytes)"

if [ -f "${DUMP}.sha256" ]; then
  ( cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256" ) \
    || die "sha256 mismatch"
  log "sha256 OK"
fi

entries="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
[ "$entries" -gt 0 ] || die "TOC empty"
log "verify OK (${size} bytes, ${entries} TOC entries)"

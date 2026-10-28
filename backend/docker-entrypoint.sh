#!/bin/sh
# Production entrypoint for Trip On Himalaya CRM API on Railway.
# 1) Prefer DATABASE_URL (Railway Postgres).
# 2) Ignore / override leftover laptop DB_URL=127.0.0.1.
# 3) Export JDBC form so Spring never falls back to localhost.

set -eu

echo "[entrypoint] SecureTravels CRM API starting"

# Pick the best raw URL (Railway plugin first — never concatenate).
RAW=""
if [ -n "${DATABASE_URL:-}" ]; then
  RAW="$DATABASE_URL"
elif [ -n "${DATABASE_PRIVATE_URL:-}" ]; then
  RAW="$DATABASE_PRIVATE_URL"
elif [ -n "${POSTGRES_URL:-}" ]; then
  RAW="$POSTGRES_URL"
elif [ -n "${DB_URL:-}" ]; then
  RAW="$DB_URL"
elif [ -n "${SPRING_DATASOURCE_URL:-}" ]; then
  RAW="$SPRING_DATASOURCE_URL"
fi

if [ -z "$RAW" ]; then
  echo "================================================================"
  echo "FATAL: No DATABASE_URL set."
  echo "Railway → API → Variables → Add Reference → Postgres → DATABASE_URL"
  echo "See docs/deployment/GO_LIVE_LOGIN.md"
  echo "================================================================"
  exit 1
fi

case "$RAW" in
  *'${{'*)
    echo "FATAL: DATABASE_URL was not resolved (still contains \${{...}})."
    echo "Use Variable Reference to Postgres.DATABASE_URL, then redeploy."
    exit 1
    ;;
  *127.0.0.1*|*localhost*|*'[::1]'*)
    echo "FATAL: Chosen DB URL is localhost. Delete laptop DB_URL and set Railway DATABASE_URL."
    exit 1
    ;;
esac

# Convert postgres(ql)://user:pass@host:port/db → jdbc:postgresql://host:port/db
# and export user/password for Spring.
case "$RAW" in
  jdbc:postgresql://*)
    export DB_URL="$RAW"
    ;;
  postgres://*|postgresql://*)
    # strip scheme
    REST="$RAW"
    REST="${REST#postgres://}"
    REST="${REST#postgresql://}"
    USERINFO="${REST%%@*}"
    HOSTPART="${REST#*@}"
    DB_USER_VAL="${USERINFO%%:*}"
    DB_PASS_VAL="${USERINFO#*:}"
    export DB_URL="jdbc:postgresql://${HOSTPART}"
    export DB_USER="${DB_USER:-$DB_USER_VAL}"
    export DB_PASSWORD="${DB_PASSWORD:-$DB_PASS_VAL}"
    ;;
  *)
    echo "FATAL: Unsupported DATABASE_URL scheme. Expected postgres://, postgresql://, or jdbc:postgresql://"
    exit 1
    ;;
esac

# Drop stale localhost overrides from the environment if any slipped through.
# (We already exported the Railway-derived DB_* above.)
case "${SPRING_DATASOURCE_URL:-}" in
  *127.0.0.1*|*localhost*) unset SPRING_DATASOURCE_URL ;;
esac

HOST_ONLY="${DB_URL#jdbc:postgresql://}"
HOST_ONLY="${HOST_ONLY%%/*}"
echo "[entrypoint] datasource host=${HOST_ONLY}"
echo "[entrypoint] PORT=${PORT:-8080} SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE:-}"

# Bind all interfaces; Railway proxies to this PORT.
export SERVER_ADDRESS="${SERVER_ADDRESS:-0.0.0.0}"

exec java -jar /app/app.jar

#!/bin/sh
# Fail before Spring Boot if production has no real Postgres.
# Stops the confusing Hikari "127.0.0.1:5432 refused" restart loop on Railway.

set -eu

has_db=0
url="${DATABASE_URL:-}${POSTGRES_URL:-}${DATABASE_PRIVATE_URL:-}${DB_URL:-}${SPRING_DATASOURCE_URL:-}"

if [ -n "${DATABASE_URL:-}" ] || [ -n "${POSTGRES_URL:-}" ] || [ -n "${DATABASE_PRIVATE_URL:-}" ] || [ -n "${DB_URL:-}" ] || [ -n "${SPRING_DATASOURCE_URL:-}" ]; then
  has_db=1
fi

case "$url" in
  *127.0.0.1*|*localhost*|*'[::1]'*|*0.0.0.0*)
    echo "================================================================"
    echo "FATAL: Database URL points at localhost/127.0.0.1."
    echo "This container is on Railway — there is no Postgres on 127.0.0.1."
    echo ""
    echo "Fix:"
    echo "  1) Railway → New → Database → PostgreSQL"
    echo "  2) API service → Variables → Add DATABASE_URL"
    echo "     Value: Variable Reference → Postgres → DATABASE_URL"
    echo "     (looks like \${{Postgres.DATABASE_URL}})"
    echo "  3) Delete DB_URL / DB_USER / DB_PASSWORD if they contain localhost"
    echo "  4) Redeploy"
    echo "See docs/deployment/GO_LIVE_LOGIN.md"
    echo "================================================================"
    exit 1
    ;;
  *'${{'*)
    echo "================================================================"
    echo "FATAL: DATABASE_URL still contains \${{...}} and was not resolved."
    echo "Add a PostgreSQL service, then use Variable Reference (not plain text)."
    echo "See docs/deployment/GO_LIVE_LOGIN.md"
    echo "================================================================"
    exit 1
    ;;
esac

if [ "$has_db" -eq 0 ]; then
  echo "================================================================"
  echo "FATAL: No DATABASE_URL / DB_URL set."
  echo "Spring would fall back to jdbc:postgresql://127.0.0.1:5432 and crash."
  echo ""
  echo "Fix:"
  echo "  1) Railway → New → Database → PostgreSQL"
  echo "  2) API → Variables → DATABASE_URL = \${{Postgres.DATABASE_URL}}"
  echo "  3) Redeploy"
  echo "See docs/deployment/GO_LIVE_LOGIN.md"
  echo "================================================================"
  exit 1
fi

exec java -jar /app/app.jar

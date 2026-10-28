#!/usr/bin/env bash
# Generate production secrets for Railway Variables.
# Usage: bash ops/gen-prod-secrets.sh
set -euo pipefail

gen() { openssl rand -base64 "$1" | tr -d '\n'; echo; }

echo "Paste these into Railway → your API service → Variables:"
echo
echo "JWT_SECRET=$(gen 48)"
echo "WEBHOOK_SECRET=$(gen 32)"
echo "EMAIL_WEBHOOK_SECRET=$(gen 32)"
echo "SMS_WEBHOOK_SECRET=$(gen 32)"
echo "BOOTSTRAP_ADMIN_PASSWORD=$(gen 24)"
echo "FINANCE_BOOTSTRAP_PASSWORD=$(gen 24)"
echo
echo "Also set:"
echo "  SPRING_PROFILES_ACTIVE=prod"
echo '  DATABASE_URL=${{Postgres.DATABASE_URL}}'
echo "  CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app"
echo
echo "Then: Settings → Networking → Generate Domain"
echo "Put that https origin into Vercel API_PROXY_TARGET (no /api path)."

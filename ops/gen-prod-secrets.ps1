# Generate production secrets for Railway Variables (Windows).
# Usage: powershell -File ops/gen-prod-secrets.ps1
# Paste into Railway → API → Variables. Do not commit the output.

function New-Secret([int]$Bytes = 48) {
  $buf = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  [Convert]::ToBase64String($buf)
}

Write-Host "Paste these into Railway → your API service → Variables:"
Write-Host ""
Write-Host "JWT_SECRET=$(New-Secret 48)"
Write-Host "WEBHOOK_SECRET=$(New-Secret 32)"
Write-Host "EMAIL_WEBHOOK_SECRET=$(New-Secret 32)"
Write-Host "SMS_WEBHOOK_SECRET=$(New-Secret 32)"
Write-Host "BOOTSTRAP_ADMIN_PASSWORD=$(New-Secret 24)"
Write-Host "FINANCE_BOOTSTRAP_PASSWORD=$(New-Secret 24)"
Write-Host ""
Write-Host "Also set:"
Write-Host "  SPRING_PROFILES_ACTIVE=prod"
Write-Host "  DATABASE_URL=`${{Postgres.DATABASE_URL}}   # after adding a Postgres plugin named Postgres"
Write-Host "  CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app"
Write-Host ""
Write-Host "Then: Settings → Networking → Generate Domain"
Write-Host "Put that https origin into Vercel API_PROXY_TARGET (no /api path)."

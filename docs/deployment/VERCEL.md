# Vercel (frontend)

- Root Directory: `frontend`
- Framework: Next.js (`frontend/vercel.json`)
- Required: `API_PROXY_TARGET=https://<railway-api-host>` (no trailing path)
- Browser calls same-origin `/api`; Next rewrites to Railway
- Keep `COOKIE_DOMAIN` empty on the API while this proxy pattern is used
- Never put JWT, DB, or Meta secrets in `NEXT_PUBLIC_*`

Rollback: promote previous Vercel deployment independently of Railway when UI-only.

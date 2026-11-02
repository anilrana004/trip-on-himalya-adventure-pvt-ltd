# Trip On Himalaya — Storefront

Customer-facing catalogue and enquiry site. **Separate Vercel project** from the CRM desk (`frontend/`). Same Railway API, public read paths only, HMAC enquiry intake.

## Local

```bash
# API on :8080 (dev profile or Docker)
cd ../backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev

cd ../storefront
cp .env.example .env.local
# API_PROXY_TARGET=http://localhost:8080
# WEBHOOK_SECRET=<same as backend>
npm install
npm run dev
```

Open http://localhost:3001

## Vercel (second project)

| Setting | Value |
|---|---|
| Root Directory | `storefront` |
| Framework | Next.js |
| `API_PROXY_TARGET` | Railway HTTPS origin (no `/api`) |
| `WEBHOOK_SECRET` | Same value as Railway `WEBHOOK_SECRET` |
| `NEXT_PUBLIC_CRM_URL` | Optional link to CRM Vercel URL |
| `NEXT_PUBLIC_WHATSAPP_E164` | Optional |

On Railway, set `STOREFRONT_PUBLIC_URL=https://<this-storefront>.vercel.app` (and keep `APP_PUBLIC_URL` for the CRM). CORS merges both.

## Surfaces

- `/` — brand hero + featured treks
- `/treks` — full live catalogue
- `/treks/[slug]` — detail + enquire
- `/enquire` — general enquiry
- `POST /api/enquiry` — server-signed webhook to `/api/webhook/lead`

Never put JWT or DB secrets on this project.

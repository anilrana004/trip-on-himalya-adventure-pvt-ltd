# Storefront (separate Vercel app)

The customer site lives in `/storefront`. Deploy it as its **own** Vercel
project with Root Directory `storefront`. Do not bundle it into the CRM
`frontend` project.

Abercrombie & Kent–depth information architecture, scoped to **Indian
Himalayan treks, yatras, and road journeys** only. Copy and brand are Trip On
Himalaya — not A&K.

```text
Browser (store)
  → GET  /journeys (RSC) → Railway GET /api/storefront/trips
  → POST /api/enquiry    → HMAC → Railway POST /api/webhook/lead
```

## Surfaces

| Path | Purpose |
|---|---|
| `/` | Hero, destinations, featured journeys, ways, why us |
| `/destinations` | Region hubs |
| `/journeys` | Journey finder |
| `/ways` | How guests travel |
| `/tailormade` `/offers` `/about` `/speak-to-us` | Private, offers, story, contact |
| `/treks/*` | Redirects to `/journeys/*` |

## Railway

| Variable | Purpose |
|---|---|
| `STOREFRONT_PUBLIC_URL` | `https://<store>.vercel.app` — merged into CORS with `APP_PUBLIC_URL` |
| `WEBHOOK_SECRET` | Shared with storefront BFF for enquiry HMAC |

Public API (no JWT):

- `GET /api/storefront/trips?category=&q=`
- `GET /api/storefront/trips/{slug}`

## Vercel storefront project

| Variable | Required |
|---|---|
| `API_PROXY_TARGET` | Yes — Railway HTTPS origin |
| `WEBHOOK_SECRET` | Yes — same as Railway |
| `NEXT_PUBLIC_CRM_URL` | Optional |
| `NEXT_PUBLIC_WHATSAPP_E164` | Optional |

After first deploy, paste the storefront URL into Railway
`STOREFRONT_PUBLIC_URL` and redeploy the API so CORS includes it.

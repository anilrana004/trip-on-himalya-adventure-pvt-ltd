# Trip On Himalaya — Storefront

Luxury Indian Himalayan travel site (Abercrombie & Kent–depth IA) for treks,
yatras, and road journeys. **Separate Vercel project** from the CRM desk.

## Surfaces

| Path | Purpose |
|---|---|
| `/` | Brand hero, destinations, featured journeys, ways to travel, why us |
| `/destinations` | Region hubs (Uttarakhand, Himachal, Ladakh, Spiti, …) |
| `/destinations/[region]` | Journeys in that region |
| `/journeys` | Journey finder (category, region, search, sort) |
| `/journeys/[slug]` | Full itinerary + enquire |
| `/ways` · `/ways/[style]` | Fixed group, private, active, spiritual, road, weekend |
| `/tailormade` | Private travel brief + form |
| `/offers` | Value + signature picks |
| `/about` | Why Trip On Himalaya |
| `/speak-to-us` | Phone + enquiry (CRM webhook) |
| `/treks/*` | Redirects → `/journeys/*` |

## Local

```bash
cp .env.example .env.local
# API_PROXY_TARGET=http://localhost:8080
# WEBHOOK_SECRET=<same as backend>
npm install
npm run dev
```

http://localhost:3001

## Vercel

Root Directory: `storefront`. Env: `API_PROXY_TARGET`, `WEBHOOK_SECRET`.
Railway: `STOREFRONT_PUBLIC_URL`. See `docs/deployment/STOREFRONT.md`.

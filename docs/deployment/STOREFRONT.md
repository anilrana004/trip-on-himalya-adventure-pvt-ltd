# Public storefront channel (CRM-owned)

The customer storefront is a **separate product and GitHub repo**. This CRM
does **not** host its Next.js app. CRM owns the Salesforce-style channel
integration only.

```text
External storefront (toh-storefront)
  → GET  /api/storefront/trips[/{slug}]   public catalogue (active trips only)
  → POST /api/webhook/lead                HMAC enquiry → lead → RR owner → 5-min call task
```

## What lives in this CRM

| Surface | Behaviour |
|---|---|
| `GET /api/storefront/**` | Public, no JWT. Active trips only. No CRM notes / content briefs. |
| `POST /api/webhook/lead` | HMAC `X-Webhook-Signature`. Source `STOREFRONT` or `WEBSITE`. Optional `trip_slug` for sticky assignment. Phone then email soft-dedupe. |
| Desk **Capture / Forms** | Storefront + website + WhatsApp channels; recent signed posts without raw PII payload. |
| Lead book | Filter / tab by source `STOREFRONT`. Same journey: lead → deal → booking. |

## Railway env (API)

| Variable | Purpose |
|---|---|
| `STOREFRONT_PUBLIC_URL` | `https://<store>.vercel.app` — merged into CORS with `APP_PUBLIC_URL` |
| `WEBHOOK_SECRET` | Shared with the storefront BFF only (never `NEXT_PUBLIC_*`) |

After first storefront deploy, set `STOREFRONT_PUBLIC_URL` and redeploy the API.

## Contract fields the storefront may send

| Field | Required | Notes |
|---|---|---|
| `customer_name` / `mobile_number` / `consent_given` | Yes | Indian mobile |
| `destination` | Recommended | Free text trek / region |
| `trip_slug` | Optional | Resolves to active `trip_id` + sticky RR |
| `lead_source` | Optional | Prefer `STOREFRONT` |
| `email`, `num_persons`, `message`, `consent_scope` | Optional | |

Do not add storefront UI, pages, or packages into this repository.

## Security boundary

- Push CRM changes only to the CRM GitHub remote. Push website changes only to
  `toh-storefront`. Never mix the two in one commit or push.
- The public storefront must not link to the CRM desk, expose owner/SLA/finance
  fields, or put `WEBHOOK_SECRET` / API origins in `NEXT_PUBLIC_*`.
- Catalogue responses stay on `/api/storefront/**` (active trips only). Enquiry
  intake stays on HMAC `/api/webhook/lead`.

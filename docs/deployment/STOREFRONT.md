# Storefront (sibling product)

The customer site is **not** in this repository. It lives in the sibling
folder / separate GitHub repo **`toh-storefront`**.

Deploy that app as its own Vercel project (Root Directory = repo root). Do not
nest it under this CRM `frontend` project.

```text
Browser (toh-storefront)
  → RSC catalogue     → Railway GET  /api/storefront/trips
  → POST /api/enquiry → HMAC         → Railway POST /api/webhook/lead
```

Full contract: `toh-storefront/docs/CRM_API_CONTRACT.md`.

## What this CRM owns

| Surface | Notes |
|---|---|
| `GET /api/storefront/**` | Public catalogue (no JWT) |
| `POST /api/webhook/lead` | HMAC enquiry intake → lead |
| CORS | Merge `STOREFRONT_PUBLIC_URL` with `APP_PUBLIC_URL` |

## Railway env

| Variable | Purpose |
|---|---|
| `STOREFRONT_PUBLIC_URL` | `https://<store>.vercel.app` |
| `WEBHOOK_SECRET` | Same value as storefront Vercel |

After the first storefront deploy, set `STOREFRONT_PUBLIC_URL` and redeploy
the API so CORS includes that origin.

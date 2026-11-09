# Bulk WhatsApp → Zapier Catch Hook

Managers launch campaigns from **Leads** (select rows → WhatsApp campaign). CRM snapshots eligible recipients and a sweep posts each one to Zapier. Zapier sends via WhatsApp Business / Interakt / Twilio, etc. CRM keeps the lead book; Zapier is the pipe.

```text
Leads desk (MANAGER / ADMIN / CEO)
  → POST /api/whatsapp/campaigns
  → whatsapp_campaign_recipients (QUEUED)
  → WhatsAppCampaignSweep (~1/min, 25/batch)
  → POST ZAPIER_WHATSAPP_HOOK_URL  (HMAC)
  → Zapier → WhatsApp app
```

## Railway / local env

| Variable | Purpose |
|---|---|
| `ZAPIER_WHATSAPP_HOOK_URL` | Zapier Catch Hook HTTPS URL |
| `WEBHOOK_SECRET` | HMAC for `X-Webhook-Signature` |

Without the hook URL, ZAPIER-mode sends fail clearly. Use **Inline (CRM SendGate)** for sandbox/Interakt without Zapier.

## Zapier Zap (outbound)

1. **Trigger:** Webhooks by Zapier → Catch Hook → paste URL into `ZAPIER_WHATSAPP_HOOK_URL`
2. **Action:** WhatsApp Business / Interakt / Twilio → map `mobile`, `templateCode`, `customerName`, `body`
3. Optional: Filter on `templateCode` or `campaignName`

### Payload (one recipient)

```json
{
  "campaignId": "uuid",
  "campaignName": "WA follow-up · 12 leads · …",
  "recipientId": "uuid",
  "leadId": "uuid",
  "mobile": "98XXXXXXXX",
  "customerName": "…",
  "templateCode": "LEAD_FOLLOW_UP",
  "body": "optional note for the Zap",
  "channel": "WHATSAPP"
}
```

Headers: `Content-Type: application/json`, `X-Webhook-Signature` (HMAC-SHA256 of raw body with `WEBHOOK_SECRET`), `X-TOH-Campaign-Id`.

## Eligibility (CRM skips)

- No WhatsApp/mobile on the lead  
- Lead `consentGiven` is false  
- Mobile is REVOKED for WhatsApp in consent/suppressions  

Template `LEAD_FOLLOW_UP` is seeded in V46 (transactional). Create the matching Interakt/Meta template if using INLINE Interakt.

## Verify

1. Set Catch Hook URL on the API and redeploy / restart  
2. As manager: Leads → select consented leads with phone → **WhatsApp campaign** → Zapier  
3. Watch Zapier catch a hit per recipient (~1/min batch)  
4. `GET /api/whatsapp/campaigns` shows sent / failed counts  

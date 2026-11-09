# Bulk email → Zapier Catch Hook

Managers launch campaigns from **Leads** (select rows → Email campaign). CRM snapshots eligible recipients and a sweep posts each one to Zapier. Zapier sends the mail (Gmail, Mailchimp, etc.). CRM does not invent a second lead store.

```text
Leads desk (MANAGER / ADMIN / CEO)
  → POST /api/v1/email/campaigns
  → email_campaign_recipients (QUEUED)
  → EmailCampaignSweep (~1/min, 25/batch)
  → POST ZAPIER_EMAIL_HOOK_URL  (HMAC)
  → Zapier → Email app
```

## Railway / local env

| Variable | Purpose |
|---|---|
| `ZAPIER_EMAIL_HOOK_URL` | Zapier Catch Hook HTTPS URL |
| `WEBHOOK_SECRET` | Same secret used for HMAC (`X-Webhook-Signature`) |
| `EMAIL_FROM` (optional) | Hint in payload `fromHint` |

Without `ZAPIER_EMAIL_HOOK_URL`, ZAPIER-mode sends fail with a clear error. Use **Inline (CRM SendGate)** for sandbox/SES without Zapier.

## Zapier Zap (outbound)

1. **Trigger:** Webhooks by Zapier → Catch Hook → copy URL into `ZAPIER_EMAIL_HOOK_URL`
2. **Action:** Gmail / Outlook / Mailchimp / etc. Map fields from the JSON body
3. Optional: Filter on `templateCode` or `campaignName`

### Payload (one recipient)

```json
{
  "campaignId": "uuid",
  "campaignName": "Follow-up · 12 leads · …",
  "recipientId": "uuid",
  "leadId": "uuid",
  "email": "guest@example.com",
  "customerName": "…",
  "templateCode": "LEAD_FOLLOW_UP",
  "subject": "optional override",
  "body": "optional note for the Zap",
  "fromHint": "noreply@…"
}
```

Headers: `Content-Type: application/json`, `X-Webhook-Signature` (HMAC-SHA256 of raw body with `WEBHOOK_SECRET`), `X-TOH-Campaign-Id`.

## Eligibility (CRM skips)

- No email on the lead  
- Lead `consentGiven` is false  
- Email address is REVOKED in consent/suppressions  

Template `LEAD_FOLLOW_UP` is transactional (approved in V45).

## Verify

1. Set Catch Hook URL on the API and redeploy / restart  
2. As manager: Leads → select consented leads with email → **Email campaign** → Zapier  
3. Watch Zapier catch a hit per recipient (~1/min batch)  
4. `GET /api/v1/email/campaigns` shows sent / failed counts  

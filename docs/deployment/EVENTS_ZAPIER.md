# CRM lifecycle events → Zapier

CRM posts sales events to a Catch Hook. Zapier fans out to Slack, Gmail, Teams, etc. Cadence and tasks still live in the CRM — Zapier is the alert pipe.

```text
Lead created / Interested / Quotation / Booked / Lost / Call / SLA breach
  → ZapierEventsClient (async)
  → POST ZAPIER_EVENTS_HOOK_URL  (HMAC)
  → Zapier → Slack channel / email / SMS
```

## Env

| Variable | Purpose |
|---|---|
| `ZAPIER_EVENTS_HOOK_URL` | Catch Hook HTTPS URL |
| `ZAPIER_EVENTS_ENABLED` | Cutover default `false` (CRM→Zapier posts paused; URL kept for rollback). Set `true` to restore Catch Hook posts. Native in-app + EmailGateway alerts still run either way. |
| `WEBHOOK_SECRET` | HMAC for `X-Webhook-Signature` |

Migration status: `docs/automation/MIGRATION_STATUS.md`.

## Zap

1. **Trigger:** Webhooks by Zapier → Catch Hook  
2. **Action:** Slack “Send Channel Message” (or Gmail)  
3. Map `event`, `customerName`, `mobile`, `ownerName`, `stage` (also nested under `data.*`)

### Events

| `event` | When |
|---|---|
| `lead.created` | New lead + first-call task |
| `lead.interested` | Status → INTERESTED (cadence started) |
| `lead.quotation` | Status → QUOTATION_SENT |
| `lead.booked` | Status → BOOKING_CONFIRMED |
| `lead.lost` | Status → LOST (open tasks cancelled) |
| `lead.call` | Call attempt logged (`data.outcome`) |
| `sla.breach` | Follow-up SLA escalated to managers |

### Payload shape

```json
{
  "event": "lead.created",
  "occurredAt": "2026-11-03T05:00:00Z",
  "source": "trip-on-himalaya-crm",
  "data": {
    "leadId": "uuid",
    "customerName": "…",
    "mobile": "98XXXXXXXX",
    "source": "FACEBOOK_ADS",
    "ownerName": "…",
    "stage": "NEW"
  }
}
```

## Related Zaps

- Inbound Facebook: [FACEBOOK_ZAPIER.md](./FACEBOOK_ZAPIER.md)  
- Bulk email: [EMAIL_ZAPIER.md](./EMAIL_ZAPIER.md)  
- Bulk WhatsApp: [WHATSAPP_ZAPIER.md](./WHATSAPP_ZAPIER.md)  

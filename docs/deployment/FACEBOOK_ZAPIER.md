# Facebook Ads Manager → CRM (Zapier)

Only channel for now: **Facebook Lead Ads**. Zapier is the pipe; CRM owns sales automation.

```text
Facebook Lead Form
  → Zapier (map + HMAC)
  → POST /api/webhook/lead  (lead_source=FACEBOOK_ADS)
  → CRM: assign owner → Call within 5 min → desk + manager visibility
```

## Railway

| Variable | Purpose |
|---|---|
| `WEBHOOK_SECRET` | Shared with Zapier Code step |
| Public API HTTPS | e.g. `https://….up.railway.app` |

## Zapier Zap (one)

1. **Trigger:** Facebook Lead Ads → New Lead  
2. **Filter:** phone present  
3. **Code by Zapier** (Node): build JSON, HMAC-SHA256, POST  

```javascript
const crypto = require("crypto");
const secret = inputData.webhook_secret; // Zapier input = Railway WEBHOOK_SECRET
const bodyObj = {
  customer_name: inputData.full_name || inputData.name,
  mobile_number: String(inputData.phone_number || inputData.phone || "").replace(/\D/g, "").slice(-10),
  email: inputData.email || null,
  consent_given: true,
  lead_source: "FACEBOOK_ADS",
  destination: inputData.trek || inputData.destination || null,
};
const body = JSON.stringify(bodyObj);
// CRM requires the exact header form: sha256=<hex> over the raw body string
const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
const res = await fetch(inputData.crm_webhook_url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
  },
  body,
});
output = [{ status: res.status, text: await res.text() }];
```

Zap inputs: `webhook_secret`, `crm_webhook_url` (= `https://YOUR-API/api/webhook/lead`), plus mapped Facebook fields.  
4. **Expect:** HTTP 201 created or 200 duplicate  

Required body: `customer_name`, `mobile_number`, `consent_given: true`, `lead_source: "FACEBOOK_ADS"`.

### Common failure

| Symptom | Cause |
|---|---|
| CRM **401** | Signature missing `sha256=` prefix, or secret ≠ Railway `WEBHOOK_SECRET`, or body was re-serialized after signing |
| CRM **400** | Phone not 10-digit Indian mobile, or `consent_given` false/missing |
| CRM **503** | No active SALES user to assign |

## What CRM automates after the Zap (do not rebuild in Zapier)

| Event | Automation |
|---|---|
| Lead created | Round-robin owner, heat score, INITIAL_CALL +5 min |
| Call NO_ANSWER / BUSY / CALLBACK | CALLBACK task in 2 hours |
| Call CONNECTED | Completes open first-call task; nudges stage update |
| Call WRONG_NUMBER | Alerts managers + owner |
| Status → INTERESTED | FU1 tomorrow, FU2 +2d, FU3 +5d, FU4 +7d |
| Status → QUOTATION_SENT | Quotation chase +2d |
| Status → BOOKING_CONFIRMED | Cancel open follow-ups; ops + WhatsApp path |
| Task overdue / SLA | Remind sales; escalate managers |
| Quiet NEW/INTERESTED | Daily inactive nudge |
| Morning | Manager SLA digest |

Outbound lifecycle alerts: [EVENTS_ZAPIER.md](./EVENTS_ZAPIER.md).  
Outbound bulk email: [EMAIL_ZAPIER.md](./EMAIL_ZAPIER.md).  
Outbound bulk WhatsApp: [WHATSAPP_ZAPIER.md](./WHATSAPP_ZAPIER.md).

## Verify

1. Test lead from Facebook form  
2. Zap success  
3. CRM Leads → source Facebook Ads  
4. Owner has “Call within 5 minutes”  
5. Manager Automations page shows the open queue  

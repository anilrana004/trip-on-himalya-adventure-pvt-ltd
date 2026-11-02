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
3. **Code by Zapier:** build JSON, HMAC-SHA256, POST (see repo chat / ops snippet)  
4. **Expect:** HTTP 201 created or 200 duplicate  

Required body: `customer_name`, `mobile_number`, `consent_given: true`, `lead_source: "FACEBOOK_ADS"`.

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

## Verify

1. Test lead from Facebook form  
2. Zap success  
3. CRM Leads → source Facebook Ads  
4. Owner has “Call within 5 minutes”  
5. Manager Automations page shows the open queue  

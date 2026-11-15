# Integration guide (automation adapters)

> **Date:** 2026-11-15  
> Phase 4+ living guide. Detail for vendors also lives in `docs/INTEGRATIONS.md` and `docs/deployment/*`.

## Adapter contract

Every external call used by automation should:

1. Sit behind an interface in `communications/`, `marketing/`, or `payment/`.  
2. Read credentials from env / `AppProperties` only.  
3. Classify errors (retryable vs permanent).  
4. Time out; never hold a DB transaction across HTTP.  
5. Log without secrets or full PII bodies.  
6. Expose a health/ready signal to the Automations desk when practical.

## Current adapters

| Adapter | Package | Modes | Used by automation |
|---|---|---|---|
| `EmailGateway` | `communications/email` | SANDBOX, SES | NOTIFY, campaigns INLINE, booking mail |
| `WhatsAppGateway` | `communications/whatsapp` | SANDBOX, INTERAKT | SendGate, campaigns INLINE |
| `SmsGateway` | `communications/sms` | SANDBOX, MSG91 | SendGate |
| Meta Graph / webhook | `marketing/` | token + app secret | Z1 native path |
| Razorpay webhook | `payment/webhook/` | signature secret | CORE payments |
| Zapier HTTP clients | `automation/zapier`, communications | Catch Hook URLs | Z2–Z4 (retire) |

## Adding a Slack (or similar) staff alert adapter

1. New interface + env token.  
2. Wire `NOTIFY_USER` / alert publisher.  
3. Feature-flag beside SES.  
4. Do not route guest PII to Slack beyond need-to-know fields.  
5. Tests with WireMock / sandbox.

## Zapier during coexistence

Treat Catch Hooks as **temporary adapters** with the same HMAC and timeout rules. Removing them is a cutover task, not a rewrite of business logic.

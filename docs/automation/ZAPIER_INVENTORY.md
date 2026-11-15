# Zapier inventory (Phase One)

> **Date:** 2026-11-15  
> **Rule:** Never delete or disable these Zaps automatically. Cutover only after parity + explicit approval.  
> **Sources:** CRM code (`automation/zapier`, communications campaigns), `docs/deployment/*_ZAPIER.md`, Automations desk, operator Zapier editor session.  
> **Gap:** Full Zapier export / History API not available from the repo. Fields marked *Live UI* must be re-confirmed in Zapier before production cutover.

## Summary

| # | Zap (working name) | Direction | Business purpose | Criticality | Native replacement readiness |
|---|---|---|---|---|---|
| Z1 | Facebook Lead Ads → CRM | **Inbound** | Create CRM leads from FB forms | High (lead intake) | High — native `/api/webhook/meta` + Graph exist; Zap is convenience pipe |
| Z2 | Lifecycle events → alert email | **Outbound** | Staff alerts on lead/SLA events | Medium (ops visibility) | High — events already emitted; replace Catch Hook with `NOTIFY_USER` / SES / Slack adapter |
| Z3 | Bulk email campaigns | **Outbound** | Manager mass email via Catch Hook | Medium | High — Inline SendGate/SES already exists as alternate path |
| Z4 | Bulk WhatsApp campaigns | **Outbound** | Manager mass WA via Catch Hook | Medium | High — Inline Interakt SendGate already exists as alternate path |

**Important:** Most CRM/ERP automation (assignment, cadence, booking confirm, payments, docs, digests) is **already native**. Zapier is not the orchestration brain — it is an **edge pipe** for (1) Facebook intake and (2) optional outbound fan-out.

---

## Z1 — Facebook Lead Ads → CRM

| Field | Detail |
|---|---|
| **1. Name** | Facebook Lead Ads → Trip On Himalaya CRM (`FACEBOOK_ZAPIER.md`) |
| **2. Business purpose** | Land Meta Lead Form submissions as `FACEBOOK_ADS` leads with consent, then CRM speed-to-lead |
| **3. Trigger app** | Facebook Lead Ads |
| **4. Trigger event** | New Lead |
| **5. Trigger conditions** | Form / Page configured in Zap (*Live UI*) |
| **6. Filters** | Phone present (documented) |
| **7. Conditional paths** | None documented beyond filter |
| **8–9. Actions / sequence** | (1) Filter → (2) Code by Zapier (HMAC + POST) → CRM |
| **10–11. Data mapping** | `full_name/name` → `customer_name`; `phone*` → 10-digit `mobile_number`; `email`; `trek/destination`; `consent_given: true`; `lead_source: FACEBOOK_ADS` |
| **12. Connected apps** | Facebook Lead Ads; CRM HTTPS |
| **13. Endpoints** | `POST {API}/api/webhook/lead` |
| **14. Auth** | Shared `WEBHOOK_SECRET`; header `X-Webhook-Signature: sha256=<hex>` over raw JSON body |
| **15–16. Errors / retry** | CRM 401 bad HMAC; 400 bad phone/consent; 503 no SALES assignee. Zapier retries on non-2xx per Zapier defaults (*Live UI*) |
| **17. Dependencies** | Downstream native: `WebhookService` → round-robin → `FollowUpAutomation` → Z2 events |
| **18. Impact if fails** | Lost / delayed Meta leads; sales SLA clock never starts |
| **19. Frequency** | Event-driven (form submissions) |
| **20. Limitations** | Code step must not re-serialize body after signing; parallel native Meta webhook may duplicate if both enabled without dedupe strategy |

**CRM code:** `webhook/WebhookController`, `WebhookService`, `docs/deployment/FACEBOOK_ZAPIER.md`.

---

## Z2 — Lifecycle events → staff alert

| Field | Detail |
|---|---|
| **1. Name** | Trip On Himalaya CRM lifecycle events → TOH CRM alert email (Zap id ~`386455086`) |
| **2. Business purpose** | Notify ops/sales mailbox when lifecycle / SLA events fire |
| **3. Trigger app** | Webhooks by Zapier |
| **4. Trigger event** | Catch Hook |
| **5–7. Conditions / filters / paths** | None in CRM; optional Zap filters (*Live UI*) |
| **8–9. Actions** | Email by Zapier → Send Outbound Email (Gmail/Slack may be unavailable on free connections; Email by Zapier used in setup) |
| **10–11. Mapping** | To: staff alert address; Subject/Body from `event`, `customerName`, `mobile`, `ownerName`, `stage`, `leadId`, `occurredAt` (flat + nested `data.*`) |
| **12. Apps** | Webhooks by Zapier, Email by Zapier |
| **13. Endpoint** | `ZAPIER_EVENTS_HOOK_URL` Catch Hook |
| **14. Auth** | CRM signs with `WEBHOOK_SECRET` (`X-Webhook-Signature`); Zapier Catch Hook itself is URL-secret |
| **15–16. Errors / retry** | Fire-and-forget daemon pool in `ZapierEventsClient`; failures logged, never roll back desk TX. Zapier email limits on Free/Trial |
| **17. Dependencies** | Producers: `FollowUpAutomation`, `PostTripEngagementSweep` |
| **18. Impact if fails** | Staff miss Slack/email alerts; **CRM tasks/notifications still created** |
| **19. Frequency** | Per lead lifecycle / SLA / post-trip event |
| **20. Limitations** | Nested `data` historically empty in Zapier pickers → CRM now flat-mirrors keys; Catch Hook Skip-test yields `_zap_data_was_skipped` and blocks remapping |

### Events published to Z2

| `event` | Producer | When |
|---|---|---|
| `lead.created` | `FollowUpAutomation` | New lead + first-call path |
| `lead.interested` | `FollowUpAutomation` | Status → INTERESTED |
| `lead.quotation` | `FollowUpAutomation` | Status → QUOTATION_SENT |
| `lead.booked` | `FollowUpAutomation` | Status → BOOKING_CONFIRMED |
| `lead.lost` | `FollowUpAutomation` | Status → LOST |
| `lead.call` | `FollowUpAutomation` | Call logged (`outcome`) |
| `sla.breach` | `FollowUpAutomation.escalateToManager` | Task SLA escalated |
| `booking.post_trip` | `PostTripEngagementSweep` | Post-trip engagement |

**CRM code:** `ZapierEventsClient`, `ZapierStatusController`, `docs/deployment/EVENTS_ZAPIER.md`.

---

## Z3 — Bulk email campaigns

| Field | Detail |
|---|---|
| **1. Name** | TOH CRM Bulk Email Campaigns (Zap id ~`386460099`) |
| **2. Business purpose** | Deliver manager-launched email campaigns to consented leads |
| **3–4. Trigger** | Webhooks by Zapier Catch Hook |
| **5–7. Filters / paths** | Optional on `templateCode` / `campaignName` |
| **8–9. Actions** | Email by Zapier Send Outbound Email (intended map: To=`email`, Subject=`subject`, Body=`body` + meta) |
| **10–11. Payload** | `campaignId`, `campaignName`, `recipientId`, `leadId`, `email`, `customerName`, `templateCode`, `subject`, `body`, `fromHint` |
| **12. Apps** | Webhooks + Email by Zapier |
| **13. Endpoint** | `ZAPIER_EMAIL_HOOK_URL` |
| **14. Auth** | HMAC `WEBHOOK_SECRET`; header `X-TOH-Campaign-Id` |
| **15–16. Errors / retry** | Sweep marks recipient failed on hook error; Zapier Free email caps |
| **17. Dependencies** | `BulkEmailCampaignService` + `EmailCampaignSweep` (~1 min, 25/batch) |
| **18. Impact if fails** | Campaign stuck/failed counts; guests not emailed via Zap path |
| **19. Frequency** | Burst after manager launch |
| **20. Limitations** | Inline SendGate/SES is already a first-class alternate (`deliveryMode`); Zap path must not bypass consent — CRM eligibility already filters |

**CRM code:** `ZapierEmailHookClient`, `BulkEmailCampaignService`, `docs/deployment/EMAIL_ZAPIER.md`.

---

## Z4 — Bulk WhatsApp campaigns

| Field | Detail |
|---|---|
| **1. Name** | TOH CRM Bulk WhatsApp (Zap id ~`386461037`) |
| **2. Business purpose** | Deliver manager-launched WhatsApp campaigns |
| **3–4. Trigger** | Webhooks by Zapier Catch Hook |
| **5–7. Filters / paths** | Optional on `templateCode` / `campaignName` |
| **8–9. Actions** | Intended: WhatsApp Business / Interakt; **Interakt not in Zapier catalog** during setup — often Email-by-Zapier notify fallback (*Live UI*) |
| **10–11. Payload** | `campaignId`, `campaignName`, `recipientId`, `leadId`, `mobile`, `customerName`, `templateCode`, `body`, `channel: WHATSAPP` |
| **12. Apps** | Webhooks + WA provider or email notify |
| **13. Endpoint** | `ZAPIER_WHATSAPP_HOOK_URL` |
| **14. Auth** | HMAC `WEBHOOK_SECRET`; `X-TOH-Campaign-Id` |
| **15–16. Errors / retry** | Same pattern as Z3 |
| **17. Dependencies** | `BulkWhatsAppCampaignService` + `WhatsAppCampaignSweep` |
| **18. Impact if fails** | Campaign delivery fails on Zap path; Inline Interakt unaffected |
| **19. Frequency** | Burst after manager launch |
| **20. Limitations** | Guest transactional WA (booking confirm) is **native Interakt**, not this Zap. Template approval / opt-in still required |

**CRM code:** `ZapierWhatsAppHookClient`, `BulkWhatsAppCampaignService`, `docs/deployment/WHATSAPP_ZAPIER.md`.

---

## Non-Zapier automations (do not migrate “into Zapier”)

Listed so inventory is complete and nothing is mistaken for a Zap:

| Area | Mechanism | Classification (`AUTOMATION_INVENTORY.md`) |
|---|---|---|
| Speed-to-lead, cadence, quotation chase, booked cleanup | `FollowUpAutomation` | MIGRATE → workflow templates (engine already exists) |
| Booking WA confirm | `BookingConfirmationNotifier` + SendGate | MIGRATE template / already native |
| Payment reminders / overdue | `PaymentSweep` | MIGRATE / CORE money webhook |
| Document-missing | `DocumentMissingReminderSweep` | Native sweep (N1 delivered) |
| Post-trip | `PostTripEngagementSweep` | Native + optional Z2 event |
| Inactive nudge / manager digest | sweeps | Native |
| Seat hold / min-group / compliance gate / consent / dispatch | various | **CORE** — never Zap, never configurable bypass |
| Phase 6 workflow engine | `automation/*` outbox + runs | Native ownership target for remaining MIGRATE items |

---

## Duplicate / race / circular-trigger risks

| Risk | Detail | Mitigation |
|---|---|---|
| Double Meta intake | Z1 Zap **and** native `/api/webhook/meta` both enabled | Single intake path per Page; CRM mobile dedupe; document cutover |
| Double guest email/WA | Bulk Zap path + Inline campaign + transactional SendGate | Campaign `deliveryMode` is exclusive; transactional templates stay SendGate |
| Alert storm | Z2 + in-app + staff SES on same event | Z2 is additive alerts only; prefer consolidating to native `NOTIFY_USER` |
| Circular Zap | None today — Catch Hooks do not call back into CRM except Z1 | Keep outbound Zaps one-way |
| Skip-test sample | `_zap_data_was_skipped` blocks field pills | Never Skip Catch Hook test when remapping; use live POST |

---

## Operator desk

`GET /api/v1/automation/zapier/status` + frontend `AutomationsDesk` show Ready/Unset for Z2–Z4 hooks (plus FB inbound secret readiness). Ready ≠ “mapped correctly” — only non-blank HTTPS URL.

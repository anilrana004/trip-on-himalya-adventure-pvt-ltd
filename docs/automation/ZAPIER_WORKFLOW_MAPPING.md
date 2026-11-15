# Zapier → native workflow mapping (Phase One)

> **Date:** 2026-11-15  
> Mapping: **EXISTING ZAPIER WORKFLOW → NEW NATIVE AUTOMATION → DATABASE / EVENTS → API ACTIONS → VALIDATION TESTS**  
> Native target: existing Spring `automation/` engine + SendGate / webhook adapters (ADR 0006). Not a new BullMQ service.

## Mapping table

| ID | Existing Zapier workflow | New native automation | Domain events / DB | API / adapters | Validation tests |
|---|---|---|---|---|---|
| Z1 | Facebook Lead Ads → Code → `POST /api/webhook/lead` | Prefer **native Meta webhook** (`/api/webhook/meta`) + Graph lead fetch **or** keep HMAC lead webhook called from a thin CRM-owned Meta poller | `leads` insert; emit `lead.created` via `DurableEventPublisher` / existing `FollowUpAutomation` | `MetaWebhookController`, `WebhookService`, round-robin | `Webhook*IT`, Meta webhook signature tests; dual-path dedupe test |
| Z2 | Catch Hook → Email by Zapier staff alert | Workflow / hard path: `NOTIFY_USER` + `EmailGateway` (SES) on same producers; optional Slack adapter later | Events already from FollowUp / PostTrip; outbox `automation_events` | `EmailNotifier`/`EmailGateway`, in-app `notifications` | Assert SES/sandbox send on `lead.created` / `sla.breach` without Catch Hook; no TX rollback on mail failure |
| Z3 | Catch Hook → guest email | Default campaigns to **Inline SendGate/SES**; retire Zap mode behind flag | `email_campaigns` / `email_campaign_recipients` | `BulkEmailCampaignService`, `EmailCampaignSweep`, `SendGateService` | Campaign IT: consent skip, recipient SENT via gateway mock; Zap client unused when mode INLINE |
| Z4 | Catch Hook → WA (or email notify) | Default campaigns to **Inline Interakt SendGate** | `whatsapp_campaigns` / recipients + `whatsapp_messages` | `BulkWhatsAppCampaignService`, `WhatsAppCampaignSweep`, Interakt gateway | Campaign IT + Interakt sandbox; template/opt-in guards |

## Downstream CRM automations (already native — map for engine MIGRATE, not Zap)

| Legacy hard-coded | Engine template (from `AUTOMATION_INVENTORY.md`) | Events | Status |
|---|---|---|---|
| M1 Speed-to-lead | `new-lead-speed-to-lead` | `lead.created` | Hard-coded today; engine package exists |
| M2 Follow-up cadence | `follow-up-cadence` | `lead.updated` (INTERESTED) | Hard-coded |
| M3 Quotation chase | `quotation-no-response-chase` | `lead.updated` (QUOTATION_SENT) | Hard-coded |
| M4 Booking confirm WA | `booking-confirmation-send` | `booking.confirmed` | Shadow template + AFTER_COMMIT notifier (live) |
| M5 Balance due | `balance-due-reminder` | `payment.due_soon` | Shadow + `PaymentSweep` (live) |
| M6 Payment overdue | `payment-overdue` | `payment.overdue` | Shadow + `PaymentSweep` (live) |
| M7 OPS prep notify | `booking-confirmed-ops` | `booking.confirmed` | Shadow; handoff create stays CORE |
| M8 Batch scarcity | `batch-scarcity-alert` | `batch.scarcity_alert` | Shadow + latched `CapacityAlertService` (live) |
| M9 Booked cleanup | `lead-booked-cleanup` | `lead.booked` | Shadow + FollowUp (live) |
| N1 Doc missing | native sweep | compliance / departure | Delivered |
| N2 Post-trip | native sweep + Z2 event | booking departure | Delivered |
| N3 Inactive nudge | native sweep | time | Delivered |

## Sequence diagrams (Zap cutover intent)

### Z1 intake (target)

```text
Meta Lead Form
  → Meta webhook (signed) OR CRM Graph pull
  → WebhookService / LeadService (dedupe by mobile)
  → RoundRobin + FollowUpAutomation
  → DurableEventPublisher lead.created
  → Native NOTIFY + tasks
  ✗ Zapier Code step (paused only after approval)
```

### Z2 alerts (target)

```text
FollowUpAutomation / sweeps
  → DurableEventPublisher / direct NOTIFY_USER
  → EmailGateway (SES) + in-app bell
  ✗ ZapierEventsClient HTTP (feature-flag off after parity)
```

### Z3/Z4 campaigns (target)

```text
Manager desk → campaign rows QUEUED
  → Sweep → SendGate → SES / Interakt
  ✗ Zapier*HookClient (flag off; keep class for rollback)
```

## Parity checklist (per Zap)

For each Z1–Z4 before cutover:

- [ ] Documented input sample captured  
- [ ] Native path produces same business record / message intent  
- [ ] Shadow mode cannot create duplicate guest messages or payments  
- [ ] Integration test green  
- [ ] Automations desk / ops runbook updated  
- [ ] Explicit human approval to pause Zap  
- [ ] Rollback steps verified (`ROLLBACK_PLAN.md`)

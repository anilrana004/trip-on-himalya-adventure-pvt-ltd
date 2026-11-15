# Migration status

> **Updated:** 2026-11-16  
> **Overall:** Native CRM automations own the journey (M1–M11). Zapier campaign delivery retired. Lifecycle Catch Hook posts remain paused. Facebook Meta native ingest waits on `META_*` credentials.

## Phase checklist

| Phase | Status | Notes |
|---|---|---|
| 0–3 | **Done** | Flags, INLINE campaigns, Meta ingest gated, outbox |
| 4 Native templates M1–M11 | **Live** | Engine effects on; legacy MIGRATE paths off; bootstrap refreshes defs |
| 5 Integration adapters | Partial | Slack native still absent (staff email via EmailGateway) |
| 6 Automation admin desk | **Updated** | Engine live / native delivery / retired Zap pipes |
| 9 Production cutover | **Partial** | Railway cutover done; Meta FB Zap pause needs META_* first |

## Cutover flags (production)

| Flag | Value |
|---|---|
| `ZAPIER_EVENTS_ENABLED` | `false` |
| `AUTOMATION_MIGRATE_SHADOW_ENABLED` | `true` |
| `AUTOMATION_DRY_RUN_ENABLED` | `false` |
| `AUTOMATION_LEGACY_EFFECTS_ENABLED` | `false` |
| `META_LEADGEN_INGEST_ENABLED` | `false` until Meta Page + tokens configured |

## Native template library

| ID | Slug | Trigger |
|---|---|---|
| M1 | `new-lead-speed-to-lead` | `lead.created` (15m SLA for ads/web/storefront) |
| M2 | `follow-up-cadence` | `lead.interested` |
| M3 | `quotation-no-response-chase` | `lead.quotation` |
| M4 | `booking-confirmation-send` | `booking.confirmed` |
| M5 | `balance-due-reminder` | `payment.due_soon` |
| M6 | `payment-overdue` | `payment.overdue` |
| M7 | `booking-confirmed-ops` | `booking.confirmed` |
| M8 | `batch-scarcity-alert` | `batch.scarcity_alert` |
| M9 | `lead-booked-cleanup` | `lead.booked` |
| M10 | `lead-lost-cleanup` | `lead.lost` |
| M11 | `lead-soft-duplicate-callback` | `lead.soft_duplicate` |

Staff `NOTIFY_USER` is in-app **and** EmailGateway. Bulk email/WA campaigns force INLINE SendGate.

## Per-Zap status

| Zap | Status |
|---|---|
| Z1 Facebook → CRM | Leave On until Meta tokens + `META_LEADGEN_INGEST_ENABLED=true` |
| Z2 Lifecycle alerts | Off / posts paused by flag |
| Z3 Bulk email | Retired in CRM (SendGate only) |
| Z4 Bulk WhatsApp | Retired in CRM (SendGate only) |

## Rollback

See `ROLLBACK_PLAN.md` — flip `AUTOMATION_LEGACY_EFFECTS_ENABLED=true` and/or `ZAPIER_EVENTS_ENABLED=true`.

## Change log

| Date | Change |
|---|---|
| 2026-11-15 | Phase 0–4 shadow + cutover approved |
| 2026-11-16 | Railway cutover deploy |
| 2026-11-16 | Native M1–M11, staff email on notify, campaigns Zap-free |

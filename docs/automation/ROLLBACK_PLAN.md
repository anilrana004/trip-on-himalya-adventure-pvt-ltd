# Rollback plan (Zapier + MIGRATE cutover)

> **Rule:** Native flags roll back first; Zapier second. Do not delete Catch Hook URLs.

## Current cutover defaults (2026-11-15 approved)

| Flag | Cutover value | Rollback value |
|---|---|---|
| `ZAPIER_EVENTS_ENABLED` | `false` | `true` (URL must still be set) |
| `AUTOMATION_MIGRATE_SHADOW_ENABLED` | `true` (templates ACTIVE) | keep `true` or pause versions in desk |
| `AUTOMATION_DRY_RUN_ENABLED` | `false` (engine applies effects) | `true` to freeze engine effects |
| `AUTOMATION_LEGACY_EFFECTS_ENABLED` | `false` | `true` to restore FollowUp/WA/reminder/ops-prep/scarcity notify |
| `META_LEADGEN_INGEST_ENABLED` | `false` (unchanged) | leave false until FB Zap paused manually |

## Per-Zap rollback

| Zap | If native fails | Restore steps |
|---|---|---|
| Z1 Facebook | Duplicate/missing leads | Keep FB Zap On; leave `META_LEADGEN_INGEST_ENABLED=false` |
| Z2 Alerts | Staff miss alerts | Set `ZAPIER_EVENTS_ENABLED=true`; confirm Catch Hook On |
| Z3 Bulk email | Guests not mailed | Campaign delivery mode **ZAPIER**; confirm `ZAPIER_EMAIL_HOOK_URL` |
| Z4 Bulk WhatsApp | Guests not messaged | Delivery mode **ZAPIER** or fix Interakt INLINE |

## MIGRATE (M1–M9) rollback

1. Set `AUTOMATION_LEGACY_EFFECTS_ENABLED=true` (hard-coded paths resume).  
2. Optionally set `AUTOMATION_DRY_RUN_ENABLED=true` so engine effects skip while legacy runs.  
3. Redeploy / refresh config.  
4. Confirm Automations desk shows “legacy also on” / not “Engine live”.

## Manual Zapier UI (human)

- **Z2:** CRM posts already paused by flag — pause or leave the Catch Hook Zap as standby.  
- **Z1 Facebook Lead Ads:** still owns intake until you pause it **and** enable `META_LEADGEN_INGEST_ENABLED`.  
- **Z3/Z4:** leave On as rollback for campaign ZAPIER mode; INLINE is the desk default.

## General

1. Do **not** delete Catch Hook URLs from Railway during early cutover.  
2. Prefer feature flags over code delete for `Zapier*Client` classes.  
3. CORE money/compliance paths never depend on Zapier — no Zap rollback for Razorpay.  
4. Ops handoff row create, payment overdue status + ops mirror, scarcity latch, min-group alerts stay in hard-coded services even when legacy MIGRATE notify/tasks are off.  
5. Record incident: which flag flipped, time, operator.

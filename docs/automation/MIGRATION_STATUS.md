# Migration status

> **Updated:** 2026-11-15  
> **Overall:** Phase 4 MIGRATE cutover **approved and applied** (engine live, legacy MIGRATE effects off). Z2 Catch Hook posts paused by flag. Z1 Facebook Zap still owns intake. Z3/Z4 Zap hooks remain for campaign rollback.

## Phase checklist

| Phase | Status | Notes |
|---|---|---|
| 0–3 | **Done / in progress** | Flags, INLINE campaigns, Meta ingest gated, outbox shadow |
| 4 MIGRATE templates M1–M9 | **Cutover live** | Templates ACTIVE; `legacy-effects-enabled=false`; dry-run off |
| 5 Integration adapters | Partial | Slack native still absent |
| 6 Automation admin desk | **Updated** | Shows Engine live / legacy / Zap paused |
| 9 Production cutover | **Partial** | Railway cutover vars + deploy done (2026-11-16); Z1 Meta ingest + FB Zap pause still manual |

## Cutover flags (defaults)

| Flag | Default |
|---|---|
| `ZAPIER_EVENTS_ENABLED` | `false` |
| `AUTOMATION_MIGRATE_SHADOW_ENABLED` | `true` |
| `AUTOMATION_DRY_RUN_ENABLED` | `false` |
| `AUTOMATION_LEGACY_EFFECTS_ENABLED` | `false` |
| `META_LEADGEN_INGEST_ENABLED` | `false` |

## Per-Zap status

| Zap | Prod cutover | Zap paused |
|---|---|---|
| Z1 Facebook → CRM | No (native ingest still off) | **On** — leave until Meta ingest dual-tested |
| Z2 Lifecycle alerts | CRM posts stopped by flag | **Off in Zapier UI** (2026-11-16; URL kept for rollback) |
| Z3 Bulk email | INLINE default | **On** — keep for ZAPIER mode rollback |
| Z4 Bulk WhatsApp | INLINE default | **On** — keep for rollback |

## MIGRATE templates

All M1–M9 ACTIVE. Engine applies effects. Hard-coded FollowUp task/notify, booking WA confirm, payment reminder task, ops prep notify/task, scarcity notify are **off** (legacy flag). CORE: ops handoff create, payment overdue mark + ops sync, scarcity latch, min-group alerts remain in services.

## Ops checklist

1. ~~Redeploy API with cutover env~~ — **done** (`daring-mindfulness` / `trip-on-himalya-adventure-pvt-ltd`, deploy `0f4874f3`, M1–M9 ACTIVE, `legacyEffects=false` `dryRun=false`).  
2. Confirm Automations desk: **Engine live**, Zap lifecycle **Paused**.  
3. ~~Pause Z2 Catch Hook Zap~~ — **done** (`Trip On Himalaya CRM lifecycle events…` Off).  
4. Do **not** pause Facebook Lead Ads Zap until Meta dual-path tested.  
5. Watch 24–72h: tasks, WA confirm, payment reminders, ops prep.  
6. ~~Railway cutover vars~~ — **done** (`ZAPIER_EVENTS_ENABLED=false`, migrate shadow on, dry-run off, legacy effects off).

## Rollback

See `ROLLBACK_PLAN.md` — flip `AUTOMATION_LEGACY_EFFECTS_ENABLED=true` and/or `ZAPIER_EVENTS_ENABLED=true`.

## Change log

| Date | Change |
|---|---|
| 2026-11-15 | Phase 0–4 shadow build |
| 2026-11-15 | **Cutover approved:** legacy off, engine live, Zapier events default false |

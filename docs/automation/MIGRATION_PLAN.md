# Automation migration plan (Zapier → native)

> **Date:** 2026-11-15  
> **Principle:** Own orchestration inside Trip On Himalaya Business OS. Keep external providers (Meta, Interakt, SES, Razorpay). Never auto-disable Zaps.

## 0. Architecture decision (locks preferred stack to reality)

The brief preferred TypeScript / Prisma / Redis / BullMQ. **This repository is already a Java/Spring modular monolith with a Postgres transactional outbox and workflow engine (ADR 0006).**

| Brief preference | Decision for this repo |
|---|---|
| BullMQ workers | Use existing `@Scheduled` pollers + optional RabbitMQ for WA delivery |
| Prisma | Keep Flyway + JPA |
| New Node automation service | **Rejected** unless ADR revisits 0002/0006 — would split the system of record |
| Zapier replacement | Remove Catch Hook *dependency*; keep Zapier as rollback until approved pause |
| Domain events | Extend `DurableEventPublisher` / `AutomationEvent` — do not invent a parallel bus |

## 1. Phased work (controlled)

| Phase | Goal | Exit criteria | Destructive? |
|---|---|---|---|
| **0** Investigation | Stack + seams understood | This doc set | No |
| **1** Zapier audit | Z1–Z4 + native inventory complete | Inventory + mapping signed | No |
| **2** Engine hardening | Outbox, rules, actions, logs meet production checklist | Tests + desk visibility | No |
| **3** Zap parity builds | Native paths for Z1–Z4 behind flags | Parity tests green in non-prod | No |
| **4** MIGRATE templates | Move M1–M9 hard-coded rules into versioned workflows (shadow) | Shadow parity | No |
| **5** Integration adapters | SES/Interakt/Meta/Slack health + metrics | Adapter health on desk | No |
| **6** Automation admin desk | Extend Automations desk beyond Zap Ready pills | RBAC-gated UI | No |
| **7** Security / reliability | Idempotency, DLQ, audit, webhook verify | Checklist in SECURITY.md | No |
| **8** Parity report | Per-Zap old vs new | `MIGRATION_STATUS.md` | No |
| **9** Cutover | One Zap at a time, manual pause | Explicit approval each Zap | **Approval required** |

## 2. Cutover process (mandatory)

For each Zap Z1→Z4 (and later each MIGRATE template):

1. Document current Zap behaviour (inventory row).  
2. Implement native equivalent behind a feature flag / delivery mode.  
3. Dev + controlled integration tests.  
4. Compare outputs (records, templates, recipients) — **shadow must not send real guest spam or money side effects**.  
5. Staging / test-account live send.  
6. **Obtain explicit approval.**  
7. Switch traffic (e.g. campaign mode default INLINE; stop publishing to Catch Hook).  
8. Watch production 24–72h.  
9. Manually pause Zap in Zapier UI (human).  
10. Keep Zap + env URL for rollback (`ROLLBACK_PLAN.md`).

## 3. Priority order (business risk)

1. **Z3 / Z4** — easiest: INLINE modes already exist; flip defaults + prove SendGate.  
2. **Z2** — replace Catch Hook with SES/`NOTIFY_USER`; keep publishing optional.  
3. **Z1** — Meta native webhook cutover; careful dedupe vs Zap.  
4. **MIGRATE M1–M9** — engine shadow; longest; no Zap dependency.

## 4. Non-goals (explicit)

- Replacing Interakt / SES / Razorpay / Meta APIs with “Zapier clones”.  
- Drag-and-drop BPMN builder in v1 (structured JSON workflows + desk first).  
- Kafka / Temporal / Camunda (ADR 0006/0007).  
- Deleting Flyway history, lead tables, or CORE safety paths.  
- Mixing storefront repo into CRM automation (`repo-boundaries`).

## 5. Deliverable map

| Deliverable | Location |
|---|---|
| Inventory | `ZAPIER_INVENTORY.md` |
| Mapping | `ZAPIER_WORKFLOW_MAPPING.md` |
| Integrations | `CURRENT_INTEGRATIONS.md` |
| Status | `MIGRATION_STATUS.md` |
| Engine architecture | `ARCHITECTURE.md` |
| Adapter guide | `INTEGRATION_GUIDE.md` (Phase 4+) |
| Rollback | `ROLLBACK_PLAN.md` |

## 6. Immediate next engineering steps (after audit approval to code)

Still **non-destructive**:

1. Feature-flag `ZapierEventsClient` no-op with metrics when `ZAPIER_EVENTS_HOOK_URL` blank or `app.zapier.events-enabled=false`.  
2. Campaign desk: default delivery mode INLINE when SES/Interakt configured.  
3. Automations desk: show native vs Zap pipe health separately.  
4. Shadow logging for Z2 events (write `automation_events` without Catch Hook).  
5. Parity tests for bulk email/WA INLINE paths.

**Do not** pause Zaps or clear Railway hook URLs until Phase 9 approval.

# Native automation architecture (as-built + target)

> **Date:** 2026-11-15  
> Complements `docs/EVENT_ARCHITECTURE.md`, ADR 0005 (RabbitMQ delivery), ADR 0006 (build engine).

## 1. As-built pipeline

```text
Domain mutation (LeadService, BookingService, …)
      │
      ├─ sync side effects (CORE: handoff, seats, audit, consent)
      │
      ├─ Spring AFTER_COMMIT events (BookingConfirmed, *Queued)
      │
      ├─ DurableEventPublisher → automation_events (outbox)
      │         │
      │         ▼
      │   AutomationEventRelay (SKIP LOCKED)
      │         │
      │         ▼
      │   ConditionEvaluator → ActionExecutor (CREATE_TASK, SEND_MESSAGE, …)
      │         │
      │         ▼
      │   WorkflowRun / WorkflowRunStep (+ WAIT via scheduled_steps poller)
      │
      ├─ @Scheduled sweeps (FollowUp, Payment, Campaigns, Doc, PostTrip, …)
      │
      └─ ZapierEventsClient / Zapier*HookClient (optional HTTP edge)
                │
                ▼
          Zapier Catch Hook (to be retired per Zap after approval)
```

## 2. Target (Zap-free orchestration)

Same diagram **without** the Zapier edge. Outbound guest messaging always through **SendGate → EmailGateway / WhatsAppGateway / SmsGateway**. Staff alerts through **NOTIFY_USER + EmailGateway** (and future Slack adapter). Meta intake through **native signed webhooks**.

## 3. Required components vs brief

| Brief component | As-built | Gap |
|---|---|---|
| Domain events | `AutomationEvent`, Spring events | Broaden emit coverage; typed versions |
| Transactional outbox | `DurableEventPublisher`, `JpaEventOutboxStore` | Metrics / replay UI |
| Rule engine | `Workflow` + JSON definition + `ConditionEvaluator` | Migrate hard-coded FollowUp* into versions |
| Redis + BullMQ | Absent | **Not planned** — Postgres pollers + optional RabbitMQ |
| Background workers | In-process schedulers | Separate worker JVM only if load ADR triggers |
| Integration adapters | communications/, marketing/, payment/webhook | Slack; health panel |
| Execution logs | `WorkflowRun*`, campaign recipient status | Unify on Automations desk |

## 4. Closed action vocabulary

See `ActionType.java`: `CREATE_TASK`, `CANCEL_OPEN_TASKS`, `ASSIGN_OWNER`, `UPDATE_FIELD`, `SEND_MESSAGE`, `NOTIFY_USER`, `REQUEST_APPROVAL`, `ADD_TAG`, `ENROLL_SEQUENCE`, `WAIT`, `BRANCH`, `CALL_WEBHOOK`, `STOP`.

`SEND_MESSAGE` and `CALL_WEBHOOK` remain allow-listed and consent/SSRF guarded (Module 3).

Phase 4 cutover: `MigrateWorkflowTemplates` + `MigrateTemplateBootstrap` keep **M1–M9** ACTIVE when `AUTOMATION_MIGRATE_SHADOW_ENABLED=true`. Engine effects apply when `dry-run-enabled=false`. Hard-coded MIGRATE side effects are gated by `legacy-effects-enabled` (cutover default false). Outbox producers: FollowUp, `BookingService` (`booking.confirmed`), `PaymentSweep` (`payment.due_soon` / `payment.overdue`), `CapacityAlertService` (`batch.scarcity_alert`).

## 5. CORE boundaries (never configurable)

Seat-hold expiry, compliance READY gate, ops handoff uniqueness, Razorpay confirmation, consent/SendGate, dispatch state machine, audit, commission ledger — from `AUTOMATION_INVENTORY.md` §3.3.

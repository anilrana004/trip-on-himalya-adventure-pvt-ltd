# Follow-up desk, dashboard drill-down, reminders & message alerts

## Root causes (client report)

1. **Today’s follow-ups unclear** — Thin overdue/today API existed, but no upcoming/completed buckets, no desk complete/reschedule/notes, and no dashboard entry point.
2. **Dashboard counts not clickable** — KPI cards were display-only; Leads Management only read `?focus=` and ignored `?status=` / `?period=`.
3. **No due-time pop-ups** — Morning digest + task SLA reminders existed; nothing fired when `lead.follow_up_at` became due, and the bell had no toast layer.
4. **No message sound** — Inbound WhatsApp/email/SMS persisted without staff `Notification` rows; frontend had no realtime channel (no WebSocket) and no audio UX.

## What shipped

| Area | Behaviour |
|---|---|
| Desk | `/follow-ups` — Overdue / Today / Upcoming (7d) / Completed (14d), RBAC-scoped, owner filter for managers |
| Actions | Mark completed, reschedule, notes — do **not** complete merely by opening the lead |
| Dashboard | Total / New / pipeline cards link to filtered `/leads` or `/follow-ups` |
| Leads URL | `?status=NEW`, `?period=all`, `?focus=<id>` |
| Due reminder | `LeadFollowUpDueSweep` every 2 min IST; idempotent via `follow_up_notified_at` + `notifications.dedupe_key` |
| Message alert | `InboundStaffNotifier` on new inbound; toast + optional chime via `LiveAlerts` (15s poll) |

## Migrations

- `V50__lead_follow_up_at.sql` — `follow_up_at`
- `V51__follow_up_desk_and_notify_dedupe.sql` — notes, completed_at, notified_at, notification dedupe

## Deploy

1. Deploy CRM backend (Flyway V50–V51).
2. Deploy CRM frontend.
3. Confirm Asia/Kolkata schedules on the host.
4. Click once in the CRM to unlock browser audio if sound is desired.

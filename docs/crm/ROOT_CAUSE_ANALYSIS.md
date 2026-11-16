# Root cause analysis

## 1. Follow-up visibility

**Cause:** Lead had date-only `follow_up_date` historically; later `follow_up_at` + `/follow-ups` desk were added but incomplete vs client needs (upcoming/completed, actions, dashboard entry). Task SLA reminders and lead `follow_up_at` were two clocks.

**Fix direction:** Single lead follow-up instant (IST), desk buckets, complete/reschedule/notes without auto-complete on open.

## 2. Reminders

**Cause:** Morning digest only; no due-time sweep for `follow_up_at`. Bell poll only — no toast. No Redis/BullMQ/WebSocket in this stack (Spring `@Scheduled` + Postgres notifications).

**Fix direction:** `LeadFollowUpDueSweep` + `dedupe_key` + `LiveAlerts` poll/toast.

## 3. Lead delete

**Cause:** No DELETE API historically; hard-delete was later added but client requires soft archive with history preserved.

**Fix direction:** Soft-delete (`deleted_at` / `deleted_by` / reason); exclude from active lists/counts; block only where needed; restore for admins.

## 4. Total Leads mismatch

**Cause:** `DashboardService.summary` counted `SELECT count(*) FROM leads` with **no owner scope** and **no deleted filter**. Leads list API scoped sales to `owner_id` and often month `from`/`to`. Different definitions → different numbers.

**Fix direction:** One definition: active (`deleted_at IS NULL`) + RBAC owner scope; dashboard and list share that rule.

## 5. Dashboard navigation

**Cause:** Cards had no `href`/`onClick`; leads page ignored `?status=` / `?period=`.

**Fix direction:** Wire cards + URL filters (already partially done; verify Qualified = INTERESTED, Converted = BOOKING_CONFIRMED).

## 6. Message sound

**Cause:** Inbound persisted without staff notification; no Socket.IO.

**Fix direction:** `InboundStaffNotifier` + `LiveAlerts` chime after audio unlock.

## 7. Timers

**Cause:** `SessionTimer` and `WorkdayHours` 1s ticks are decorative live clocks, not follow-up scheduling.

**Fix direction:** Remove sidebar session countdown; stop WorkdayHours second-tick (keep hours snapshot from API poll).
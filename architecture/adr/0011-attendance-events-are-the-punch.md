# ADR 0011 — Attendance punches are events, and the day is India time

- **Status:** Accepted
- **Date:** 2026-10-25
- **Relates to:** `attendance`, `staff_attendance`, `users.reports_to`

## Context

`staff_attendance` stored one mutable row per person per day. Check-in and
check-out overwrote that row, so a second punch destroyed the first and
nothing recorded who changed it. The screen also sent
`new Date().toISOString().slice(0, 10)`, which is the UTC date. After
midnight in India that is still the previous UTC day.

Managers could see every employee. There was no `reports_to`, so "their
team" was the whole company. Finance is not part of the live register.

## Decision

A punch is an insert into `attendance_events`. The row is not updated.
The server time is the punch time. The work date is that instant in
`Asia/Kolkata`. The device time is stored beside it, and a difference of
more than five minutes is flagged.

`staff_attendance` remains the daily summary. It is recalculated from the
events: the first check-in and the latest check-out. A repeated check-in
does not move the first one.

An employee sees and punches only their own row. A manager also sees people
whose `reports_to` is that manager. Admin and CEO see the company. Only
admin or CEO can set `reports_to`. Sending the same client event id again
returns the original punch.

Leave stays on its current screen. Payroll is not calculated from these
events in this step.

## Consequences

Older clients that still post to `/api/basecamp/attendance` append an event.
A work date or status in that body is ignored. Rules such as late, half day,
holidays, and month lock are a later step, as are location, selfie, and the
payroll snapshot.

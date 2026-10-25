# ADR 0012 — A work day is calculated, and a manager sees direct reports

- **Status:** Accepted
- **Date:** 2026-10-25
- **Relates to:** `attendance`, `staff_attendance`, `staff_leave_requests`

## Context

Step 1 stores every punch and dates it as the India calendar day. An
overnight shift that ends after midnight would be split across two dates.
The daily row was always `PRESENT`, including a check-in with no check-out.
Two punches at once could each rebuild the summary from a partial list.

`reports_to` rejected a person reporting to themselves and a two-person
swap. A longer cycle was accepted, and an inactive person could be chosen
as manager. A manager could not be given several reports in one action.

There is one company, not a branch ledger. There is no leave-balance table.

## Decision

The work date is the day the assigned shift started. When nobody is
assigned, the date stays the India calendar day. The server clock is
injected. A phone clock that disagrees by more than
`app.attendance.clock-skew-minutes` (default 5) raises a review flag and
the punch is still saved.

The summary is rebuilt only from events, the rule in force on that date,
approved leave, the Dehradun holiday calendar, and the weekly off. The
rebuild holds a transaction advisory lock on the person and the date.
Approved leave wins, then a holiday, then a weekly off, then time worked.
Worked time is the sum of closed check-in/check-out pairs. A missing
check-out is `INCOMPLETE`. `LATE` and clock-off stay flags. A new rule
starts on its effective date and does not rewrite older summaries.

A manager sees their own row and people who report directly to them, not
that person's reports. Admin and CEO see the company. Setting `reports_to`
rejects any cycle, an inactive manager, and a new manager for an inactive
employee. The change can be one person or a batch, and the batch is one
transaction.

Leave that covers a holiday or weekly off does not count that day as
chargeable. There is no balance to deduct. Cancelling leave recomputes
the days. A nightly job holds a session advisory lock, creates a summary
for a finished day that has no punches, and skips a locked month and any
summary that already exists.

## Consequences

People with no shift keep the calendar day from step 1. Comp-off is minutes
on the day, not a leave request and not payroll. The month-lock table is
empty until a later step adds the lock screen. Changing leave dates is
cancel and create again.

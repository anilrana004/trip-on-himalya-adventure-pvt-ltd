# Testing report

## Unit tests executed (Maven)

Command:

```text
mvn -Dtest=LeadServiceTest,LeadFollowUpDeskTest,LeadSoftDeleteTest,NotificationWriterTest,MetaLeadgenServiceTest test
```

**Result: PASS (exit 0)** — 2026-11-16

| Suite | Coverage |
|---|---|
| LeadServiceTest | Create/consent/status |
| LeadFollowUpDeskTest | Today/overdue buckets, complete, reschedule, manager owner scope |
| LeadSoftDeleteTest | Archive, RBAC deny sales, restore admin, double-archive |
| NotificationWriterTest | Dedupe skip / persist |
| MetaLeadgenServiceTest | Meta ingest unchanged |

## Manual / desktop

Desktop UI smoke deferred to post-deploy (local stack may not be running). Acceptance checks after Railway deploy:

1. Dashboard Total Leads = `/leads?period=all` totalElements for same user.
2. Qualified / Converted cards open INTERESTED / BOOKING_CONFIRMED lists.
3. `/follow-ups` shows IST times; complete removes from pending.
4. Archive lead → disappears from list/counts; booking rows intact.
5. Sidebar has no session countdown clock.

## Rollback

Revert commits on `himalaya/main` and re-deploy prior image. V50–V52 columns are additive; soft-deleted rows can be restored via `POST /api/leads/{id}/restore`.
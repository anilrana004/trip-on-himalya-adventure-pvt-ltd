# Implementation plan

1. Soft-delete leads (V52) + restore for ADMIN/CEO; exclude deleted from search, follow-ups, dashboard.
2. Scope dashboard summary lead counts by RBAC + `deleted_at IS NULL`.
3. Confirm Leads Management URL filters and KPI click handlers for Total / Qualified / Converted.
4. Remove SessionTimer; neutralize WorkdayHours live second countdown.
5. Docs + unit tests + push to `himalaya` CRM remote only.

Stack: Spring Boot + Next.js + Postgres/Flyway. Schedulers: `@Scheduled`. No Prisma/Redis/BullMQ.
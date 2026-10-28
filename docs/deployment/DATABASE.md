# Database (PostgreSQL)

Detail: [`../DATABASE.md`](../DATABASE.md). Audit: [`../architecture/EXISTING_SYSTEM_AUDIT.md`](../architecture/EXISTING_SYSTEM_AUDIT.md).

## Decision (2026-10-28)

**Retain Railway-oriented PostgreSQL.** Neon is optional later — no automatic migration.

## Rules

- Flyway is the schema authority; Hibernate `ddl-auto: validate`
- Credentials only on the API / backup job — never on Vercel
- Prefer private networking URL on Railway when available
- Backups: [`../disaster-recovery/BACKUP_POLICY.md`](../disaster-recovery/BACKUP_POLICY.md)

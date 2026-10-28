# Final architecture (current target)

```text
Users
  │
  ▼
Vercel (Next.js 15)  app.<domain>
  │  HTTPS  /api rewrite (API_PROXY_TARGET)
  ▼
Railway API (Spring Boot 3.5 / Java 25)
  │
  ├── Railway PostgreSQL 16 + Flyway
  │     ├── Provider snapshots / PITR (confirm in console)
  │     └── Daily pg_dump job → dedicated object storage (infra/backup)
  │
  ├── S3-compatible documents (STORAGE_* on API)
  │
  ├── Optional RabbitMQ (MESSAGING_MODE=BROKER; default INLINE)
  │
  └── Integrations: website webhook, Meta, Interakt, SES/MSG91
```

**Not in early architecture:** Redis, BullMQ, Kubernetes, Kafka, second CRM DB, Neon (unless later approved).

See also: `EXISTING_SYSTEM_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `../DEPLOYMENT.md`.

# Cost and scaling

Early-stage CRM. Prefer one API replica + managed Postgres until metrics say otherwise.  
**Verify current vendor prices before budgeting** — figures below are planning classes, not quotes.

## Baseline components

| Component | Role | Scale trigger |
|---|---|---|
| Vercel | Next.js UI + `/api` rewrite | High SSR / bandwidth |
| Railway API | Spring Boot monolith | CPU/RAM, request latency |
| Railway Postgres | System of record | Storage, connections, CPU |
| Object storage | Documents + **separate** backups | GB stored / egress |
| Redis | **Not deployed** | Multi-instance rate limit or shared locks |
| RabbitMQ | Optional (`MESSAGING_MODE=BROKER`) | INLINE insufficient for delivery volume |

## Independent upgrades

1. **API** — raise Railway memory/CPU; keep `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75.0`.
2. **Postgres** — raise plan; lower Hikari `maximum-pool-size` if connections exhaust; add read replica only with a clear read path.
3. **Frontend** — Vercel plan; cache static assets; keep business logic on API.
4. **Backups** — storage class / lifecycle only; cron stays tiny.
5. **Workers** — split `@Scheduled` to a worker service **or** add ShedLock/Redis when running ≥2 API replicas.

## What not to do early

- Kubernetes, Kafka, second CRM database
- Redis “just in case”
- Neon migration without a written cost/PITR win
- Multi-region until single-region RPO/RTO is proven

## Capacity claims

Do **not** publish concurrent-user guarantees without load tests. Measure:

- p95 latency on `/api/leads` and login
- Hikari active connections under peak
- Cron dump duration vs DB size

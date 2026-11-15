# Current integrations (Phase Zero)

> **Date:** 2026-11-15  
> **Scope:** `securetravels-crm` (Trip On Himalaya Business OS / CRM)  
> **Companion:** `docs/INTEGRATIONS.md` (product-wide map), this file focuses on automation-relevant adapters.

## 1. Stack reality (do not assume Node/Prisma)

| Layer | Actual technology | Notes |
|---|---|---|
| API | Java 25, Spring Boot 3.5 | Modular monolith under `backend/` |
| UI | Next.js 15, React 19, TypeScript | `frontend/` — CRM desks only |
| DB | PostgreSQL 16 + Flyway + JPA/Hibernate | No Prisma |
| Queues | Optional RabbitMQ (`MESSAGING_MODE=BROKER`) | Default `INLINE` |
| Redis / BullMQ | **Not present** | Documented as Planned only |
| Schedulers | Spring `@Scheduled` in API JVM | No separate worker deployable |
| Automation engine | Native `com.securetravels.crm.automation` | Outbox + workflows in Postgres (ADR 0006) |
| Deploy | Railway (API), Vercel (UI), Compose local | |

**Implication for migration:** extend the existing Spring outbox + workflow engine and SendGate adapters. Do **not** introduce a second Node/BullMQ automation runtime unless an ADR revisits ADR 0002/0006/0007.

## 2. Inbound integrations (CRM receives)

| System | Endpoint | Auth | Owner package | Zapier involved? |
|---|---|---|---|---|
| Storefront / website leads | `POST /api/webhook/lead` | HMAC `X-Webhook-Signature` | `webhook/` | Optional (FB Lead Ads Zap posts here) |
| Meta Page / Lead Forms (native) | `GET/POST /api/webhook/meta` | Hub verify + `X-Hub-Signature-256` | `marketing/` | Parallel path; FB Zap is the ops pipe today |
| Interakt WhatsApp | `POST /api/webhook/interakt` | `Interakt-Signature` | `communications/` | No |
| Razorpay payments | `POST /api/webhook/payments/razorpay` | `X-Razorpay-Signature` | `payment/webhook/` | No (CORE money path) |
| SES email events | `POST /api/v1/webhooks/email` | HMAC | `communications/email/` | No |
| SMS provider events | `POST /api/v1/webhooks/sms` | HMAC | `communications/sms/` | No |

## 3. Outbound integrations (CRM calls)

| System | Interface | Modes | Zapier involved? |
|---|---|---|---|
| Email | `EmailGateway` | `SANDBOX` (default), `SES` | Bulk campaigns may use Catch Hook instead of SendGate |
| WhatsApp | `WhatsAppGateway` | `SANDBOX` (default), `INTERAKT` | Bulk campaigns may use Catch Hook; guest booking confirm is native |
| SMS | `SmsGateway` | `SANDBOX`, `MSG91` | No |
| Meta Graph | Marketing clients | Token from env | No (reads/ads) |
| Zapier Catch Hooks | HTTP POST + HMAC | Env URLs | **Yes** — alert + bulk pipes |
| S3-compatible storage | Presign | MinIO local / S3 prod | No |

## 4. Environment variables (automation-relevant)

| Variable | Direction | Purpose |
|---|---|---|
| `WEBHOOK_SECRET` | In + Out HMAC | Lead webhook + Zapier outbound signatures |
| `ZAPIER_EVENTS_HOOK_URL` | Out | Lifecycle alerts Catch Hook |
| `ZAPIER_EMAIL_HOOK_URL` | Out | Bulk email Catch Hook |
| `ZAPIER_WHATSAPP_HOOK_URL` | Out | Bulk WhatsApp Catch Hook |
| `WHATSAPP_MODE` / `INTERAKT_*` | Out + In | Native WhatsApp |
| `EMAIL_*` / SES | Out + In | Native email |
| `RAZORPAY_WEBHOOK_SECRET` | In | Payment confirmation (CORE) |
| `MESSAGING_MODE` | Internal | `INLINE` vs RabbitMQ WhatsApp delivery |

See `.env.example` and `docs/deployment/*_ZAPIER.md`.

## 5. Native automation already owned by CRM

These are **not** Zapier workflows. They run as hard-coded services, sweeps, or the Phase 6 workflow engine. Full classification: `docs/AUTOMATION_INVENTORY.md`.

Highlights:

- Lead assignment (round-robin), speed-to-lead, follow-up cadence, quotation chase  
- Booking confirmation WhatsApp (SendGate), ops handoff  
- Payment overdue / balance reminders, document-missing reminders  
- Post-trip engagement sweep, inactive-lead nudge, manager digest  
- Seat-hold expiry, capacity/min-group alerts (CORE safety)  
- Consent / SendGate / dispatch state machines (CORE)

## 6. Access gaps for live Zapier audit

| Need | Status | Why |
|---|---|---|
| Zap definitions / run history export | **Not in repo** | Zapier does not store Zaps in Git |
| Zapier MCP “list Zaps” | **Unavailable** | MCP exposes app *actions*, not Zap inventory |
| Connected apps (MCP sample) | Partial | Facebook Lead Ads connection present; Gmail/Slack connections often empty (Email by Zapier used instead) |
| Production Catch Hook URLs | On Railway env (secrets) | Confirmed pattern `hooks.zapier.com/hooks/catch/{owner}/{id}/` |

Live Zap IDs observed during operator setup (laptop session, not committed secrets):

| Pipe | Approximate Zap id | Catch path (temp) |
|---|---|---|
| Lifecycle events | `386455086` | `…/452bw8o/` |
| Bulk email | `386460099` | `…/45248ew/` |
| Bulk WhatsApp | `386461037` | `…/4526t03/` |

Re-verify in Zapier UI before cutover; IDs may change if Catch Hooks are replaced.

# Meta WhatsApp Cloud API

Trip On Himalaya sends WhatsApp **directly via Meta Cloud API** (company WABA). No Interakt / BSP.

## Modes

| `WHATSAPP_MODE` | Behaviour |
|---|---|
| `SANDBOX` (default) | Logs send, synthetic message id |
| `META` | `POST https://graph.facebook.com/{version}/{phone-number-id}/messages` |

## Railway variables

```
WHATSAPP_MODE=META
META_WA_PHONE_NUMBER_ID=...
META_WA_ACCESS_TOKEN=...
META_WA_APP_SECRET=...          # optional webhook verify later
META_WA_WEBHOOK_VERIFY_TOKEN=...
META_WA_GRAPH_VERSION=v21.0
```

Templates in CRM (`whatsapp_templates.interakt_name`) must match **approved Meta template names**.

## In-house AI agent

`AI_AGENT_ENABLED=true` turns on OWN compose rules (no OpenAI). Automation M12/M13 send via SendGate when email/WhatsApp is workable.

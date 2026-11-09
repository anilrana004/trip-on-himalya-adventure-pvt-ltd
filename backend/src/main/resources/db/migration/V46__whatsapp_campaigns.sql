-- Bulk WhatsApp campaigns (manager-triggered). Delivery = INLINE (SendGate/Interakt)
-- or ZAPIER (catch hook). Recipients snapshotted at create time.

CREATE TABLE whatsapp_campaigns (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              varchar(200) NOT NULL,
    template_code     varchar(80),
    body_text         text,
    delivery_mode     varchar(20) NOT NULL DEFAULT 'ZAPIER'
                      CHECK (delivery_mode IN ('INLINE', 'ZAPIER')),
    status            varchar(20) NOT NULL DEFAULT 'QUEUED'
                      CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED')),
    created_by        uuid REFERENCES users(id),
    total_recipients  integer NOT NULL DEFAULT 0,
    sent_count        integer NOT NULL DEFAULT 0,
    failed_count      integer NOT NULL DEFAULT 0,
    skipped_count     integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    started_at        timestamptz,
    completed_at      timestamptz
);

CREATE TABLE whatsapp_campaign_recipients (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     uuid NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
    lead_id         uuid NOT NULL REFERENCES leads(id),
    mobile          varchar(30) NOT NULL,
    customer_name   varchar(200) NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'QUEUED'
                    CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'SKIPPED')),
    skip_reason     varchar(200),
    error_message   varchar(1000),
    provider_ref    varchar(120),
    attempts        integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz
);

CREATE INDEX idx_whatsapp_campaign_recipients_queue
    ON whatsapp_campaign_recipients (status, created_at)
    WHERE status = 'QUEUED';

CREATE INDEX idx_whatsapp_campaign_recipients_campaign
    ON whatsapp_campaign_recipients (campaign_id, status);

-- Transactional follow-up template for open leads (bulk / Zapier).
INSERT INTO whatsapp_templates
    (code, interakt_name, label, language_code, expected_params, category, approval_status, enabled)
VALUES
    ('LEAD_FOLLOW_UP', 'securetravels_lead_follow_up', 'Lead follow-up', 'en',
     2, 'TRANSACTIONAL', 'APPROVED', true)
ON CONFLICT (code) DO NOTHING;

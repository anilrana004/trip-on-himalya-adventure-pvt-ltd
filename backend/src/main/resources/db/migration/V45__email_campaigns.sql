-- Bulk email campaigns (manager-triggered). Delivery = INLINE (SendGate/SES)
-- or ZAPIER (catch hook). Recipients are snapshotted at create time.

CREATE TABLE email_campaigns (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              varchar(200) NOT NULL,
    template_code     varchar(80),
    subject_override  varchar(300),
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

CREATE TABLE email_campaign_recipients (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    lead_id         uuid NOT NULL REFERENCES leads(id),
    email           varchar(255) NOT NULL,
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

CREATE INDEX idx_email_campaign_recipients_queue
    ON email_campaign_recipients (status, created_at)
    WHERE status = 'QUEUED';

CREATE INDEX idx_email_campaign_recipients_campaign
    ON email_campaign_recipients (campaign_id, status);

-- Transactional follow-up for open leads (bulk / Zapier).
INSERT INTO channel_templates
    (channel, code, label, language_code, subject_line, body, expected_params, category, approval_status)
VALUES
    ('EMAIL', 'LEAD_FOLLOW_UP', 'Lead follow-up', 'en',
     'Following up on your {{1}} enquiry, {{2}}',
     'Hello {{2}},' || chr(10) ||
     'Thank you for your interest in {{1}} with Trip On Himalaya.' || chr(10) ||
     'Our advisor will help you with dates, group size and the next steps.' || chr(10) ||
     'Reply to this email if you have a preferred departure window.',
     2, 'TRANSACTIONAL', 'APPROVED')
ON CONFLICT (channel, code) DO NOTHING;

-- Follow-up desk: notes, completion, due-reminder idempotency.
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS follow_up_notes text,
    ADD COLUMN IF NOT EXISTS follow_up_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS follow_up_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_follow_up_completed
    ON leads (follow_up_completed_at DESC)
    WHERE follow_up_completed_at IS NOT NULL;

-- Idempotent in-app notifications (due follow-up + inbound message).
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dedupe_key varchar(160);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_dedupe
    ON notifications (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

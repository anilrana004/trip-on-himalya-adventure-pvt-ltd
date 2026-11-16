-- Soft-delete / archive for leads. Active CRM lists and dashboard counts
-- exclude rows where deleted_at IS NOT NULL. Bookings remain linked.
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS deletion_reason varchar(500);

CREATE INDEX IF NOT EXISTS idx_leads_active_owner_status
    ON leads (owner_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_deleted_at
    ON leads (deleted_at)
    WHERE deleted_at IS NOT NULL;

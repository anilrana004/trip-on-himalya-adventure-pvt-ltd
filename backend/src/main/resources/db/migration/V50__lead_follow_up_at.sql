-- Follow-up date+time on leads (sales desk). Keep follow_up_date for list badges.
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

-- Backfill: existing calendar dates become 10:00 Asia/Kolkata that day.
UPDATE leads
   SET follow_up_at = (follow_up_date::timestamp + time '10:00') AT TIME ZONE 'Asia/Kolkata'
 WHERE follow_up_date IS NOT NULL
   AND follow_up_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_follow_up_at
    ON leads (owner_id, follow_up_at)
    WHERE follow_up_at IS NOT NULL
      AND status NOT IN ('LOST', 'BOOKING_CONFIRMED');

-- Sales follow-up reminders + call attempt trail (manager/admin oversight).

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS call_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS lead_call_attempts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id       uuid NOT NULL REFERENCES leads(id),
    actor_id      uuid REFERENCES users(id),
    outcome       varchar(30) NOT NULL
                  CHECK (outcome IN ('CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'CALLBACK', 'OTHER')),
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_call_attempts_lead
    ON lead_call_attempts (lead_id, created_at DESC);

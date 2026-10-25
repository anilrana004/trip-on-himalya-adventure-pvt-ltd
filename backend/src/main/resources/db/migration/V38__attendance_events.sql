-- Append-only punches. The daily staff_attendance row stays a summary
-- rebuilt from these events. It is no longer the punch itself.

ALTER TABLE users
    ADD COLUMN reports_to UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX idx_users_reports_to ON users (reports_to);

ALTER TABLE staff_attendance
    ADD COLUMN clock_skew_flagged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE attendance_events (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users (id),
    client_event_id     UUID,
    event_type          VARCHAR(20) NOT NULL,
    work_date           DATE NOT NULL,
    server_time         TIMESTAMPTZ NOT NULL,
    device_time         TIMESTAMPTZ,
    clock_skew_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_by         UUID REFERENCES users (id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_attendance_event_type CHECK (event_type IN ('CHECK_IN', 'CHECK_OUT')),
    CONSTRAINT uq_attendance_client_event UNIQUE (client_event_id)
);

CREATE INDEX idx_attendance_events_user_date
    ON attendance_events (user_id, work_date, server_time);

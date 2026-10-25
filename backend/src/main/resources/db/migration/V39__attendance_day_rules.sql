-- Day rules. Punches stay in attendance_events. This migration adds the
-- shift, holiday, weekly-off, and versioned rule tables the summary is
-- calculated from. V27 and V38 are not modified.

CREATE TABLE shifts (
    id          UUID PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shift_assignments (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    shift_id        UUID NOT NULL REFERENCES shifts (id),
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_shift_assignments_user
    ON shift_assignments (user_id, effective_from DESC);

CREATE TABLE weekly_off_rules (
    id          UUID PRIMARY KEY,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT uq_weekly_off_day UNIQUE (day_of_week)
);

CREATE TABLE holiday_calendars (
    id    UUID PRIMARY KEY,
    code  VARCHAR(40) NOT NULL UNIQUE,
    name  VARCHAR(120) NOT NULL
);

CREATE TABLE holidays (
    id           UUID PRIMARY KEY,
    calendar_id  UUID NOT NULL REFERENCES holiday_calendars (id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    name         VARCHAR(120) NOT NULL,
    CONSTRAINT uq_holiday_day UNIQUE (calendar_id, holiday_date)
);

CREATE TABLE attendance_rules (
    id                      UUID PRIMARY KEY,
    version                 INTEGER NOT NULL UNIQUE,
    effective_from          DATE NOT NULL,
    grace_minutes           INTEGER NOT NULL CHECK (grace_minutes >= 0),
    half_day_minutes        INTEGER NOT NULL CHECK (half_day_minutes > 0),
    full_day_minutes        INTEGER NOT NULL CHECK (full_day_minutes >= half_day_minutes),
    late_marks_to_halfday   INTEGER NOT NULL CHECK (late_marks_to_halfday > 0),
    overtime_after_minutes  INTEGER NOT NULL CHECK (overtime_after_minutes >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance_period_locks (
    period_month VARCHAR(7) PRIMARY KEY,
    locked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE staff_leave_requests
    ADD COLUMN portion VARCHAR(20) NOT NULL DEFAULT 'FULL'
        CHECK (portion IN ('FULL', 'FIRST_HALF', 'SECOND_HALF'));

DO $$
DECLARE
    cname text;
BEGIN
    SELECT con.conname INTO cname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'staff_attendance'::regclass
       AND con.contype = 'c'
       AND att.attname = 'status'
     LIMIT 1;
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE staff_attendance DROP CONSTRAINT %I', cname);
    END IF;
END $$;

ALTER TABLE staff_attendance
    ADD CONSTRAINT staff_attendance_status_check
        CHECK (status IN (
            'PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WFH',
            'HALF_DAY_LEAVE', 'HOLIDAY', 'WEEKLY_OFF', 'INCOMPLETE'
        ));

ALTER TABLE staff_attendance
    ADD COLUMN rule_version INTEGER,
    ADD COLUMN late_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN worked_minutes INTEGER,
    ADD COLUMN overtime_minutes INTEGER,
    ADD COLUMN comp_off_minutes INTEGER;

INSERT INTO holiday_calendars (id, code, name)
VALUES ('11111111-1111-4111-8111-111111111381', 'DEHRADUN', 'Dehradun');

INSERT INTO weekly_off_rules (id, day_of_week)
VALUES ('11111111-1111-4111-8111-111111111382', 7);

INSERT INTO shifts (id, name, start_time, end_time, active)
VALUES ('11111111-1111-4111-8111-111111111383', 'Office', '09:30', '18:30', TRUE);

INSERT INTO attendance_rules (
    id, version, effective_from, grace_minutes, half_day_minutes,
    full_day_minutes, late_marks_to_halfday, overtime_after_minutes)
VALUES (
    '11111111-1111-4111-8111-111111111384', 1, DATE '2000-01-01',
    15, 240, 480, 3, 540);

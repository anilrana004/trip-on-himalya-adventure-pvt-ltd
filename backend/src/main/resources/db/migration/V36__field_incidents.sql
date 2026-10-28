-- Field incidents logged by operations against a confirmed or completed booking.
-- The booking already carries the trek and, when it is a fixed departure, the batch.

CREATE TABLE field_incidents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    batch_id        uuid REFERENCES batches(id) ON DELETE SET NULL,
    kind            varchar(20) NOT NULL
        CHECK (kind IN ('MEDICAL', 'WEATHER', 'ALTITUDE', 'OTHER')),
    summary         text NOT NULL,
    occurred_on     date NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'RESOLVED')),
    resolution      text,
    reported_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         bigint NOT NULL DEFAULT 0
);

CREATE INDEX idx_field_incidents_status ON field_incidents (status, created_at DESC);
CREATE INDEX idx_field_incidents_booking ON field_incidents (booking_id);

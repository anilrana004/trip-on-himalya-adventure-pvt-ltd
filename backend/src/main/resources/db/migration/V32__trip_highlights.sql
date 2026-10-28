CREATE TABLE trip_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES trips (id),
    label varchar(160) NOT NULL,
    kind varchar(20) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    on_card boolean NOT NULL DEFAULT false,
    published boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trip_highlights_kind_chk CHECK (kind IN ('SUMMARY', 'CHIP'))
);

CREATE INDEX idx_trip_highlights_trip ON trip_highlights (trip_id, sort_order);

CREATE UNIQUE INDEX uq_trip_highlights_summary
    ON trip_highlights (trip_id)
    WHERE kind = 'SUMMARY';

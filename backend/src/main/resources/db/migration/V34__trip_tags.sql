CREATE TABLE trip_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES trips (id),
    label varchar(40) NOT NULL,
    kind varchar(20) NOT NULL,
    on_card boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trip_tags_kind_chk CHECK (kind IN ('TERRAIN', 'SEASON'))
);

CREATE INDEX idx_trip_tags_trip ON trip_tags (trip_id);

CREATE UNIQUE INDEX uq_trip_tags_label ON trip_tags (trip_id, lower(label));

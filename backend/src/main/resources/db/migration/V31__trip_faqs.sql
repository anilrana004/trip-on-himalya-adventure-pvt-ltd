CREATE TABLE trip_faqs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    uuid NOT NULL REFERENCES trips(id),
    question   varchar(300) NOT NULL,
    answer     text NOT NULL,
    published  boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_faqs_trip ON trip_faqs(trip_id);

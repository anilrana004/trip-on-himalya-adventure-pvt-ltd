CREATE TABLE trip_reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     uuid NOT NULL REFERENCES trips(id),
    booking_id  uuid REFERENCES bookings(id),
    guest_name  varchar(200) NOT NULL,
    rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body        text,
    status      varchar(20) NOT NULL CHECK (status IN ('PENDING', 'PUBLISHED', 'HIDDEN')),
    created_by  uuid REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_reviews_trip ON trip_reviews(trip_id, status);
CREATE UNIQUE INDEX uq_trip_reviews_booking ON trip_reviews(booking_id) WHERE booking_id IS NOT NULL;

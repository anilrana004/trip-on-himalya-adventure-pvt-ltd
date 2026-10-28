CREATE TABLE trip_waypoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES trips (id),
    name varchar(80) NOT NULL,
    kind varchar(20) NOT NULL,
    latitude numeric(9, 6) NOT NULL,
    longitude numeric(9, 6) NOT NULL,
    altitude_m integer,
    day_number integer,
    sort_order integer NOT NULL DEFAULT 0,
    created_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trip_waypoints_kind_chk CHECK (kind IN ('START', 'CAMP', 'SUMMIT', 'PASS', 'END')),
    CONSTRAINT trip_waypoints_lat_chk CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT trip_waypoints_lng_chk CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT trip_waypoints_alt_chk CHECK (altitude_m IS NULL OR altitude_m BETWEEN 0 AND 9000),
    CONSTRAINT trip_waypoints_day_chk CHECK (day_number IS NULL OR day_number BETWEEN 1 AND 21)
);

CREATE INDEX idx_trip_waypoints_trip ON trip_waypoints (trip_id, sort_order);

package com.securetravels.crm.trip.waypoint;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TripWaypointResponse(
        UUID id,
        UUID tripId,
        String tripName,
        String name,
        TripWaypoint.Kind kind,
        BigDecimal latitude,
        BigDecimal longitude,
        Integer altitudeM,
        Integer dayNumber,
        int sortOrder,
        Instant createdAt
) {
}

package com.securetravels.crm.trip.tag;

import java.time.Instant;
import java.util.UUID;

public record TripTagResponse(
        UUID id,
        UUID tripId,
        String tripName,
        String label,
        TripTag.Kind kind,
        boolean onCard,
        Instant createdAt
) {
}

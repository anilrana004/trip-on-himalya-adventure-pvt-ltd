package com.securetravels.crm.trip.highlight;

import java.time.Instant;
import java.util.UUID;

public record TripHighlightResponse(
        UUID id,
        UUID tripId,
        String tripName,
        String label,
        TripHighlight.Kind kind,
        int sortOrder,
        boolean onCard,
        boolean published,
        Instant createdAt
) {
}

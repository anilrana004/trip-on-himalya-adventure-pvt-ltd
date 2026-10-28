package com.securetravels.crm.trip.faq;

import java.time.Instant;
import java.util.UUID;

public record TripFaqResponse(
        UUID id,
        UUID tripId,
        String tripName,
        String question,
        String answer,
        boolean published,
        Instant createdAt
) {
}

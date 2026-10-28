package com.securetravels.crm.trip.faq;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TripFaqCopyRequest(
        @NotNull UUID fromTripId,
        @NotNull UUID toTripId
) {
}

package com.securetravels.crm.trip.highlight;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TripHighlightCopyRequest(
        @NotNull UUID fromTripId,
        @NotNull UUID toTripId
) {
}

package com.securetravels.crm.trip.tag;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TripTagCopyRequest(
        @NotNull UUID fromTripId,
        @NotNull UUID toTripId
) {
}

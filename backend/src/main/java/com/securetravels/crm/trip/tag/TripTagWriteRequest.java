package com.securetravels.crm.trip.tag;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record TripTagWriteRequest(
        @NotNull UUID tripId,
        @NotBlank @Size(max = 40) String label,
        @NotNull TripTag.Kind kind,
        Boolean onCard
) {
}

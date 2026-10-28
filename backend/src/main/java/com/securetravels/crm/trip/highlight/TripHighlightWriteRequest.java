package com.securetravels.crm.trip.highlight;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record TripHighlightWriteRequest(
        @NotNull UUID tripId,
        @NotBlank @Size(max = 160) String label,
        @NotNull TripHighlight.Kind kind,
        Boolean onCard,
        Boolean published,
        @Min(0) @Max(100) Integer sortOrder
) {
}

package com.securetravels.crm.trip.waypoint;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record TripWaypointWriteRequest(
        @NotNull UUID tripId,
        @NotBlank @Size(max = 80) String name,
        @NotNull TripWaypoint.Kind kind,
        @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        @Min(0) @Max(9000) Integer altitudeM,
        @Min(1) @Max(21) Integer dayNumber,
        @Min(0) @Max(100) Integer sortOrder
) {
}

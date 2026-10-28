package com.securetravels.crm.trip.dto;

import jakarta.validation.constraints.Size;

public record TripCloneRequest(
        @Size(max = 255) String name
) {
}

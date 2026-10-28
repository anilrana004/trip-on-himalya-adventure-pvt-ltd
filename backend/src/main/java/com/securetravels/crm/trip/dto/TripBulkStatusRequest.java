package com.securetravels.crm.trip.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record TripBulkStatusRequest(
        @NotEmpty @Size(max = 50) List<UUID> ids,
        @NotNull Boolean active
) {
}

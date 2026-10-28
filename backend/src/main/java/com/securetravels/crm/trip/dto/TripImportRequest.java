package com.securetravels.crm.trip.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TripImportRequest(
        @NotEmpty @Size(max = 40) @Valid List<TripCreateRequest> trips
) {
}

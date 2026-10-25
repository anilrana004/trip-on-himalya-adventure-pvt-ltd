package com.securetravels.crm.attendance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BulkReportsToRequest(
        @NotNull @Size(min = 1, max = 200) List<@Valid Assignment> assignments
) {
    public record Assignment(@NotNull UUID userId, UUID reportsTo) {
    }
}

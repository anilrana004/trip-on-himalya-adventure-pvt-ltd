package com.securetravels.crm.attendance.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record ShiftAssignmentRequest(
        @NotNull UUID userId,
        @NotNull UUID shiftId,
        @NotNull LocalDate effectiveFrom
) {
}

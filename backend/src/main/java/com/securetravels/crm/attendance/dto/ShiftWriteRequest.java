package com.securetravels.crm.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;

public record ShiftWriteRequest(
        @NotBlank @Size(max = 80) String name,
        @NotNull LocalTime start,
        @NotNull LocalTime end
) {
}

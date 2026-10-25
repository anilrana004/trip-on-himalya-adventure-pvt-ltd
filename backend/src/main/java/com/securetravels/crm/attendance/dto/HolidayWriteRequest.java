package com.securetravels.crm.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record HolidayWriteRequest(
        @NotNull LocalDate date,
        @NotBlank @Size(max = 120) String name
) {
}

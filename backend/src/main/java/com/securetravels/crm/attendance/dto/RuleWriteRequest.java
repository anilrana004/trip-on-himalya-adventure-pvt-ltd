package com.securetravels.crm.attendance.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RuleWriteRequest(
        @NotNull LocalDate effectiveFrom,
        @Min(0) int graceMinutes,
        @Min(1) int halfDayMinutes,
        @Min(1) int fullDayMinutes,
        @Min(1) int lateMarksToHalfDay,
        @Min(0) int overtimeAfterMinutes
) {
}

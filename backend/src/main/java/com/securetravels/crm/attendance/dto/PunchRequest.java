package com.securetravels.crm.attendance.dto;

import com.securetravels.crm.attendance.AttendanceEventType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record PunchRequest(
        UUID userId,
        @NotNull AttendanceEventType type,
        Instant deviceTime,
        UUID clientEventId,
        @Size(max = 500) String note
) {
}

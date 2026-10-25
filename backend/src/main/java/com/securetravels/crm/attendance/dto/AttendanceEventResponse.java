package com.securetravels.crm.attendance.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AttendanceEventResponse(
        UUID id,
        UUID userId,
        String type,
        LocalDate workDate,
        Instant serverTime,
        Instant deviceTime,
        boolean clockSkewFlagged,
        UUID recordedBy
) {
}

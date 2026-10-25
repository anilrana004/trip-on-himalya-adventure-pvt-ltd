package com.securetravels.crm.attendance.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AttendanceDayResponse(
        UUID id,
        UUID userId,
        String userName,
        LocalDate workDate,
        Instant checkInAt,
        Instant checkOutAt,
        String status,
        boolean clockSkewFlagged,
        boolean lateFlagged,
        Integer workedMinutes,
        Integer overtimeMinutes,
        Integer compOffMinutes,
        Integer ruleVersion,
        String notes
) {
}

package com.securetravels.crm.attendance;

import java.time.Instant;

public record DayVerdict(
        String status,
        Instant checkInAt,
        Instant checkOutAt,
        boolean late,
        int workedMinutes,
        int overtimeMinutes,
        int compOffMinutes,
        int ruleVersion
) {
}

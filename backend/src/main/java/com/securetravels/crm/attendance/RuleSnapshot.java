package com.securetravels.crm.attendance;

public record RuleSnapshot(
        int version,
        int graceMinutes,
        int halfDayMinutes,
        int fullDayMinutes,
        int lateMarksToHalfDay,
        int overtimeAfterMinutes
) {
}

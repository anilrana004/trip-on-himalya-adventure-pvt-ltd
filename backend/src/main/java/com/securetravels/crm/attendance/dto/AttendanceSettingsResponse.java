package com.securetravels.crm.attendance.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record AttendanceSettingsResponse(
        RuleView rule,
        List<ShiftView> shifts,
        List<Integer> weeklyOff,
        List<HolidayView> holidays,
        List<AssignmentView> assignments
) {
    public record RuleView(
            int version,
            LocalDate effectiveFrom,
            int graceMinutes,
            int halfDayMinutes,
            int fullDayMinutes,
            int lateMarksToHalfDay,
            int overtimeAfterMinutes
    ) {
    }

    public record ShiftView(UUID id, String name, LocalTime start, LocalTime end) {
    }

    public record HolidayView(UUID id, LocalDate date, String name) {
    }

    public record AssignmentView(UUID id, UUID userId, UUID shiftId, LocalDate effectiveFrom, LocalDate effectiveTo) {
    }
}

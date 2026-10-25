package com.securetravels.crm.attendance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DayFacts(
        LocalDate workDate,
        ShiftWindow shift,
        List<PunchPoint> punches,
        RuleSnapshot rule,
        boolean holiday,
        boolean weeklyOff,
        LeaveCoverage leave,
        int priorLateDays
) {
    public DayFacts {
        punches = punches == null ? List.of() : List.copyOf(punches);
        if (leave == null) {
            leave = LeaveCoverage.NONE;
        }
    }

    public record PunchPoint(AttendanceEventType type, Instant serverTime) {
    }
}

package com.securetravels.crm.attendance;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * The work date is the day the shift started. A punch after midnight still
 * belongs to yesterday when yesterday's shift has not reached its end.
 * With no overnight shift, the date is the India calendar date.
 */
public final class ShiftWorkDate {

    private ShiftWorkDate() {}

    public static LocalDate resolve(Instant instant, ShiftWindow yesterdayShift) {
        LocalDate calendar = LocalDate.ofInstant(instant, AttendanceClock.ZONE);
        if (yesterdayShift == null || !yesterdayShift.crossesMidnight()) {
            return calendar;
        }
        LocalTime time = LocalTime.ofInstant(instant, AttendanceClock.ZONE);
        if (!time.isAfter(yesterdayShift.end())) {
            return calendar.minusDays(1);
        }
        return calendar;
    }
}

package com.securetravels.crm.attendance;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Office day for Trip On Himalaya is India time, not the server's UTC date.
 * A punch just after midnight IST must not land on the previous UTC day.
 */
public final class AttendanceClock {

    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    public static final Duration SKEW_LIMIT = Duration.ofMinutes(5);

    private AttendanceClock() {}

    public static LocalDate workDate(Instant serverNow) {
        return LocalDate.ofInstant(serverNow, ZONE);
    }

    /** True when the phone clock disagrees with the server by more than five minutes. */
    public static boolean skewed(Instant serverNow, Instant deviceTime) {
        return skewed(serverNow, deviceTime, SKEW_LIMIT);
    }

    /** A flagged punch is still saved. The limit only marks it for review. */
    public static boolean skewed(Instant serverNow, Instant deviceTime, Duration limit) {
        if (deviceTime == null || limit == null) {
            return false;
        }
        return Duration.between(serverNow, deviceTime).abs().compareTo(limit) > 0;
    }
}

package com.securetravels.crm.auth.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Multi-day desk log for one person — every sign-in / pause / sign-out by India day. */
public record PersonHoursLogResponse(
        UUID userId,
        String fullName,
        String email,
        LocalDate from,
        LocalDate to,
        long totalSeconds,
        int totalSessions,
        List<DayEntry> days
) {
    public record DayEntry(
            LocalDate workDate,
            long seconds,
            boolean open,
            boolean paused,
            int sessions,
            Instant firstSignIn,
            Instant lastSignOut,
            List<PersonDayDetailResponse.SessionSegment> segments
    ) {
    }
}

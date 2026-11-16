package com.securetravels.crm.auth.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** One person's desk day — every sign-in / pause / sign-out segment. */
public record PersonDayDetailResponse(
        LocalDate workDate,
        UUID userId,
        String fullName,
        String email,
        long seconds,
        boolean open,
        boolean paused,
        int sessions,
        Instant firstSignIn,
        Instant lastSignOut,
        List<SessionSegment> segments
) {
    public record SessionSegment(
            UUID id,
            Instant loginAt,
            Instant logoutAt,
            boolean open,
            boolean paused,
            String logoutReason,
            long elapsedSeconds
    ) {
    }
}

package com.securetravels.crm.auth.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Hours on one India work day, added up from sign-in until sign-out (pause segments excluded). */
public record DayHoursResponse(
        LocalDate workDate,
        boolean live,
        List<PersonDayHours> people
) {
    public record PersonDayHours(
            UUID userId,
            String fullName,
            String email,
            long seconds,
            boolean open,
            boolean paused,
            int sessions,
            Instant firstSignIn,
            Instant lastSignOut
    ) {
    }
}

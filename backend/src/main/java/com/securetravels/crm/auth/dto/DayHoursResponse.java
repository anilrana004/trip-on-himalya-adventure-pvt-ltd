package com.securetravels.crm.auth.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Hours on one India work day, added up from sign-in until sign-out. */
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
            int sessions
    ) {
    }
}

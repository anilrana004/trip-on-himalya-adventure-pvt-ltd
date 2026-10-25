package com.securetravels.crm.attendance;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AttendanceClockTest {

    @Test
    void workDateIsTheIndiaDateEvenWhenUtcIsStillYesterday() {
        Instant justAfterMidnightIst = Instant.parse("2026-10-25T18:45:00Z");
        assertEquals(LocalDate.of(2026, 10, 26), AttendanceClock.workDate(justAfterMidnightIst));
    }

    @Test
    void fiveMinutesIsAllowedAndAnHourIsFlagged() {
        Instant server = Instant.parse("2026-10-25T04:00:00Z");
        assertFalse(AttendanceClock.skewed(server, server.plusSeconds(5 * 60)));
        assertTrue(AttendanceClock.skewed(server, server.minusSeconds(60 * 60)));
        assertFalse(AttendanceClock.skewed(server, null));
    }
}

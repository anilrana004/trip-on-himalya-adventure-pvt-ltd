package com.securetravels.crm.attendance;

import java.time.LocalTime;

/** A shift whose end is at or before its start finishes the next morning. */
public record ShiftWindow(LocalTime start, LocalTime end) {

    public boolean crossesMidnight() {
        return !end.isAfter(start);
    }
}

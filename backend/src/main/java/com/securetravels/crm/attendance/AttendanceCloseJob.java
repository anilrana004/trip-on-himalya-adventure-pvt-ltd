package com.securetravels.crm.attendance;

import com.securetravels.crm.user.User;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;

/**
 * Fills summaries for shift days that have ended and have no punches.
 * A second instance finds the lock taken and does nothing.
 */
@Component
public class AttendanceCloseJob {

    static final int LOCK_KEY = 88_442_211;

    private final DataSource dataSource;
    private final AttendanceService attendance;
    private final Clock clock;

    public AttendanceCloseJob(DataSource dataSource, AttendanceService attendance, Clock clock) {
        this.dataSource = dataSource;
        this.attendance = attendance;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.attendance.close-cron:0 30 0 * * *}", zone = "Asia/Kolkata")
    public void nightly() {
        closeFinishedDays(clock.instant());
    }

    public int closeFinishedDays(Instant now) {
        try (Connection connection = dataSource.getConnection()) {
            if (!tryLock(connection)) {
                return 0;
            }
            try {
                return closeWhileHoldingLock(now);
            } finally {
                unlock(connection);
            }
        } catch (java.sql.SQLException ex) {
            throw new IllegalStateException("Could not close attendance days", ex);
        }
    }

    private int closeWhileHoldingLock(Instant now) {
        LocalDate calendar = LocalDate.ofInstant(now, AttendanceClock.ZONE);
        int created = 0;
        for (User user : attendance.activePunchUsers()) {
            for (LocalDate day = calendar.minusDays(31); !day.isAfter(calendar); day = day.plusDays(1)) {
                if (!ended(day, attendance.shiftOn(user.getId(), day), now)) {
                    continue;
                }
                if (attendance.ensureDay(user.getId(), day)) {
                    created++;
                }
            }
        }
        return created;
    }

    static boolean ended(LocalDate day, ShiftWindow shift, Instant now) {
        ZonedDateTime end;
        if (shift == null) {
            end = day.plusDays(1).atStartOfDay(AttendanceClock.ZONE);
        } else if (shift.crossesMidnight()) {
            end = day.plusDays(1).atTime(shift.end()).atZone(AttendanceClock.ZONE);
        } else {
            end = day.atTime(shift.end()).atZone(AttendanceClock.ZONE);
        }
        return !now.isBefore(end.toInstant());
    }

    private static boolean tryLock(Connection connection) throws java.sql.SQLException {
        try (var statement = connection.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
            statement.setInt(1, LOCK_KEY);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return rows.getBoolean(1);
            }
        }
    }

    private static void unlock(Connection connection) throws java.sql.SQLException {
        try (var statement = connection.prepareStatement("SELECT pg_advisory_unlock(?)")) {
            statement.setInt(1, LOCK_KEY);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
            }
        }
    }
}

package com.securetravels.crm.attendance;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.DayOfWeek;
import java.util.Set;

/**
 * Pure day calculation. The same facts always produce the same verdict.
 * Approved leave wins, then a holiday, then a weekly off, then time worked.
 */
public final class DayRules {

    private DayRules() {}

    public static DayVerdict evaluate(DayFacts facts) {
        Pairing pairing = pair(facts);
        boolean late = isLate(facts, pairing.firstIn());
        int worked = pairing.workedMinutes();
        int overtime = Math.max(0, worked - facts.rule().overtimeAfterMinutes());
        int compOff = 0;
        String status;

        if (facts.leave() == LeaveCoverage.FULL) {
            status = "ON_LEAVE";
        } else if (facts.leave() == LeaveCoverage.FIRST_HALF || facts.leave() == LeaveCoverage.SECOND_HALF) {
            status = "HALF_DAY_LEAVE";
        } else if (facts.holiday()) {
            status = "HOLIDAY";
            compOff = worked;
        } else if (facts.weeklyOff()) {
            status = "WEEKLY_OFF";
            compOff = worked;
        } else if (pairing.incomplete()) {
            status = "INCOMPLETE";
        } else if (worked >= facts.rule().fullDayMinutes()) {
            status = "PRESENT";
        } else if (worked >= facts.rule().halfDayMinutes()) {
            status = "HALF_DAY";
        } else {
            status = "ABSENT";
        }

        if (late
                && facts.priorLateDays() + 1 >= facts.rule().lateMarksToHalfDay()
                && ("PRESENT".equals(status) || "HALF_DAY".equals(status) || "ABSENT".equals(status))) {
            status = "HALF_DAY";
        }

        return new DayVerdict(
                status, pairing.firstIn(), pairing.lastOut(), late,
                worked, overtime, compOff, facts.rule().version());
    }

    public static int chargeableDays(LocalDate from, LocalDate to,
                                     Set<LocalDate> holidays, Set<DayOfWeek> weeklyOffs) {
        if (from == null || to == null || to.isBefore(from)) {
            return 0;
        }
        int days = 0;
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            if (holidays.contains(date) || weeklyOffs.contains(date.getDayOfWeek())) {
                continue;
            }
            days++;
        }
        return days;
    }

    private static boolean isLate(DayFacts facts, java.time.Instant firstIn) {
        if (facts.shift() == null || firstIn == null || facts.leave() == LeaveCoverage.FULL) {
            return false;
        }
        LocalTime expected = expectedStart(facts.shift(), facts.leave());
        ZonedDateTime start = ZonedDateTime.of(facts.workDate(), expected, AttendanceClock.ZONE);
        if (facts.shift().crossesMidnight() && expected.isBefore(facts.shift().start())) {
            start = start.plusDays(1);
        }
        java.time.Instant limit = start.plusMinutes(facts.rule().graceMinutes()).toInstant();
        return firstIn.isAfter(limit);
    }

    private static LocalTime expectedStart(ShiftWindow shift, LeaveCoverage leave) {
        if (leave != LeaveCoverage.FIRST_HALF) {
            return shift.start();
        }
        int length = shift.crossesMidnight()
                ? (24 * 60 - shift.start().toSecondOfDay() / 60) + shift.end().toSecondOfDay() / 60
                : (int) Duration.between(shift.start(), shift.end()).toMinutes();
        return shift.start().plusMinutes(length / 2L);
    }

    private static Pairing pair(DayFacts facts) {
        java.time.Instant open = null;
        java.time.Instant firstIn = null;
        java.time.Instant lastOut = null;
        long seconds = 0;
        boolean incomplete = false;
        for (DayFacts.PunchPoint punch : facts.punches()) {
            if (punch.type() == AttendanceEventType.CHECK_IN) {
                if (open != null) {
                    incomplete = true;
                }
                open = punch.serverTime();
                if (firstIn == null) {
                    firstIn = open;
                }
            } else if (open != null && !punch.serverTime().isBefore(open)) {
                seconds += Duration.between(open, punch.serverTime()).toSeconds();
                lastOut = punch.serverTime();
                open = null;
            }
        }
        if (open != null) {
            incomplete = true;
        }
        return new Pairing(firstIn, lastOut, (int) (seconds / 60), incomplete);
    }

    private record Pairing(java.time.Instant firstIn, java.time.Instant lastOut,
                           int workedMinutes, boolean incomplete) {
    }
}

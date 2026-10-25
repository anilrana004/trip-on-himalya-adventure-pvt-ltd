package com.securetravels.crm.attendance;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DayRulesTest {

    private static final ZoneId ZONE = AttendanceClock.ZONE;
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 26);
    private static final ShiftWindow OFFICE = new ShiftWindow(LocalTime.of(9, 30), LocalTime.of(18, 30));
    private static final ShiftWindow NIGHT = new ShiftWindow(LocalTime.of(22, 0), LocalTime.of(6, 0));
    private static final RuleSnapshot RULE = new RuleSnapshot(1, 15, 240, 480, 3, 540);

    @Test
    void onTimeFullDayIsPresent() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T18:30"));
        assertEquals("PRESENT", verdict.status());
        assertFalse(verdict.late());
        assertEquals(540, verdict.workedMinutes());
    }

    @Test
    void arrivalOnTheGraceBoundaryIsNotLate() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:45"), out("2026-10-26T18:30"));
        assertEquals("PRESENT", verdict.status());
        assertFalse(verdict.late());
    }

    @Test
    void oneMinutePastGraceIsLateAndStillPresent() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:46"), out("2026-10-26T18:30"));
        assertEquals("PRESENT", verdict.status());
        assertTrue(verdict.late());
    }

    @Test
    void halfDayThreshold() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T13:30"));
        assertEquals("HALF_DAY", verdict.status());
        assertEquals(240, verdict.workedMinutes());
    }

    @Test
    void underHalfDayIsAbsentAndKeepsTheMinutes() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T10:30"));
        assertEquals("ABSENT", verdict.status());
        assertEquals(60, verdict.workedMinutes());
    }

    @Test
    void overnightShiftCountsEightHoursOnTheStartDate() {
        DayVerdict verdict = evaluate(NIGHT, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T22:00"), out("2026-10-27T06:00"));
        assertEquals("PRESENT", verdict.status());
        assertEquals(480, verdict.workedMinutes());
        assertFalse(verdict.late());
    }

    @Test
    void missingCheckOutIsIncompleteAndDoesNotInventAnEnd() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"));
        assertEquals("INCOMPLETE", verdict.status());
        assertEquals(0, verdict.workedMinutes());
        assertEquals(null, verdict.checkOutAt());
    }

    @Test
    void severalPairsSumOnlyTheClosedOnes() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T12:00"),
                in("2026-10-26T13:00"), out("2026-10-26T18:00"));
        assertEquals("HALF_DAY", verdict.status());
        assertEquals(450, verdict.workedMinutes());
    }

    @Test
    void anOpenPairAmongClosedPairsStaysIncomplete() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 0,
                in("2026-10-26T09:30"), in("2026-10-26T10:00"), out("2026-10-26T18:00"));
        assertEquals("INCOMPLETE", verdict.status());
        assertEquals(480, verdict.workedMinutes());
    }

    @Test
    void holidayWithNoWork() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, true, false, 0);
        assertEquals("HOLIDAY", verdict.status());
        assertEquals(0, verdict.compOffMinutes());
    }

    @Test
    void weeklyOffWithNoWork() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, true, 0);
        assertEquals("WEEKLY_OFF", verdict.status());
    }

    @Test
    void workOnAHolidayKeepsTheHolidayAndCreditsTheMinutes() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, true, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T11:30"));
        assertEquals("HOLIDAY", verdict.status());
        assertEquals(120, verdict.compOffMinutes());
        assertEquals(0, verdict.overtimeMinutes());
    }

    @Test
    void approvedFullDayLeaveWinsOverAPunch() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.FULL, false, false, 0,
                in("2026-10-26T09:30"), out("2026-10-26T18:30"));
        assertEquals("ON_LEAVE", verdict.status());
        assertEquals(540, verdict.workedMinutes());
    }

    @Test
    void halfDayLeaveStaysHalfDayLeaveWhenTheOtherHalfIsWorked() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.FIRST_HALF, false, false, 0,
                in("2026-10-26T14:00"), out("2026-10-26T18:30"));
        assertEquals("HALF_DAY_LEAVE", verdict.status());
        assertFalse(verdict.late());
        assertEquals(270, verdict.workedMinutes());
    }

    @Test
    void thirdLateMarkTurnsAFullDayIntoAHalfDay() {
        DayVerdict verdict = evaluate(OFFICE, LeaveCoverage.NONE, false, false, 2,
                in("2026-10-26T10:00"), out("2026-10-26T18:30"));
        assertTrue(verdict.late());
        assertEquals("HALF_DAY", verdict.status());
    }

    @Test
    void aLaterRuleVersionIsWhatTheFactsName() {
        RuleSnapshot later = new RuleSnapshot(4, 15, 240, 480, 3, 540);
        DayFacts facts = facts(OFFICE, LeaveCoverage.NONE, false, false, 0, later,
                in("2026-10-26T09:30"), out("2026-10-26T18:30"));
        assertEquals(4, DayRules.evaluate(facts).ruleVersion());
    }

    @Test
    void leaveAcrossAHolidayAndSundayDoesNotChargeThoseDays() {
        LocalDate sunday = LocalDate.of(2026, 10, 25);
        LocalDate wednesday = LocalDate.of(2026, 10, 28);
        int days = DayRules.chargeableDays(
                sunday, wednesday,
                Set.of(LocalDate.of(2026, 10, 27)),
                Set.of(DayOfWeek.SUNDAY));
        assertEquals(2, days);
    }

    @Test
    void overnightPunchBeforeTheEndBelongsToTheShiftStart() {
        var night = NIGHT;
        var atOne = LocalDateTime.parse("2026-10-27T01:00").atZone(ZONE).toInstant();
        var atTen = LocalDateTime.parse("2026-10-27T10:00").atZone(ZONE).toInstant();
        var atOneWithoutShift = LocalDateTime.parse("2026-10-27T01:00").atZone(ZONE).toInstant();
        assertEquals(LocalDate.of(2026, 10, 26), ShiftWorkDate.resolve(atOne, night));
        assertEquals(LocalDate.of(2026, 10, 27), ShiftWorkDate.resolve(atTen, night));
        assertEquals(LocalDate.of(2026, 10, 27), ShiftWorkDate.resolve(atOneWithoutShift, null));
        assertEquals(LocalDate.of(2026, 10, 27), ShiftWorkDate.resolve(atOne, OFFICE));
    }

    private static DayVerdict evaluate(ShiftWindow shift, LeaveCoverage leave, boolean holiday,
                                       boolean weeklyOff, int priorLates, DayFacts.PunchPoint... punches) {
        return DayRules.evaluate(facts(shift, leave, holiday, weeklyOff, priorLates, RULE, punches));
    }

    private static DayFacts facts(ShiftWindow shift, LeaveCoverage leave, boolean holiday,
                                  boolean weeklyOff, int priorLates, RuleSnapshot rule,
                                  DayFacts.PunchPoint... punches) {
        return new DayFacts(MONDAY, shift, List.of(punches), rule, holiday, weeklyOff, leave, priorLates);
    }

    private static DayFacts.PunchPoint in(String local) {
        return new DayFacts.PunchPoint(AttendanceEventType.CHECK_IN, instant(local));
    }

    private static DayFacts.PunchPoint out(String local) {
        return new DayFacts.PunchPoint(AttendanceEventType.CHECK_OUT, instant(local));
    }

    private static java.time.Instant instant(String local) {
        return LocalDateTime.parse(local).atZone(ZONE).toInstant();
    }
}

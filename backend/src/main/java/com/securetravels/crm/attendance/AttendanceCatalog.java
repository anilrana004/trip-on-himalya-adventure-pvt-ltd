package com.securetravels.crm.attendance;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Reads the rule, shift, holiday, and leave facts for one work date. */
@Component
public class AttendanceCatalog {

    static final String CALENDAR_CODE = "DEHRADUN";

    private final NamedParameterJdbcTemplate jdbc;

    public AttendanceCatalog(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<RuleSnapshot> ruleFor(LocalDate day) {
        List<RuleSnapshot> rows = jdbc.query("""
                SELECT version, grace_minutes, half_day_minutes, full_day_minutes,
                       late_marks_to_halfday, overtime_after_minutes
                  FROM attendance_rules
                 WHERE effective_from <= :day
                 ORDER BY effective_from DESC, version DESC
                 LIMIT 1
                """, new MapSqlParameterSource("day", Date.valueOf(day)),
                (rs, n) -> new RuleSnapshot(
                        rs.getInt("version"),
                        rs.getInt("grace_minutes"),
                        rs.getInt("half_day_minutes"),
                        rs.getInt("full_day_minutes"),
                        rs.getInt("late_marks_to_halfday"),
                        rs.getInt("overtime_after_minutes")));
        return rows.stream().findFirst();
    }

    public Optional<ShiftWindow> shiftFor(UUID userId, LocalDate day) {
        List<ShiftWindow> rows = jdbc.query("""
                SELECT s.start_time, s.end_time
                  FROM shift_assignments a
                  JOIN shifts s ON s.id = a.shift_id
                 WHERE a.user_id = :userId
                   AND s.active = TRUE
                   AND a.effective_from <= :day
                   AND (a.effective_to IS NULL OR a.effective_to >= :day)
                 ORDER BY a.effective_from DESC
                 LIMIT 1
                """, new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("day", Date.valueOf(day)),
                (rs, n) -> new ShiftWindow(
                        rs.getObject("start_time", LocalTime.class),
                        rs.getObject("end_time", LocalTime.class)));
        return rows.stream().findFirst();
    }

    public boolean holiday(LocalDate day) {
        Boolean found = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM holidays h
                      JOIN holiday_calendars c ON c.id = h.calendar_id
                     WHERE c.code = :code AND h.holiday_date = :day)
                """, new MapSqlParameterSource()
                        .addValue("code", CALENDAR_CODE)
                        .addValue("day", Date.valueOf(day)),
                Boolean.class);
        return Boolean.TRUE.equals(found);
    }

    public boolean weeklyOff(LocalDate day) {
        return weeklyOffDays().contains(day.getDayOfWeek());
    }

    public Set<DayOfWeek> weeklyOffDays() {
        List<Integer> days = jdbc.query("SELECT day_of_week FROM weekly_off_rules",
                (rs, n) -> rs.getInt("day_of_week"));
        Set<DayOfWeek> set = new HashSet<>();
        for (Integer day : days) {
            set.add(DayOfWeek.of(day));
        }
        return set;
    }

    public Set<LocalDate> holidaysBetween(LocalDate from, LocalDate to) {
        List<LocalDate> rows = jdbc.query("""
                SELECT h.holiday_date
                  FROM holidays h
                  JOIN holiday_calendars c ON c.id = h.calendar_id
                 WHERE c.code = :code
                   AND h.holiday_date BETWEEN :from AND :to
                """, new MapSqlParameterSource()
                        .addValue("code", CALENDAR_CODE)
                        .addValue("from", Date.valueOf(from))
                        .addValue("to", Date.valueOf(to)),
                (rs, n) -> rs.getObject("holiday_date", LocalDate.class));
        return new HashSet<>(rows);
    }

    public LeaveCoverage leaveFor(UUID userId, LocalDate day) {
        List<String> portions = jdbc.query("""
                SELECT portion
                  FROM staff_leave_requests
                 WHERE user_id = :userId
                   AND status = 'APPROVED'
                   AND from_date <= :day
                   AND to_date >= :day
                """, new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("day", Date.valueOf(day)),
                (rs, n) -> rs.getString("portion"));
        boolean first = false;
        boolean second = false;
        for (String portion : portions) {
            if ("FULL".equals(portion)) {
                return LeaveCoverage.FULL;
            }
            if ("FIRST_HALF".equals(portion)) {
                first = true;
            }
            if ("SECOND_HALF".equals(portion)) {
                second = true;
            }
        }
        if (first && second) {
            return LeaveCoverage.FULL;
        }
        if (first) {
            return LeaveCoverage.FIRST_HALF;
        }
        if (second) {
            return LeaveCoverage.SECOND_HALF;
        }
        return LeaveCoverage.NONE;
    }

    public int priorLates(UUID userId, LocalDate day) {
        LocalDate monthStart = YearMonth.from(day).atDay(1);
        Long count = jdbc.queryForObject("""
                SELECT COUNT(*)
                  FROM staff_attendance
                 WHERE user_id = :userId
                   AND late_flagged = TRUE
                   AND work_date >= :monthStart
                   AND work_date < :day
                """, new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("monthStart", Date.valueOf(monthStart))
                        .addValue("day", Date.valueOf(day)),
                Long.class);
        return count == null ? 0 : count.intValue();
    }

    public boolean monthLocked(LocalDate day) {
        Boolean found = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM attendance_period_locks WHERE period_month = :month)
                """, new MapSqlParameterSource("month", YearMonth.from(day).toString()),
                Boolean.class);
        return Boolean.TRUE.equals(found);
    }
}

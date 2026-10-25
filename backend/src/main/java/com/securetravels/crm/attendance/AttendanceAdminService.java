package com.securetravels.crm.attendance;

import com.securetravels.crm.attendance.dto.AttendanceSettingsResponse;
import com.securetravels.crm.attendance.dto.HolidayWriteRequest;
import com.securetravels.crm.attendance.dto.RuleWriteRequest;
import com.securetravels.crm.attendance.dto.ShiftAssignmentRequest;
import com.securetravels.crm.attendance.dto.ShiftWriteRequest;
import com.securetravels.crm.attendance.dto.WeeklyOffRequest;
import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

@Service
public class AttendanceAdminService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AuditService audit;

    public AttendanceAdminService(NamedParameterJdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public AttendanceSettingsResponse settings() {
        AttendanceSettingsResponse.RuleView rule = jdbc.query("""
                SELECT version, effective_from, grace_minutes, half_day_minutes, full_day_minutes,
                       late_marks_to_halfday, overtime_after_minutes
                  FROM attendance_rules
                 ORDER BY effective_from DESC, version DESC
                 LIMIT 1
                """, (rs, n) -> new AttendanceSettingsResponse.RuleView(
                rs.getInt("version"),
                rs.getObject("effective_from", LocalDate.class),
                rs.getInt("grace_minutes"),
                rs.getInt("half_day_minutes"),
                rs.getInt("full_day_minutes"),
                rs.getInt("late_marks_to_halfday"),
                rs.getInt("overtime_after_minutes"))).stream().findFirst().orElse(null);
        List<AttendanceSettingsResponse.ShiftView> shifts = jdbc.query("""
                SELECT id, name, start_time, end_time
                  FROM shifts
                 WHERE active = TRUE
                 ORDER BY name
                """, (rs, n) -> new AttendanceSettingsResponse.ShiftView(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getObject("start_time", LocalTime.class),
                rs.getObject("end_time", LocalTime.class)));
        List<Integer> weeklyOff = jdbc.query("SELECT day_of_week FROM weekly_off_rules ORDER BY day_of_week",
                (rs, n) -> rs.getInt("day_of_week"));
        List<AttendanceSettingsResponse.HolidayView> holidays = jdbc.query("""
                SELECT h.id, h.holiday_date, h.name
                  FROM holidays h
                  JOIN holiday_calendars c ON c.id = h.calendar_id
                 WHERE c.code = :code
                 ORDER BY h.holiday_date
                """, new MapSqlParameterSource("code", AttendanceCatalog.CALENDAR_CODE),
                (rs, n) -> new AttendanceSettingsResponse.HolidayView(
                        rs.getObject("id", UUID.class),
                        rs.getObject("holiday_date", LocalDate.class),
                        rs.getString("name")));
        List<AttendanceSettingsResponse.AssignmentView> assignments = jdbc.query("""
                SELECT id, user_id, shift_id, effective_from, effective_to
                  FROM shift_assignments
                 ORDER BY effective_from DESC
                """, (rs, n) -> new AttendanceSettingsResponse.AssignmentView(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getObject("shift_id", UUID.class),
                rs.getObject("effective_from", LocalDate.class),
                rs.getObject("effective_to", LocalDate.class)));
        return new AttendanceSettingsResponse(rule, shifts, weeklyOff, holidays, assignments);
    }

    @Transactional
    public AttendanceSettingsResponse saveRule(RuleWriteRequest request) {
        if (request.fullDayMinutes() < request.halfDayMinutes()) {
            throw new BadRequestException("A full day must be at least as long as a half day");
        }
        Long version = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version), 0) + 1 FROM attendance_rules",
                new MapSqlParameterSource(), Long.class);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO attendance_rules
                    (id, version, effective_from, grace_minutes, half_day_minutes, full_day_minutes,
                     late_marks_to_halfday, overtime_after_minutes)
                VALUES
                    (:id, :version, :effectiveFrom, :grace, :halfDay, :fullDay, :lates, :overtime)
                """, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("version", version == null ? 1 : version.intValue())
                .addValue("effectiveFrom", Date.valueOf(request.effectiveFrom()))
                .addValue("grace", request.graceMinutes())
                .addValue("halfDay", request.halfDayMinutes())
                .addValue("fullDay", request.fullDayMinutes())
                .addValue("lates", request.lateMarksToHalfDay())
                .addValue("overtime", request.overtimeAfterMinutes()));
        audit.record("AttendanceRule", id, AuditAction.CREATE, "version", null,
                String.valueOf(version == null ? 1 : version.intValue()));
        return settings();
    }

    @Transactional
    public AttendanceSettingsResponse saveShift(ShiftWriteRequest request) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO shifts (id, name, start_time, end_time, active)
                VALUES (:id, :name, :start, :end, TRUE)
                """, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", XssSanitizer.text(request.name()))
                .addValue("start", Time.valueOf(request.start()))
                .addValue("end", Time.valueOf(request.end())));
        audit.record("Shift", id, AuditAction.CREATE, "name", null, request.name());
        return settings();
    }

    @Transactional
    public AttendanceSettingsResponse assignShift(ShiftAssignmentRequest request) {
        Long shift = jdbc.queryForObject(
                "SELECT COUNT(*) FROM shifts WHERE id = :id AND active = TRUE",
                new MapSqlParameterSource("id", request.shiftId()), Long.class);
        if (shift == null || shift == 0) {
            throw new NotFoundException("Shift not found");
        }
        Long user = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id = :id",
                new MapSqlParameterSource("id", request.userId()), Long.class);
        if (user == null || user == 0) {
            throw new NotFoundException("User not found");
        }
        Long blocking = jdbc.queryForObject("""
                SELECT COUNT(*) FROM shift_assignments
                 WHERE user_id = :userId
                   AND effective_from >= :from
                   AND (effective_to IS NULL OR effective_to >= :from)
                """, new MapSqlParameterSource()
                .addValue("userId", request.userId())
                .addValue("from", Date.valueOf(request.effectiveFrom())), Long.class);
        if (blocking != null && blocking > 0) {
            throw new BadRequestException("A shift is already assigned from that date");
        }
        jdbc.update("""
                UPDATE shift_assignments
                   SET effective_to = :dayBefore
                 WHERE user_id = :userId
                   AND effective_to IS NULL
                   AND effective_from < :from
                """, new MapSqlParameterSource()
                .addValue("userId", request.userId())
                .addValue("from", Date.valueOf(request.effectiveFrom()))
                .addValue("dayBefore", Date.valueOf(request.effectiveFrom().minusDays(1))));
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO shift_assignments (id, user_id, shift_id, effective_from)
                VALUES (:id, :userId, :shiftId, :from)
                """, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("userId", request.userId())
                .addValue("shiftId", request.shiftId())
                .addValue("from", Date.valueOf(request.effectiveFrom())));
        audit.record("ShiftAssignment", id, AuditAction.CREATE, "shiftId", null, request.shiftId().toString());
        return settings();
    }

    @Transactional
    public AttendanceSettingsResponse saveHoliday(HolidayWriteRequest request) {
        UUID calendarId = jdbc.queryForObject(
                "SELECT id FROM holiday_calendars WHERE code = :code",
                new MapSqlParameterSource("code", AttendanceCatalog.CALENDAR_CODE), UUID.class);
        UUID id = UUID.randomUUID();
        String name = XssSanitizer.text(request.name());
        jdbc.update("""
                INSERT INTO holidays (id, calendar_id, holiday_date, name)
                VALUES (:id, :calendarId, :day, :name)
                ON CONFLICT (calendar_id, holiday_date) DO UPDATE SET name = EXCLUDED.name
                """, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("calendarId", calendarId)
                .addValue("day", Date.valueOf(request.date()))
                .addValue("name", name));
        audit.record("Holiday", id, AuditAction.CREATE, "date", null, request.date().toString());
        return settings();
    }

    @Transactional
    public AttendanceSettingsResponse deleteHoliday(UUID id) {
        int removed = jdbc.update("DELETE FROM holidays WHERE id = :id",
                new MapSqlParameterSource("id", id));
        if (removed == 0) {
            throw new NotFoundException("Holiday not found");
        }
        audit.record("Holiday", id, AuditAction.DELETE, "date", null, null);
        return settings();
    }

    @Transactional
    public AttendanceSettingsResponse saveWeeklyOff(WeeklyOffRequest request) {
        HashSet<Integer> days = new HashSet<>();
        for (Integer day : request.days()) {
            if (day == null || day < 1 || day > 7 || !days.add(day)) {
                throw new BadRequestException("Weekly off days must be between Monday and Sunday");
            }
        }
        jdbc.update("DELETE FROM weekly_off_rules", new MapSqlParameterSource());
        UUID auditId = UUID.randomUUID();
        for (Integer day : days) {
            jdbc.update("INSERT INTO weekly_off_rules (id, day_of_week) VALUES (:id, :day)",
                    new MapSqlParameterSource().addValue("id", UUID.randomUUID()).addValue("day", day));
        }
        audit.record("WeeklyOff", auditId, AuditAction.UPDATE, "days", null, days.toString());
        return settings();
    }
}

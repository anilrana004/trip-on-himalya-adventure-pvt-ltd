package com.securetravels.crm.attendance;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Writes the daily summary. The caller holds the person-day lock and passes
 * a verdict computed only from events and the rules for that date.
 */
@Component
public class AttendanceDayStore {

    private final NamedParameterJdbcTemplate jdbc;

    public AttendanceDayStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lockDay(UUID userId, LocalDate workDate) {
        jdbc.query(
                "SELECT pg_advisory_xact_lock(:k1, :k2)",
                new MapSqlParameterSource()
                        .addValue("k1", userId.hashCode())
                        .addValue("k2", (int) workDate.toEpochDay()),
                rs -> null);
    }

    public StoredDay upsert(UUID userId, LocalDate workDate, DayVerdict verdict,
                            String notes, UUID recordedBy, boolean clockSkewFlagged) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", UUID.randomUUID())
                .addValue("userId", userId)
                .addValue("workDate", Date.valueOf(workDate))
                .addValue("checkInAt", timestamp(verdict.checkInAt()))
                .addValue("checkOutAt", timestamp(verdict.checkOutAt()))
                .addValue("status", verdict.status())
                .addValue("notes", notes)
                .addValue("recordedBy", recordedBy)
                .addValue("clockSkewFlagged", clockSkewFlagged)
                .addValue("ruleVersion", verdict.ruleVersion())
                .addValue("lateFlagged", verdict.late())
                .addValue("workedMinutes", verdict.workedMinutes())
                .addValue("overtimeMinutes", verdict.overtimeMinutes())
                .addValue("compOffMinutes", verdict.compOffMinutes());
        return jdbc.queryForObject("""
                INSERT INTO staff_attendance
                    (id, user_id, work_date, check_in_at, check_out_at, status, notes,
                     recorded_by, clock_skew_flagged, rule_version, late_flagged,
                     worked_minutes, overtime_minutes, comp_off_minutes,
                     created_at, updated_at, version)
                VALUES
                    (:id, :userId, :workDate, :checkInAt, :checkOutAt, :status, :notes,
                     :recordedBy, :clockSkewFlagged, :ruleVersion, :lateFlagged,
                     :workedMinutes, :overtimeMinutes, :compOffMinutes,
                     now(), now(), 0)
                ON CONFLICT (user_id, work_date) DO UPDATE SET
                    check_in_at = EXCLUDED.check_in_at,
                    check_out_at = EXCLUDED.check_out_at,
                    status = EXCLUDED.status,
                    notes = EXCLUDED.notes,
                    recorded_by = EXCLUDED.recorded_by,
                    clock_skew_flagged = EXCLUDED.clock_skew_flagged,
                    rule_version = EXCLUDED.rule_version,
                    late_flagged = EXCLUDED.late_flagged,
                    worked_minutes = EXCLUDED.worked_minutes,
                    overtime_minutes = EXCLUDED.overtime_minutes,
                    comp_off_minutes = EXCLUDED.comp_off_minutes,
                    updated_at = now(),
                    version = staff_attendance.version + 1
                RETURNING id, user_id, work_date, check_in_at, check_out_at, status,
                          clock_skew_flagged, notes, rule_version, late_flagged,
                          worked_minutes, overtime_minutes, comp_off_minutes
                """, params, (rs, n) -> map(rs));
    }

    public StoredDay find(UUID userId, LocalDate workDate) {
        return jdbc.query("""
                SELECT id, user_id, work_date, check_in_at, check_out_at, status,
                       clock_skew_flagged, notes, rule_version, late_flagged,
                       worked_minutes, overtime_minutes, comp_off_minutes
                  FROM staff_attendance
                 WHERE user_id = :userId AND work_date = :workDate
                """, new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("workDate", Date.valueOf(workDate)),
                (rs, n) -> map(rs)).stream().findFirst().orElse(null);
    }

    public List<StoredDay> list(LocalDate from, LocalDate to, List<UUID> userIds) {
        if (userIds != null && userIds.isEmpty()) {
            return List.of();
        }
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("from", Date.valueOf(from))
                .addValue("to", Date.valueOf(to));
        String sql = """
                SELECT id, user_id, work_date, check_in_at, check_out_at, status,
                       clock_skew_flagged, notes, rule_version, late_flagged,
                       worked_minutes, overtime_minutes, comp_off_minutes
                  FROM staff_attendance
                 WHERE work_date BETWEEN :from AND :to
                """;
        if (userIds != null) {
            sql += " AND user_id IN (:userIds)";
            params.addValue("userIds", userIds);
        }
        sql += " ORDER BY work_date DESC, user_id";
        return jdbc.query(sql, params, (rs, n) -> map(rs));
    }

    private static StoredDay map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new StoredDay(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getObject("work_date", LocalDate.class),
                instant(rs.getTimestamp("check_in_at")),
                instant(rs.getTimestamp("check_out_at")),
                rs.getString("status"),
                rs.getBoolean("clock_skew_flagged"),
                rs.getString("notes"),
                (Integer) rs.getObject("rule_version"),
                rs.getBoolean("late_flagged"),
                (Integer) rs.getObject("worked_minutes"),
                (Integer) rs.getObject("overtime_minutes"),
                (Integer) rs.getObject("comp_off_minutes"));
    }

    private static Timestamp timestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant instant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    public record StoredDay(
            UUID id,
            UUID userId,
            LocalDate workDate,
            Instant checkInAt,
            Instant checkOutAt,
            String status,
            boolean clockSkewFlagged,
            String notes,
            Integer ruleVersion,
            boolean lateFlagged,
            Integer workedMinutes,
            Integer overtimeMinutes,
            Integer compOffMinutes
    ) {
    }
}

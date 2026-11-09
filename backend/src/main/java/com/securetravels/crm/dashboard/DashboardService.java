package com.securetravels.crm.dashboard;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.dashboard.dto.DashboardSummaryResponse;
import com.securetravels.crm.dashboard.dto.LeadHygieneResponse;
import com.securetravels.crm.dashboard.dto.PerformanceResponse;
import com.securetravels.crm.dashboard.dto.TargetDto;
import com.securetravels.crm.dashboard.dto.TargetListResponse;
import com.securetravels.crm.dashboard.dto.TargetProgressResponse;
import com.securetravels.crm.dashboard.dto.TargetUpsertRequest;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Module 8 (legacy M4/M5/M6): aggregate sales dashboard, per-employee
 * performance and monthly sales-target tracking. Aggregates read alongside
 * the booking/payment pipeline; targets are config rows in sales_targets.
 */
@Service
public class DashboardService {

    private static final String[] BOOKED = {"CONFIRMED", "COMPLETED"};
    private static final String[] APPLIED = {"COMPLETED", "PARTIAL"};
    private static final String COMPANY_LABEL = "Company (all sales)";

    private final JdbcTemplate jdbc;
    private final SalesTargetRepository targetRepo;
    private final UserRepository userRepo;
    private final AuditService auditService;

    public DashboardService(JdbcTemplate jdbc,
                            SalesTargetRepository targetRepo,
                            UserRepository userRepo,
                            AuditService auditService) {
        this.jdbc = jdbc;
        this.targetRepo = targetRepo;
        this.userRepo = userRepo;
        this.auditService = auditService;
    }

    private static ZoneId zone() { return ZoneId.systemDefault(); }

    /** YYYY-MM (or yyyyMM) -> first day of that month, defaulting to current month. */
    public static LocalDate monthStart(String month) {
        YearMonth ym;
        if (month == null || month.isBlank()) {
            ym = YearMonth.now();
        } else {
            try {
                ym = YearMonth.parse(month);
            } catch (DateTimeParseException e) {
                throw new BadRequestException("month must be YYYY-MM, got: " + month);
            }
        }
        return ym.atDay(1);
    }

    // ------------------------------------------------------------------
    // M4 — dashboard cards
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary(String period, UserPrincipal caller) {
        boolean today = period == null || period.isBlank() || "today".equalsIgnoreCase(period);
        LocalDate anchor = today ? LocalDate.now(zone()) : LocalDate.now(zone()).withDayOfMonth(1);
        LocalDate asOf = LocalDate.now(zone());
        java.sql.Timestamp from = java.sql.Timestamp.from(anchor.atStartOfDay(zone()).toInstant());

        Map<String, Object> row = jdbc.queryForMap("""
                SELECT
                  (SELECT count(*) FROM leads)                                            AS total_leads,
                  (SELECT count(*) FROM leads WHERE status = 'NEW'
                       AND created_at >= CAST(? AS timestamptz))                          AS new_leads,
                  (SELECT count(*) FROM tasks
                        WHERE status IN ('PENDING','OVERDUE')
                          AND type IN ('FOLLOW_UP_1D','FOLLOW_UP_3D','FOLLOW_UP_8D','FOLLOW_UP_15D','QUOTATION')
                          AND due_at::date <= ?)                                         AS follow_up_due,
                  (SELECT count(*) FROM leads WHERE status = 'INTERESTED')                AS interested,
                  (SELECT count(*) FROM leads WHERE status = 'QUOTATION_SENT')            AS quotation_sent,
                  (SELECT count(*) FROM leads WHERE status = 'BOOKING_CONFIRMED')          AS booking_confirmed,
                  (SELECT count(*) FROM leads WHERE status = 'LOST')                      AS lost,
                  (SELECT count(*) FROM leads WHERE status = 'BOOKING_CONFIRMED'
                       AND created_at >= CAST(? AS timestamptz))                          AS new_bookings,
                  (SELECT count(*) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED')) AS confirmed_bookings,
                  (SELECT COALESCE(sum(amount), 0) FROM payments
                       WHERE status IN ('COMPLETED','PARTIAL'))                           AS revenue,
                  (SELECT count(*) FROM tasks
                        WHERE type = 'INITIAL_CALL' AND status IN ('PENDING','OVERDUE')) AS first_call_pending,
                  (SELECT count(*) FROM tasks
                        WHERE type = 'INITIAL_CALL' AND status IN ('PENDING','OVERDUE')
                          AND due_at < now())                                            AS first_call_overdue,
                  (SELECT count(*) FROM leads
                        WHERE status = 'NEW'
                          AND last_contacted_at IS NULL
                          AND source IN ('FACEBOOK_ADS','INSTAGRAM','GOOGLE_ADS','WEBSITE','STOREFRONT')) AS hot_uncalled,
                  (SELECT count(*) FROM tasks
                        WHERE status = 'OVERDUE'
                          AND type IN ('FOLLOW_UP_1D','FOLLOW_UP_3D','FOLLOW_UP_8D','FOLLOW_UP_15D','QUOTATION','INITIAL_CALL'))
                                                                                         AS follow_up_overdue,
                  (SELECT count(*) FROM tasks
                        WHERE status IN ('PENDING','OVERDUE')
                          AND sla_deadline IS NOT NULL AND sla_deadline < now())         AS sla_breached
                """, from, asOf, from);

        return new DashboardSummaryResponse(
                today ? "today" : "month",
                anchor,
                l(row.get("total_leads")),
                l(row.get("new_leads")),
                l(row.get("follow_up_due")),
                l(row.get("interested")),
                l(row.get("quotation_sent")),
                l(row.get("booking_confirmed")),
                l(row.get("lost")),
                l(row.get("new_bookings")),
                l(row.get("confirmed_bookings")),
                bd(row.get("revenue")),
                l(row.get("first_call_pending")),
                l(row.get("first_call_overdue")),
                l(row.get("hot_uncalled")),
                l(row.get("follow_up_overdue")),
                l(row.get("sla_breached")));
    }

    // ------------------------------------------------------------------
    // M5 — per-employee performance
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PerformanceResponse performance(String month, UserPrincipal caller) {
        LocalDate start = monthStart(month);
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay(zone()).toInstant());
        java.sql.Timestamp to = java.sql.Timestamp.from(start.plusMonths(1).atStartOfDay(zone()).toInstant());
        UUID scope = caller.role() == Role.SALES ? caller.id() : null;

        String base = """
                SELECT u.id                         AS user_id,
                       u.full_name                   AS full_name,
                       u.email                       AS email,
                       (SELECT count(*) FROM leads l
                            WHERE l.owner_id = u.id AND l.status IN ('NEW','INTERESTED','QUOTATION_SENT','BOOKING_CONFIRMED')
                              AND l.created_at >= CAST(? AS timestamptz)
                              AND l.created_at <  CAST(? AS timestamptz))              AS leads_assigned,
                       (SELECT count(*) FROM tasks t
                            WHERE t.assignee_id = u.id AND t.status = 'COMPLETED'
                              AND t.completed_at >= CAST(? AS timestamptz)
                              AND t.completed_at <  CAST(? AS timestamptz))            AS follow_ups_completed,
                       (SELECT count(*) FROM tasks t
                            WHERE t.assignee_id = u.id AND t.status = 'OVERDUE')       AS follow_ups_overdue,
                       (SELECT count(*) FROM tasks t
                            WHERE t.assignee_id = u.id AND t.status = 'COMPLETED'
                              AND t.completed_at >= CAST(? AS timestamptz)
                              AND t.completed_at <  CAST(? AS timestamptz)
                              AND t.completed_at <= t.due_at)                          AS completed_on_time,
                       (SELECT count(*) FROM tasks t
                            WHERE t.assignee_id = u.id AND t.status = 'COMPLETED'
                              AND t.completed_at >= CAST(? AS timestamptz)
                              AND t.completed_at <  CAST(? AS timestamptz)
                              AND t.completed_at > t.due_at)                           AS completed_late,
                       (SELECT count(*) FROM bookings b
                            WHERE b.created_by = u.id AND b.status IN ('CONFIRMED','COMPLETED')
                              AND b.created_at >= CAST(? AS timestamptz)
                              AND b.created_at <  CAST(? AS timestamptz))              AS bookings_closed,
                       (SELECT count(*) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                            WHERE pb.created_by = u.id AND p.status IN ('COMPLETED','PARTIAL')
                              AND COALESCE(p.paid_at, p.created_at) >= CAST(? AS timestamptz)
                              AND COALESCE(p.paid_at, p.created_at) <  CAST(? AS timestamptz)) AS payments_count,
                       (SELECT COALESCE(sum(p.amount), 0) FROM payments p JOIN bookings pb ON pb.id = p.booking_id
                            WHERE pb.created_by = u.id AND p.status IN ('COMPLETED','PARTIAL')
                              AND COALESCE(p.paid_at, p.created_at) >= CAST(? AS timestamptz)
                              AND COALESCE(p.paid_at, p.created_at) <  CAST(? AS timestamptz)) AS revenue
                  FROM users u
                 WHERE u.role = 'SALES' AND u.is_active = TRUE
                """;
        // Param order: leads(from,to), completed(from,to), onTime(from,to), late(from,to),
        // bookings(from,to), payments count(from,to), revenue(from,to) = 14 timestamps
        Object[] args = new Object[]{from, to, from, to, from, to, from, to, from, to, from, to, from, to};
        List<PerformanceResponse.Employee> employees = new ArrayList<>();
        if (scope == null) {
            Map<String, Object>[] maps = jdbc.queryForList(base + " ORDER BY u.full_name", args)
                    .toArray(new Map[0]);
            Arrays.stream(maps).forEach(m -> employees.add(toEmployee(m)));
        } else {
            Object[] scoped = new Object[args.length + 1];
            System.arraycopy(args, 0, scoped, 0, args.length);
            scoped[args.length] = scope;
            employees.add(toEmployee(jdbc.queryForMap(base + " AND u.id = ?", scoped)));
        }

        long leads = employees.stream().mapToLong(PerformanceResponse.Employee::leadsAssigned).sum();
        long followUps = employees.stream().mapToLong(PerformanceResponse.Employee::followUpsCompleted).sum();
        long overdue = employees.stream().mapToLong(PerformanceResponse.Employee::followUpsOverdue).sum();
        long onTime = employees.stream().mapToLong(PerformanceResponse.Employee::completedOnTime).sum();
        long late = employees.stream().mapToLong(PerformanceResponse.Employee::completedLate).sum();
        long closed = employees.stream().mapToLong(PerformanceResponse.Employee::bookingsClosed).sum();
        BigDecimal revenue = employees.stream()
                .map(PerformanceResponse.Employee::revenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new PerformanceResponse(start.toString(), employees,
                new PerformanceResponse.Totals(leads, followUps, overdue, onTime, late, closed, revenue));
    }

    private static PerformanceResponse.Employee toEmployee(Map<String, Object> m) {
        return new PerformanceResponse.Employee(
                (UUID) m.get("user_id"),
                (String) m.get("full_name"),
                (String) m.get("email"),
                l(m.get("leads_assigned")),
                l(m.get("follow_ups_completed")),
                l(m.get("follow_ups_overdue")),
                l(m.get("completed_on_time")),
                l(m.get("completed_late")),
                l(m.get("bookings_closed")),
                l(m.get("payments_count")),
                bd(m.get("revenue")));
    }

    // ------------------------------------------------------------------
    // Sales team lead hygiene / on-time follow-up accountability
    // ------------------------------------------------------------------

    private static final String HOT_SOURCES =
            "'FACEBOOK_ADS','INSTAGRAM','GOOGLE_ADS','WEBSITE','STOREFRONT'";

    /**
     * Per-salesperson on-time discipline for managers/admins (or self for SALES).
     * Optional ownerId drills one rep; attention + feed show the rows behind the KPIs.
     */
    @Transactional(readOnly = true)
    public LeadHygieneResponse leadHygiene(UUID ownerId, UserPrincipal caller) {
        boolean manager = caller.role() == Role.MANAGER
                || caller.role() == Role.ADMIN
                || caller.role() == Role.CEO;
        UUID scope = manager ? ownerId : caller.id();
        String scopeLabel = manager
                ? (scope == null ? "ALL" : "OWNER")
                : "SELF";

        Timestamp dayStart = Timestamp.from(LocalDate.now(zone()).atStartOfDay(zone()).toInstant());

        String ownerSql = """
                SELECT u.id AS owner_id,
                       u.full_name,
                       u.email,
                       (SELECT count(*) FROM leads l
                             WHERE l.owner_id = u.id
                               AND l.status IN ('NEW','INTERESTED','QUOTATION_SENT')) AS open_leads,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id
                               AND t.status IN ('PENDING','OVERDUE')) AS open_tasks,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id AND t.status = 'OVERDUE') AS overdue_tasks,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id
                               AND t.status IN ('PENDING','OVERDUE')
                               AND t.sla_deadline IS NOT NULL AND t.sla_deadline < now()) AS sla_breached,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id AND t.type = 'INITIAL_CALL'
                               AND t.status IN ('PENDING','OVERDUE')) AS first_call_pending,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id AND t.type = 'INITIAL_CALL'
                               AND t.status IN ('PENDING','OVERDUE') AND t.due_at < now()) AS first_call_overdue,
                       (SELECT count(*) FROM leads l
                             WHERE l.owner_id = u.id AND l.status = 'NEW'
                               AND l.last_contacted_at IS NULL
                               AND l.source IN (%s)) AS hot_uncalled,
                       (SELECT count(*) FROM leads l
                             WHERE l.owner_id = u.id
                               AND l.status IN ('NEW','INTERESTED')
                               AND (l.last_contacted_at IS NULL
                                    OR l.last_contacted_at < now() - interval '24 hours')) AS quiet_leads,
                       (SELECT count(*) FROM lead_call_attempts c
                             WHERE c.actor_id = u.id
                               AND c.created_at >= CAST(? AS timestamptz)) AS calls_today,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id AND t.status = 'COMPLETED'
                               AND t.completed_at >= CAST(? AS timestamptz)
                               AND t.completed_at <= t.due_at) AS on_time_today,
                       (SELECT count(*) FROM tasks t
                             WHERE t.assignee_id = u.id AND t.status = 'COMPLETED'
                               AND t.completed_at >= CAST(? AS timestamptz)
                               AND t.completed_at > t.due_at) AS late_today,
                       (SELECT avg(EXTRACT(EPOCH FROM (l.last_contacted_at - l.created_at)) / 60.0)
                          FROM leads l
                         WHERE l.owner_id = u.id
                           AND l.last_contacted_at IS NOT NULL
                           AND l.created_at >= now() - interval '30 days') AS avg_min_first_contact
                  FROM users u
                 WHERE u.role = 'SALES' AND u.is_active = TRUE
                """.formatted(HOT_SOURCES);

        List<Map<String, Object>> ownerMaps;
        if (scope == null) {
            ownerMaps = jdbc.queryForList(ownerSql + " ORDER BY overdue_tasks DESC, sla_breached DESC, u.full_name",
                    dayStart, dayStart, dayStart);
        } else {
            ownerMaps = jdbc.queryForList(ownerSql + " AND u.id = ? ORDER BY u.full_name",
                    dayStart, dayStart, dayStart, scope);
        }

        List<LeadHygieneResponse.OwnerRow> owners = new ArrayList<>();
        for (Map<String, Object> m : ownerMaps) {
            long onTime = l(m.get("on_time_today"));
            long late = l(m.get("late_today"));
            int pct = (onTime + late) == 0 ? 100 : (int) Math.round(onTime * 100.0 / (onTime + late));
            Double avg = m.get("avg_min_first_contact") == null ? null
                    : ((Number) m.get("avg_min_first_contact")).doubleValue();
            owners.add(new LeadHygieneResponse.OwnerRow(
                    (UUID) m.get("owner_id"),
                    (String) m.get("full_name"),
                    (String) m.get("email"),
                    l(m.get("open_leads")),
                    l(m.get("open_tasks")),
                    l(m.get("overdue_tasks")),
                    l(m.get("sla_breached")),
                    l(m.get("first_call_pending")),
                    l(m.get("first_call_overdue")),
                    l(m.get("hot_uncalled")),
                    l(m.get("quiet_leads")),
                    l(m.get("calls_today")),
                    onTime,
                    late,
                    avg,
                    pct));
        }

        LeadHygieneResponse.Totals totals = new LeadHygieneResponse.Totals(
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::openTasks).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::overdueTasks).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::slaBreachedOpen).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::firstCallPending).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::firstCallOverdue).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::hotUncalled).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::quietLeads24h).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::callsLoggedToday).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::completedOnTimeToday).sum(),
                owners.stream().mapToLong(LeadHygieneResponse.OwnerRow::completedLateToday).sum());

        List<LeadHygieneResponse.AttentionLead> attention = attentionQueue(scope);
        List<LeadHygieneResponse.UpdateEvent> feed = recentFeed(scope);

        return new LeadHygieneResponse(scopeLabel, Instant.now(), totals, owners, attention, feed);
    }

    private List<LeadHygieneResponse.AttentionLead> attentionQueue(UUID ownerScope) {
        String sql = """
                SELECT l.id AS lead_id,
                       l.customer_name,
                       l.mobile_number AS phone,
                       l.status,
                       l.source,
                       l.owner_id,
                       u.full_name AS owner_name,
                       l.heat,
                       l.last_contacted_at,
                       COALESCE(l.call_count, 0) AS call_count,
                       t.type AS next_task_type,
                       t.status AS next_task_status,
                       t.due_at,
                       t.sla_deadline,
                       t.escalated_at,
                       CASE
                         WHEN t.status = 'OVERDUE' THEN 'OVERDUE_TASK'
                         WHEN t.sla_deadline IS NOT NULL AND t.sla_deadline < now() THEN 'SLA_BREACHED'
                         WHEN t.type = 'INITIAL_CALL' AND t.due_at < now() THEN 'FIRST_CALL_LATE'
                         WHEN l.status = 'NEW' AND l.last_contacted_at IS NULL
                              AND l.source IN (%s) THEN 'HOT_UNCALLED'
                         WHEN l.status IN ('NEW','INTERESTED')
                              AND (l.last_contacted_at IS NULL
                                   OR l.last_contacted_at < now() - interval '24 hours') THEN 'QUIET_24H'
                         ELSE 'FOLLOW_UP_DUE'
                       END AS reason
                  FROM leads l
                  LEFT JOIN users u ON u.id = l.owner_id
                  LEFT JOIN LATERAL (
                        SELECT t2.type, t2.status, t2.due_at, t2.sla_deadline, t2.escalated_at
                          FROM tasks t2
                         WHERE t2.lead_id = l.id
                           AND t2.status IN ('PENDING','OVERDUE')
                         ORDER BY CASE WHEN t2.status = 'OVERDUE' THEN 0 ELSE 1 END,
                                  t2.due_at ASC NULLS LAST
                         LIMIT 1
                  ) t ON TRUE
                 WHERE l.status IN ('NEW','INTERESTED','QUOTATION_SENT')
                   AND (
                        t.status = 'OVERDUE'
                     OR (t.sla_deadline IS NOT NULL AND t.sla_deadline < now())
                     OR (t.type = 'INITIAL_CALL' AND t.due_at < now())
                     OR (l.status = 'NEW' AND l.last_contacted_at IS NULL
                         AND l.source IN (%s))
                     OR (l.status IN ('NEW','INTERESTED')
                         AND (l.last_contacted_at IS NULL
                              OR l.last_contacted_at < now() - interval '24 hours'))
                   )
                """.formatted(HOT_SOURCES, HOT_SOURCES);
        Object[] args;
        if (ownerScope != null) {
            sql += " AND l.owner_id = ?";
            args = new Object[]{ownerScope};
        } else {
            args = new Object[0];
        }
        sql += """
                 ORDER BY CASE
                            WHEN t.status = 'OVERDUE' THEN 0
                            WHEN t.sla_deadline IS NOT NULL AND t.sla_deadline < now() THEN 1
                            WHEN t.type = 'INITIAL_CALL' AND t.due_at < now() THEN 2
                            WHEN l.status = 'NEW' AND l.last_contacted_at IS NULL THEN 3
                            ELSE 4
                          END,
                          t.due_at ASC NULLS LAST,
                          l.created_at ASC
                 LIMIT 80
                """;
        return jdbc.queryForList(sql, args).stream().map(this::toAttention).toList();
    }

    private LeadHygieneResponse.AttentionLead toAttention(Map<String, Object> m) {
        return new LeadHygieneResponse.AttentionLead(
                (UUID) m.get("lead_id"),
                (String) m.get("customer_name"),
                (String) m.get("phone"),
                (String) m.get("status"),
                (String) m.get("source"),
                (UUID) m.get("owner_id"),
                (String) m.get("owner_name"),
                m.get("heat") == null ? null : String.valueOf(m.get("heat")),
                toInstant(m.get("last_contacted_at")),
                l(m.get("call_count")),
                (String) m.get("next_task_type"),
                (String) m.get("next_task_status"),
                toInstant(m.get("due_at")),
                toInstant(m.get("sla_deadline")),
                toInstant(m.get("escalated_at")),
                (String) m.get("reason"));
    }

    private List<LeadHygieneResponse.UpdateEvent> recentFeed(UUID ownerScope) {
        String ownerFilter = ownerScope == null ? "" : " AND l.owner_id = ? ";
        String sql = """
                (SELECT c.created_at AS at,
                        'CALL' AS kind,
                        l.id AS lead_id,
                        l.customer_name,
                        c.actor_id,
                        u.full_name AS actor_name,
                        CONCAT('Call · ', c.outcome,
                               CASE WHEN c.notes IS NOT NULL AND length(c.notes) > 0
                                    THEN CONCAT(' — ', left(c.notes, 80)) ELSE '' END) AS summary
                   FROM lead_call_attempts c
                   JOIN leads l ON l.id = c.lead_id
                   LEFT JOIN users u ON u.id = c.actor_id
                  WHERE c.created_at >= now() - interval '48 hours'
                    %s
                )
                UNION ALL
                (SELECT t.completed_at AS at,
                        'TASK_DONE' AS kind,
                        l.id AS lead_id,
                        l.customer_name,
                        t.assignee_id AS actor_id,
                        u.full_name AS actor_name,
                        CONCAT('Completed ', t.type,
                               CASE WHEN t.completed_at <= t.due_at THEN ' on time'
                                    ELSE ' late' END) AS summary
                   FROM tasks t
                   JOIN leads l ON l.id = t.lead_id
                   LEFT JOIN users u ON u.id = t.assignee_id
                  WHERE t.status = 'COMPLETED'
                    AND t.completed_at >= now() - interval '48 hours'
                    %s
                )
                UNION ALL
                (SELECT t.escalated_at AS at,
                        'ESCALATION' AS kind,
                        l.id AS lead_id,
                        l.customer_name,
                        t.assignee_id AS actor_id,
                        u.full_name AS actor_name,
                        CONCAT('SLA escalated · ', t.type) AS summary
                   FROM tasks t
                   JOIN leads l ON l.id = t.lead_id
                   LEFT JOIN users u ON u.id = t.assignee_id
                  WHERE t.escalated_at IS NOT NULL
                    AND t.escalated_at >= now() - interval '48 hours'
                    %s
                )
                UNION ALL
                (SELECT a.created_at AS at,
                        'STATUS' AS kind,
                        l.id AS lead_id,
                        l.customer_name,
                        a.actor_id,
                        u.full_name AS actor_name,
                        CONCAT('Status ', COALESCE(a.old_value, '—'), ' → ', COALESCE(a.new_value, '—')) AS summary
                   FROM audit_log a
                   JOIN leads l ON l.id = a.entity_id
                   LEFT JOIN users u ON u.id = a.actor_id
                  WHERE a.entity = 'LEAD'
                    AND a.field = 'status'
                    AND a.created_at >= now() - interval '48 hours'
                    %s
                )
                ORDER BY at DESC
                LIMIT 60
                """.formatted(ownerFilter, ownerFilter, ownerFilter, ownerFilter);

        Object[] args;
        if (ownerScope != null) {
            args = new Object[]{ownerScope, ownerScope, ownerScope, ownerScope};
        } else {
            args = new Object[0];
        }
        return jdbc.queryForList(sql, args).stream().map(m -> new LeadHygieneResponse.UpdateEvent(
                toInstant(m.get("at")),
                (String) m.get("kind"),
                (UUID) m.get("lead_id"),
                (String) m.get("customer_name"),
                (UUID) m.get("actor_id"),
                (String) m.get("actor_name"),
                (String) m.get("summary"))).toList();
    }

    private static Instant toInstant(Object v) {
        if (v == null) return null;
        if (v instanceof Instant i) return i;
        if (v instanceof Timestamp ts) return ts.toInstant();
        if (v instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        if (v instanceof java.time.LocalDateTime ldt) return ldt.atZone(zone()).toInstant();
        return null;
    }

    // ------------------------------------------------------------------
    // M6 — monthly targets
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public TargetListResponse targets(String month, UserPrincipal caller) {
        return targetsFor(monthStart(month));
    }

    private TargetListResponse targetsFor(LocalDate start) {
        Map<UUID, long[]> achieved = bookingsByUser(start);
        Map<UUID, BigDecimal> revenue = revenueByUser(start);
        Map<UUID, String> names = names();

        List<TargetDto> targets = targetRepo.findByMonthOrderByUserIdAsc(start).stream()
                .map(t -> toDto(t, achieved.getOrDefault(t.getUserId(), new long[]{0L, 0L}),
                        revenue.getOrDefault(t.getUserId(), BigDecimal.ZERO), names))
                .toList();

        TargetListResponse.Overall overall = overall(start, targets);
        return new TargetListResponse(start, targets, overall);
    }

    @Transactional(readOnly = true)
    public TargetProgressResponse progress(String month, UserPrincipal caller) {
        LocalDate start = monthStart(month);
        TargetListResponse list = targetsFor(start);
        List<TargetDto> employees = list.targets().stream()
                .filter(t -> t.userId() != null)
                .toList();
        return new TargetProgressResponse(start, list.overall(), employees);
    }

    @Transactional
    public TargetDto upsertTarget(TargetUpsertRequest req, UserPrincipal caller) {
        LocalDate start = monthStart(req.month());
        int bookings = req.targetBookings() == null ? 0 : req.targetBookings();
        BigDecimal revenue = req.targetRevenue() == null ? BigDecimal.ZERO : req.targetRevenue();
        if (bookings == 0 && (revenue == null || revenue.signum() == 0)) {
            throw new BadRequestException("set targetBookings or targetRevenue");
        }
        Optional<SalesTarget> existing = targetRepo.findByUserIdAndMonth(req.userId(), start);
        SalesTarget t = existing.orElseGet(() ->
                new SalesTarget(req.userId(), start, 0, BigDecimal.ZERO, caller.id()));
        boolean created = !existing.isPresent();
        int oldBookings = t.getTargetBookings();
        BigDecimal oldRevenue = t.getTargetRevenue();
        t.setTargetBookings(bookings);
        t.setTargetRevenue(revenue);
        targetRepo.saveAndFlush(t);

        if (created) {
            auditService.record("SALES_TARGET", t.getId(), AuditAction.CREATE, "target",
                    null, t.getTargetBookings() + "/" + t.getTargetRevenue() + " month=" + start);
        } else {
            if (oldBookings != bookings) {
                auditService.record("SALES_TARGET", t.getId(), AuditAction.UPDATE, "target_bookings",
                        Integer.toString(oldBookings), Integer.toString(bookings));
            }
            if (oldRevenue.compareTo(revenue) != 0) {
                auditService.record("SALES_TARGET", t.getId(), AuditAction.UPDATE, "target_revenue",
                        oldRevenue.toPlainString(), revenue.toPlainString());
            }
        }

        Map<UUID, long[]> achieved = bookingsByUser(start);
        Map<UUID, BigDecimal> rev = revenueByUser(start);
        TargetDto dto = toDto(t, achieved.getOrDefault(t.getUserId(), new long[]{0L, 0L}),
                rev.getOrDefault(t.getUserId(), BigDecimal.ZERO), names());
        return dto;
    }

    @Transactional
    public void deleteTarget(UUID id) {
        if (!targetRepo.existsById(id)) {
            throw new NotFoundException("target not found: " + id);
        }
        auditService.record("SALES_TARGET", id, AuditAction.DELETE, "target",
                "bookings/revenue", null);
        targetRepo.deleteById(id);
    }

    private TargetListResponse.Overall overall(LocalDate start, List<TargetDto> targets) {
        Optional<TargetDto> company = targets.stream().filter(t -> t.userId() == null).findFirst();
        List<TargetDto> perUser = targets.stream().filter(t -> t.userId() != null).toList();
        int targetBookings = company.map(TargetDto::targetBookings)
                .orElse(perUser.stream().mapToInt(TargetDto::targetBookings).sum());
        BigDecimal targetRevenue = company.map(TargetDto::targetRevenue)
                .orElse(perUser.stream().map(TargetDto::targetRevenue).reduce(BigDecimal.ZERO, BigDecimal::add));

        long[] all = countsInWindow(start);
        long achievedBookings = targets.isEmpty() ? 0 : all[0];
        BigDecimal achievedRevenue = targets.isEmpty() ? BigDecimal.ZERO : revInWindow(start);
        return new TargetListResponse.Overall(
                targetBookings, targetRevenue,
                achievedBookings, achievedRevenue,
                pct(achievedBookings, targetBookings),
                pct(achievedRevenue, targetRevenue));
    }

    private TargetDto toDto(SalesTarget t, long[] achieved, BigDecimal rev, Map<UUID, String> names) {
        String label = t.getUserId() == null ? COMPANY_LABEL : names.getOrDefault(t.getUserId(), "Sales");
        return new TargetDto(t.getId(), t.getUserId(), label, t.getMonth(),
                t.getTargetBookings(), t.getTargetRevenue(),
                achieved[0], rev,
                pct(achieved[0], t.getTargetBookings()),
                pct(rev, t.getTargetRevenue()));
    }

    private Map<UUID, String> names() {
        return userRepo.findAll().stream()
                .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
    }

    private Map<UUID, long[]> bookingsByUser(LocalDate start) {
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay(zone()).toInstant());
        java.sql.Timestamp to = java.sql.Timestamp.from(start.plusMonths(1).atStartOfDay(zone()).toInstant());
        Map<UUID, long[]> out = new LinkedHashMap<>();
        jdbc.queryForList("""
                SELECT b.created_by AS user_id, count(*) AS cnt
                  FROM bookings b
                 WHERE b.status IN ('CONFIRMED','COMPLETED')
                   AND b.created_at >= CAST(? AS timestamptz)
                   AND b.created_at <  CAST(? AS timestamptz)
                 GROUP BY b.created_by
                """, from, to).forEach(row -> out.put((UUID) row.get("user_id"), new long[]{0L, l(row.get("cnt"))}));
        return out;
    }

    private Map<UUID, BigDecimal> revenueByUser(LocalDate start) {
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay(zone()).toInstant());
        java.sql.Timestamp to = java.sql.Timestamp.from(start.plusMonths(1).atStartOfDay(zone()).toInstant());
        Map<UUID, BigDecimal> out = new LinkedHashMap<>();
        jdbc.queryForList("""
                SELECT b.created_by AS user_id, COALESCE(sum(p.amount), 0) AS rev
                  FROM payments p JOIN bookings b ON b.id = p.booking_id
                 WHERE p.status IN ('COMPLETED','PARTIAL')
                   AND COALESCE(p.paid_at, p.created_at) >= CAST(? AS timestamptz)
                   AND COALESCE(p.paid_at, p.created_at) <  CAST(? AS timestamptz)
                 GROUP BY b.created_by
                """, from, to).forEach(row -> out.put((UUID) row.get("user_id"), bd(row.get("rev"))));
        return out;
    }

    private long[] countsInWindow(LocalDate start) {
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay(zone()).toInstant());
        java.sql.Timestamp to = java.sql.Timestamp.from(start.plusMonths(1).atStartOfDay(zone()).toInstant());
        return jdbc.queryForList("""
                SELECT count(*) AS cnt FROM bookings
                 WHERE status IN ('CONFIRMED','COMPLETED')
                   AND created_at >= CAST(? AS timestamptz)
                   AND created_at <  CAST(? AS timestamptz)
                """, from, to).stream().mapToLong(r -> l(r.get("cnt"))).toArray();
    }

    private BigDecimal revInWindow(LocalDate start) {
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay(zone()).toInstant());
        java.sql.Timestamp to = java.sql.Timestamp.from(start.plusMonths(1).atStartOfDay(zone()).toInstant());
        return jdbc.queryForObject("""
                SELECT COALESCE(sum(p.amount), 0) FROM payments p JOIN bookings b ON b.id = p.booking_id
                 WHERE p.status IN ('COMPLETED','PARTIAL')
                   AND COALESCE(p.paid_at, p.created_at) >= CAST(? AS timestamptz)
                   AND COALESCE(p.paid_at, p.created_at) <  CAST(? AS timestamptz)
                """, BigDecimal.class, from, to);
    }

    private static long l(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        throw new IllegalArgumentException("unexpected aggregate: " + v);
    }

    private static BigDecimal bd(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal b) return b;
        if (v instanceof Number n) return BigDecimal.valueOf(n.longValue());
        return BigDecimal.ZERO;
    }

    private static int pct(long achieved, int target) {
        if (target <= 0) return 0;
        return (int) Math.round(achieved * 100.0 / target);
    }

    private static int pct(BigDecimal achieved, BigDecimal target) {
        if (target == null || target.signum() <= 0) return 0;
        return achieved.multiply(BigDecimal.valueOf(100))
                .divide(target, 0, RoundingMode.HALF_UP).intValue();
    }
}
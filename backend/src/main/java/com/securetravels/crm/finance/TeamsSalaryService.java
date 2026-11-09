package com.securetravels.crm.finance;

import com.securetravels.crm.basecamp.StaffPayroll;
import com.securetravels.crm.basecamp.StaffPayrollRepository;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.finance.dto.FinanceExpenseRequest;
import com.securetravels.crm.finance.dto.FinanceExpenseResponse;
import com.securetravels.crm.finance.dto.TeamsSalaryDayResponse;
import com.securetravels.crm.finance.dto.TeamsSalaryLineResponse;
import com.securetravels.crm.finance.dto.TeamsSalaryMonthResponse;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Company teams salary desk. One store: staff_payroll. Hours/days come from
 * staff_attendance (snapshot on generate). When finance marks PAID, the line
 * updates for the employee dashboard and a SALARIES expense is posted.
 */
@Service
public class TeamsSalaryService {

    private static final Set<Role> ELIGIBLE = EnumSet.of(
            Role.SALES, Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO, Role.FINANCE, Role.TRANSPORT);
    private static final Set<Role> WRITE = EnumSet.of(Role.FINANCE, Role.ADMIN, Role.CEO);
    private static final Set<Role> DESK_READ = EnumSet.of(Role.FINANCE, Role.ADMIN, Role.CEO, Role.MANAGER);

    private final StaffPayrollRepository payroll;
    private final UserRepository users;
    private final FinanceService finance;
    private final JdbcTemplate jdbc;

    public TeamsSalaryService(StaffPayrollRepository payroll,
                              UserRepository users,
                              FinanceService finance,
                              JdbcTemplate jdbc) {
        this.payroll = payroll;
        this.users = users;
        this.finance = finance;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public TeamsSalaryMonthResponse monthDesk(String month, String roleFilter, UserPrincipal caller) {
        requireDeskRead(caller);
        String m = normalizeMonth(month);
        List<User> staff = eligibleStaff();
        if (caller.role() == Role.MANAGER) {
            staff = staff.stream()
                    .filter(u -> caller.id().equals(u.getReportsTo()) || caller.id().equals(u.getId()))
                    .toList();
        }
        Map<UUID, StaffPayroll> byUser = payroll.findByPeriodMonthOrderByCreatedAtDesc(m).stream()
                .collect(Collectors.toMap(StaffPayroll::getUserId, p -> p, (a, b) -> a, LinkedHashMap::new));

        List<TeamsSalaryLineResponse> lines = new ArrayList<>();
        for (User u : staff) {
            if (roleFilter != null && !roleFilter.isBlank() && !u.getRole().name().equalsIgnoreCase(roleFilter)) {
                continue;
            }
            StaffPayroll row = byUser.get(u.getId());
            if (row == null) {
                AttendanceSnap snap = attendanceSnap(u.getId(), m);
                lines.add(emptyLine(u, m, snap));
            } else {
                lines.add(toLine(row, u));
            }
        }
        lines.sort(Comparator
                .comparing((TeamsSalaryLineResponse l) -> statusRank(l.status()))
                .thenComparing(TeamsSalaryLineResponse::fullName, String.CASE_INSENSITIVE_ORDER));
        return monthResponse(m, lines);
    }

    @Transactional
    public TeamsSalaryMonthResponse generate(String month, UserPrincipal caller) {
        requireWrite(caller);
        String m = normalizeMonth(month);
        int created = 0;
        int refreshed = 0;
        for (User u : eligibleStaff()) {
            StaffPayroll row = payroll.findByUserIdAndPeriodMonth(u.getId(), m)
                    .orElseGet(() -> new StaffPayroll(u.getId(), m));
            boolean isNew = row.getId() == null;
            if (row.getStatus() == StaffPayroll.Status.PAID || row.getStatus() == StaffPayroll.Status.VOID) {
                continue;
            }
            applyAttendanceSnapshot(row, u, m);
            if (row.getBasicPay() == null || row.getBasicPay().signum() == 0) {
                BigDecimal base = u.getMonthlySalary() != null ? u.getMonthlySalary() : BigDecimal.ZERO;
                if (base.signum() == 0) {
                    // Carry forward last paid/approved basic if present
                    base = lastBasic(u.getId()).orElse(BigDecimal.ZERO);
                }
                row.setBasicPay(base);
            }
            row.setRoleSnapshot(u.getRole().name());
            row.recalculate();
            row.setRecordedBy(caller.id());
            if (row.getStatus() == null) row.setStatus(StaffPayroll.Status.DRAFT);
            payroll.save(row);
            if (isNew) created++;
            else refreshed++;
        }
        TeamsSalaryMonthResponse desk = monthDesk(m, null, caller);
        return new TeamsSalaryMonthResponse(
                desk.month(), desk.totals(), desk.lines(), desk.byRole(),
                "Generated " + created + " new · refreshed " + refreshed + " from attendance");
    }

    @Transactional
    public TeamsSalaryLineResponse upsertLine(UUID userId, String month, BigDecimal basic, BigDecimal allowances,
                                              BigDecimal deductions, StaffPayroll.Status status,
                                              String notes, BigDecimal monthlySalaryDefault,
                                              UserPrincipal caller) {
        requireWrite(caller);
        String m = normalizeMonth(month);
        User u = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        if (!ELIGIBLE.contains(u.getRole())) {
            throw new BadRequestException("User role is not on company salary (exclude partners/vendors)");
        }
        if (monthlySalaryDefault != null && monthlySalaryDefault.signum() >= 0) {
            u.setMonthlySalary(monthlySalaryDefault);
            users.save(u);
        }
        StaffPayroll row = payroll.findByUserIdAndPeriodMonth(userId, m)
                .orElseGet(() -> new StaffPayroll(userId, m));
        if (row.getStatus() == StaffPayroll.Status.PAID && status != StaffPayroll.Status.PAID) {
            throw new BadRequestException("Paid lines are locked. Void from admin if you must reverse.");
        }
        if (basic != null) row.setBasicPay(nz(basic));
        if (allowances != null) row.setAllowances(nz(allowances));
        if (deductions != null) row.setDeductions(nz(deductions));
        applyAttendanceSnapshot(row, u, m);
        row.setRoleSnapshot(u.getRole().name());
        row.recalculate();
        if (status != null && status != StaffPayroll.Status.PAID) {
            row.setStatus(status);
        }
        if (notes != null) row.setNotes(XssSanitizer.text(notes));
        row.setRecordedBy(caller.id());
        return toLine(payroll.save(row), u);
    }

    @Transactional
    public TeamsSalaryLineResponse markPaid(UUID userId, String month, String paymentRef, UserPrincipal caller) {
        requireWrite(caller);
        String m = normalizeMonth(month);
        User u = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        StaffPayroll row = payroll.findByUserIdAndPeriodMonth(userId, m)
                .orElseThrow(() -> new NotFoundException("No salary line for " + u.getFullName() + " in " + m));
        if (row.getStatus() == StaffPayroll.Status.VOID) {
            throw new BadRequestException("Cannot pay a voided line");
        }
        if (row.getStatus() == StaffPayroll.Status.PAID) {
            return toLine(row, u);
        }
        applyAttendanceSnapshot(row, u, m);
        row.recalculate();
        if (row.getNetPay().signum() <= 0) {
            throw new BadRequestException("Net pay must be greater than zero before marking paid");
        }
        row.setStatus(StaffPayroll.Status.PAID);
        row.setPaidAt(Instant.now());
        row.setPaymentRef(XssSanitizer.text(paymentRef));
        row.setRecordedBy(caller.id());

        if (row.getExpenseId() == null) {
            FinanceExpenseResponse exp = finance.createExpense(new FinanceExpenseRequest(
                    FinanceExpense.Category.SALARIES,
                    "Salary · " + u.getFullName() + " · " + m,
                    row.getNetPay(),
                    LocalDate.now(),
                    null,
                    u.getFullName(),
                    FinanceExpense.PaymentMethod.BANK_TRANSFER,
                    FinanceExpense.Status.POSTED,
                    "teams-salary user=" + u.getId() + " month=" + m
                            + " days=" + row.getPresentDays() + "h/" + hoursLabel(row.getWorkedMinutes())
                            + (paymentRef != null ? " ref=" + paymentRef : "")
            ), caller);
            row.setExpenseId(exp.id());
        }
        return toLine(payroll.save(row), u);
    }

    @Transactional
    public TeamsSalaryMonthResponse payAllApproved(String month, String paymentRef, UserPrincipal caller) {
        requireWrite(caller);
        String m = normalizeMonth(month);
        int paid = 0;
        for (StaffPayroll row : payroll.findByPeriodMonthOrderByCreatedAtDesc(m)) {
            if (row.getStatus() != StaffPayroll.Status.APPROVED) continue;
            markPaid(row.getUserId(), m, paymentRef, caller);
            paid++;
        }
        TeamsSalaryMonthResponse desk = monthDesk(m, null, caller);
        return new TeamsSalaryMonthResponse(
                desk.month(), desk.totals(), desk.lines(), desk.byRole(),
                "Marked paid: " + paid);
    }

    @Transactional(readOnly = true)
    public TeamsSalaryLineResponse mySalary(String month, UserPrincipal caller) {
        String m = normalizeMonth(month);
        User u = users.findById(caller.id()).orElseThrow(() -> new NotFoundException("User not found"));
        return payroll.findByUserIdAndPeriodMonth(caller.id(), m)
                .map(row -> toLine(row, u))
                .orElseGet(() -> emptyLine(u, m, attendanceSnap(caller.id(), m)));
    }

    @Transactional(readOnly = true)
    public List<TeamsSalaryDayResponse> myDays(String month, UUID userId, UserPrincipal caller) {
        String m = normalizeMonth(month);
        UUID target = userId != null ? userId : caller.id();
        if (!target.equals(caller.id())) {
            requireDeskRead(caller);
            if (caller.role() == Role.MANAGER) {
                User u = users.findById(target).orElseThrow(() -> new NotFoundException("User not found"));
                if (!caller.id().equals(u.getReportsTo()) && !caller.id().equals(u.getId())) {
                    throw new ForbiddenException("Managers only see direct reports");
                }
            }
        }
        YearMonth ym = YearMonth.parse(m);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();
        return jdbc.query("""
                SELECT work_date, status,
                       COALESCE(worked_minutes, 0) AS worked_minutes,
                       COALESCE(overtime_minutes, 0) AS overtime_minutes,
                       check_in_at, check_out_at
                  FROM staff_attendance
                 WHERE user_id = ? AND work_date >= ? AND work_date <= ?
                 ORDER BY work_date ASC
                """, (rs, i) -> new TeamsSalaryDayResponse(
                rs.getDate("work_date").toLocalDate().toString(),
                rs.getString("status"),
                rs.getInt("worked_minutes"),
                rs.getInt("overtime_minutes"),
                hoursLabel(rs.getInt("worked_minutes")),
                rs.getTimestamp("check_in_at") != null ? rs.getTimestamp("check_in_at").toInstant().toString() : null,
                rs.getTimestamp("check_out_at") != null ? rs.getTimestamp("check_out_at").toInstant().toString() : null
        ), target, from, to);
    }

    private void applyAttendanceSnapshot(StaffPayroll row, User u, String month) {
        AttendanceSnap snap = attendanceSnap(u.getId(), month);
        row.setWorkingDays(snap.workingDays());
        row.setPresentDays(snap.presentDays());
        row.setHalfDays(snap.halfDays());
        row.setLeaveDays(snap.leaveDays());
        row.setAbsentDays(snap.absentDays());
        row.setWorkedMinutes(snap.workedMinutes());
        row.setOvertimeMinutes(snap.overtimeMinutes());
        row.setRoleSnapshot(u.getRole().name());
    }

    private AttendanceSnap attendanceSnap(UUID userId, String month) {
        YearMonth ym = YearMonth.parse(month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT status,
                       COALESCE(worked_minutes, 0) AS worked_minutes,
                       COALESCE(overtime_minutes, 0) AS overtime_minutes
                  FROM staff_attendance
                 WHERE user_id = ? AND work_date >= ? AND work_date <= ?
                """, userId, from, to);
        int present = 0, half = 0, leave = 0, absent = 0, worked = 0, ot = 0, working = 0;
        for (Map<String, Object> r : rows) {
            String status = String.valueOf(r.get("status"));
            int wm = ((Number) r.get("worked_minutes")).intValue();
            int om = ((Number) r.get("overtime_minutes")).intValue();
            worked += wm;
            ot += om;
            switch (status) {
                case "PRESENT", "WFH" -> { present++; working++; }
                case "HALF_DAY", "HALF_DAY_LEAVE" -> { half++; working++; }
                case "ON_LEAVE" -> leave++;
                case "ABSENT", "INCOMPLETE" -> { absent++; working++; }
                default -> { /* HOLIDAY / WEEKLY_OFF */ }
            }
        }
        return new AttendanceSnap(working, present, half, leave, absent, worked, ot);
    }

    private java.util.Optional<BigDecimal> lastBasic(UUID userId) {
        List<BigDecimal> rows = jdbc.query("""
                SELECT basic_pay FROM staff_payroll
                 WHERE user_id = ? AND status IN ('PAID','APPROVED')
                 ORDER BY period_month DESC LIMIT 1
                """, (rs, i) -> rs.getBigDecimal(1), userId);
        return rows.isEmpty() ? java.util.Optional.empty() : java.util.Optional.ofNullable(rows.get(0));
    }

    private List<User> eligibleStaff() {
        return users.findByIsActiveTrueAndRoleIn(ELIGIBLE).stream()
                .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private TeamsSalaryMonthResponse monthResponse(String month, List<TeamsSalaryLineResponse> lines) {
        long headcount = lines.size();
        long paidCount = lines.stream().filter(l -> "PAID".equals(l.status())).count();
        long draftCount = lines.stream().filter(l -> "DRAFT".equals(l.status())).count();
        BigDecimal totalNet = lines.stream().map(TeamsSalaryLineResponse::netPay).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidNet = lines.stream().filter(l -> "PAID".equals(l.status()))
                .map(TeamsSalaryLineResponse::netPay).reduce(BigDecimal.ZERO, BigDecimal::add);
        int totalMinutes = lines.stream().mapToInt(TeamsSalaryLineResponse::workedMinutes).sum();
        Map<String, Long> byRole = lines.stream()
                .collect(Collectors.groupingBy(l -> l.role() != null ? l.role() : "—", Collectors.counting()));
        return new TeamsSalaryMonthResponse(
                month,
                new TeamsSalaryMonthResponse.Totals(headcount, paidCount, draftCount, totalNet, paidNet,
                        totalMinutes, hoursLabel(totalMinutes)),
                lines,
                byRole,
                null);
    }

    private TeamsSalaryLineResponse toLine(StaffPayroll p, User u) {
        return new TeamsSalaryLineResponse(
                p.getId(),
                p.getUserId(),
                u.getFullName(),
                u.getEmail(),
                p.getRoleSnapshot() != null ? p.getRoleSnapshot() : u.getRole().name(),
                p.getPeriodMonth(),
                p.getBasicPay(),
                p.getAllowances(),
                p.getDeductions(),
                p.getNetPay(),
                p.getStatus().name(),
                p.getWorkingDays(),
                p.getPresentDays(),
                p.getHalfDays(),
                p.getLeaveDays(),
                p.getAbsentDays(),
                p.getWorkedMinutes(),
                p.getOvertimeMinutes(),
                hoursLabel(p.getWorkedMinutes()),
                hoursLabel(p.getOvertimeMinutes()),
                u.getMonthlySalary(),
                p.getPaidAt() != null ? p.getPaidAt().toString() : null,
                p.getPaymentRef(),
                p.getExpenseId(),
                p.getNotes());
    }

    private TeamsSalaryLineResponse emptyLine(User u, String month, AttendanceSnap snap) {
        return new TeamsSalaryLineResponse(
                null,
                u.getId(),
                u.getFullName(),
                u.getEmail(),
                u.getRole().name(),
                month,
                u.getMonthlySalary() != null ? u.getMonthlySalary() : BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                u.getMonthlySalary() != null ? u.getMonthlySalary() : BigDecimal.ZERO,
                "MISSING",
                snap.workingDays(),
                snap.presentDays(),
                snap.halfDays(),
                snap.leaveDays(),
                snap.absentDays(),
                snap.workedMinutes(),
                snap.overtimeMinutes(),
                hoursLabel(snap.workedMinutes()),
                hoursLabel(snap.overtimeMinutes()),
                u.getMonthlySalary(),
                null,
                null,
                null,
                null);
    }

    private static String hoursLabel(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        return h + "h " + m + "m";
    }

    private static int statusRank(String status) {
        return switch (status == null ? "" : status) {
            case "MISSING" -> 0;
            case "DRAFT" -> 1;
            case "APPROVED" -> 2;
            case "PAID" -> 3;
            case "VOID" -> 4;
            default -> 5;
        };
    }

    private static String normalizeMonth(String month) {
        String m = month == null || month.isBlank() ? YearMonth.now().toString() : month.trim();
        try {
            YearMonth.parse(m);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("month must be YYYY-MM");
        }
        return m;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private void requireWrite(UserPrincipal caller) {
        if (!WRITE.contains(caller.role())) {
            throw new ForbiddenException("Only Finance / Admin / CEO can edit or pay salaries");
        }
    }

    private void requireDeskRead(UserPrincipal caller) {
        if (!DESK_READ.contains(caller.role())) {
            throw new ForbiddenException("Salary desk is for Finance, Managers, Admin");
        }
    }

    private record AttendanceSnap(
            int workingDays, int presentDays, int halfDays, int leaveDays, int absentDays,
            int workedMinutes, int overtimeMinutes) {}
}

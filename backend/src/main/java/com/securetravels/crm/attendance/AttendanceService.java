package com.securetravels.crm.attendance;

import com.securetravels.crm.attendance.dto.AttendanceDayResponse;
import com.securetravels.crm.attendance.dto.AttendanceEventResponse;
import com.securetravels.crm.attendance.dto.BulkReportsToRequest;
import com.securetravels.crm.attendance.dto.PunchRequest;
import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ConflictException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private static final int MAX_REPORTING_DEPTH = 20;
    private static final Set<Role> PUNCH_ROLES = EnumSet.of(
            Role.SALES, Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO);
    private static final Set<Role> COMPANY = EnumSet.of(Role.ADMIN, Role.CEO);
    private static final Set<Role> LINE_MANAGERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final AttendanceEventRepository events;
    private final AttendanceDayStore days;
    private final AttendanceCatalog catalog;
    private final UserRepository users;
    private final AuditService audit;
    private final Clock clock;
    private final AppProperties properties;

    public AttendanceService(AttendanceEventRepository events, AttendanceDayStore days,
                             AttendanceCatalog catalog, UserRepository users, AuditService audit,
                             Clock clock, AppProperties properties) {
        this.events = events;
        this.days = days;
        this.catalog = catalog;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional
    public AttendanceDayResponse punch(UserPrincipal caller, PunchRequest request) {
        if (!PUNCH_ROLES.contains(caller.role())) {
            throw new ForbiddenException("You cannot record attendance");
        }
        if (request.type() == null) {
            throw new BadRequestException("Punch type is required");
        }
        UUID targetId = request.userId() != null ? request.userId() : caller.id();
        User target = users.findById(targetId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (!target.isActive()) {
            throw new BadRequestException("This person is inactive");
        }
        if (!canSee(caller, target)) {
            throw new ForbiddenException("You can only record attendance for yourself or a direct report");
        }

        Instant serverNow = clock.instant();
        LocalDate calendar = LocalDate.ofInstant(serverNow, AttendanceClock.ZONE);
        ShiftWindow yesterday = catalog.shiftFor(targetId, calendar.minusDays(1)).orElse(null);
        LocalDate workDate = ShiftWorkDate.resolve(serverNow, yesterday);
        if (catalog.monthLocked(workDate)) {
            throw new ConflictException("That month is locked");
        }
        days.lockDay(targetId, workDate);

        if (request.clientEventId() != null) {
            var existing = events.findByClientEventId(request.clientEventId());
            if (existing.isPresent()) {
                AttendanceEvent prior = existing.get();
                if (!prior.getUserId().equals(targetId) || prior.getEventType() != request.type()) {
                    throw new ConflictException("That punch id was already used");
                }
                return toDay(project(targetId, prior.getWorkDate(), caller.id()), names(List.of(targetId)));
            }
        }

        Duration skewLimit = Duration.ofMinutes(Math.max(0, properties.getAttendance().getClockSkewMinutes()));
        boolean skew = AttendanceClock.skewed(serverNow, request.deviceTime(), skewLimit);
        String note = XssSanitizer.text(request.note());
        AttendanceEvent saved = events.save(new AttendanceEvent(
                UUID.randomUUID(), targetId, request.clientEventId(), request.type(),
                workDate, serverNow, request.deviceTime(), skew, caller.id(), note));
        audit.record("AttendanceEvent", saved.getId(), AuditAction.CREATE, "eventType",
                null, request.type().name());
        return toDay(project(targetId, workDate, caller.id()), names(List.of(targetId)));
    }

    @Transactional
    public void rebuildRange(UUID userId, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            return;
        }
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            if (catalog.monthLocked(day)) {
                throw new ConflictException("That month is locked");
            }
        }
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            days.lockDay(userId, day);
            project(userId, day, null);
        }
    }

    /** Creates the summary for a finished day that has no punches yet. */
    @Transactional
    public boolean ensureDay(UUID userId, LocalDate workDate) {
        if (catalog.monthLocked(workDate)) {
            return false;
        }
        days.lockDay(userId, workDate);
        if (days.find(userId, workDate) != null) {
            return false;
        }
        project(userId, workDate, null);
        return true;
    }

    public int chargeableDays(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            return 0;
        }
        return DayRules.chargeableDays(from, to, catalog.holidaysBetween(from, to), catalog.weeklyOffDays());
    }

    public boolean monthLocked(LocalDate day) {
        return catalog.monthLocked(day);
    }

    @Transactional(readOnly = true)
    public List<AttendanceDayResponse> listDays(UserPrincipal caller, LocalDate from, LocalDate to) {
        if (!PUNCH_ROLES.contains(caller.role())) {
            throw new ForbiddenException("You cannot view attendance");
        }
        LocalDate today = LocalDate.now(clock.withZone(AttendanceClock.ZONE));
        LocalDate start = from != null ? from : today.minusDays(14);
        LocalDate end = to != null ? to : today;
        if (end.isBefore(start)) {
            throw new BadRequestException("The end date is before the start date");
        }
        List<UUID> scope = scope(caller);
        List<AttendanceDayStore.StoredDay> rows = days.list(start, end, scope);
        Map<UUID, String> names = names(rows.stream().map(AttendanceDayStore.StoredDay::userId).distinct().toList());
        return rows.stream().map(row -> toDay(row, names)).toList();
    }

    @Transactional(readOnly = true)
    public List<AttendanceEventResponse> listEvents(UserPrincipal caller, UUID userId,
                                                    LocalDate from, LocalDate to) {
        if (!PUNCH_ROLES.contains(caller.role())) {
            throw new ForbiddenException("You cannot view attendance");
        }
        UUID targetId = userId != null ? userId : caller.id();
        User target = users.findById(targetId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (!canSee(caller, target)) {
            throw new ForbiddenException("You can only see your own attendance");
        }
        LocalDate today = LocalDate.now(clock.withZone(AttendanceClock.ZONE));
        LocalDate start = from != null ? from : today.minusDays(14);
        LocalDate end = to != null ? to : today;
        if (end.isBefore(start)) {
            throw new BadRequestException("The end date is before the start date");
        }
        return events.findByUserIdAndWorkDateBetweenOrderByServerTimeAsc(targetId, start, end).stream()
                .map(event -> new AttendanceEventResponse(
                        event.getId(), event.getUserId(), event.getEventType().name(),
                        event.getWorkDate(), event.getServerTime(), event.getDeviceTime(),
                        event.isClockSkewFlagged(), event.getRecordedBy()))
                .toList();
    }

    @Transactional
    public void assignReportsToBulk(UserPrincipal caller, List<BulkReportsToRequest.Assignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            throw new BadRequestException("Choose at least one person");
        }
        for (BulkReportsToRequest.Assignment assignment : assignments) {
            assignReportsTo(caller, assignment.userId(), assignment.reportsTo());
        }
    }

    @Transactional
    public void assignReportsTo(UserPrincipal caller, UUID userId, UUID reportsTo) {
        if (!COMPANY.contains(caller.role())) {
            throw new ForbiddenException("Only an admin can set who someone reports to");
        }
        User user = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (reportsTo != null && !user.isActive()) {
            throw new BadRequestException("An inactive person cannot be given a manager");
        }
        if (reportsTo != null && reportsTo.equals(userId)) {
            throw new BadRequestException("A person cannot report to themselves");
        }
        String previous = user.getReportsTo() == null ? null : user.getReportsTo().toString();
        if (reportsTo == null) {
            user.setReportsTo(null);
        } else {
            User manager = users.findById(reportsTo)
                    .orElseThrow(() -> new NotFoundException("Manager not found"));
            if (!manager.isActive()) {
                throw new BadRequestException("The manager is inactive");
            }
            if (!LINE_MANAGERS.contains(manager.getRole())) {
                throw new BadRequestException("Reports-to must be a manager, admin, or CEO");
            }
            assertNoCycle(userId, manager);
            user.setReportsTo(reportsTo);
        }
        users.save(user);
        audit.record("User", userId, AuditAction.UPDATE, "reportsTo",
                previous, reportsTo == null ? null : reportsTo.toString());
    }

    private void assertNoCycle(UUID employeeId, User manager) {
        UUID cursor = manager.getId();
        for (int depth = 0; depth < MAX_REPORTING_DEPTH; depth++) {
            if (cursor.equals(employeeId)) {
                throw new BadRequestException("That assignment would make a reporting cycle");
            }
            User current = users.findById(cursor).orElse(null);
            if (current == null || current.getReportsTo() == null) {
                return;
            }
            cursor = current.getReportsTo();
        }
        throw new BadRequestException("The reporting line is too deep to check");
    }

    private AttendanceDayStore.StoredDay project(UUID userId, LocalDate workDate, UUID recordedBy) {
        List<AttendanceEvent> rows = events.findByUserIdAndWorkDateOrderByServerTimeAsc(userId, workDate);
        RuleSnapshot rule = catalog.ruleFor(workDate)
                .orElseThrow(() -> new IllegalStateException("No attendance rule is in force"));
        List<DayFacts.PunchPoint> punches = rows.stream()
                .map(event -> new DayFacts.PunchPoint(event.getEventType(), event.getServerTime()))
                .toList();
        DayFacts facts = new DayFacts(
                workDate,
                catalog.shiftFor(userId, workDate).orElse(null),
                punches,
                rule,
                catalog.holiday(workDate),
                catalog.weeklyOff(workDate),
                catalog.leaveFor(userId, workDate),
                catalog.priorLates(userId, workDate));
        DayVerdict verdict = DayRules.evaluate(facts);
        boolean skew = rows.stream().anyMatch(AttendanceEvent::isClockSkewFlagged);
        String note = null;
        UUID recorder = recordedBy;
        for (AttendanceEvent event : rows) {
            if (event.getNotes() != null && !event.getNotes().isBlank()) {
                note = event.getNotes();
            }
            if (recorder == null) {
                recorder = event.getRecordedBy();
            }
        }
        return days.upsert(userId, workDate, verdict, note, recorder, skew);
    }

    /** A manager sees their own row and people who report directly to them. */
    private List<UUID> scope(UserPrincipal caller) {
        if (COMPANY.contains(caller.role())) {
            return null;
        }
        if (caller.role() == Role.MANAGER) {
            List<UUID> ids = new ArrayList<>();
            ids.add(caller.id());
            users.findByReportsToOrderByFullNameAsc(caller.id()).forEach(user -> ids.add(user.getId()));
            return ids;
        }
        return List.of(caller.id());
    }

    private boolean canSee(UserPrincipal caller, User target) {
        if (caller.id().equals(target.getId())) {
            return true;
        }
        if (COMPANY.contains(caller.role())) {
            return true;
        }
        return caller.role() == Role.MANAGER && caller.id().equals(target.getReportsTo());
    }

    private Map<UUID, String> names(List<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
    }

    private AttendanceDayResponse toDay(AttendanceDayStore.StoredDay day, Map<UUID, String> names) {
        return new AttendanceDayResponse(
                day.id(), day.userId(), names.get(day.userId()), day.workDate(),
                day.checkInAt(), day.checkOutAt(), day.status(), day.clockSkewFlagged(),
                day.lateFlagged(), day.workedMinutes(), day.overtimeMinutes(),
                day.compOffMinutes(), day.ruleVersion(), day.notes());
    }

    public List<User> activePunchUsers() {
        return users.findByIsActiveTrueAndRoleIn(PUNCH_ROLES);
    }

    public ShiftWindow shiftOn(UUID userId, LocalDate day) {
        return catalog.shiftFor(userId, day).orElse(null);
    }

    public static ZoneId zone() {
        return AttendanceClock.ZONE;
    }
}

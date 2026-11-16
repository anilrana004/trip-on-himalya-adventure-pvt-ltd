package com.securetravels.crm.auth;

import com.securetravels.crm.auth.dto.DayHoursResponse;
import com.securetravels.crm.auth.dto.DayHoursResponse.PersonDayHours;
import com.securetravels.crm.auth.dto.PersonDayDetailResponse;
import com.securetravels.crm.auth.dto.PersonDayDetailResponse.SessionSegment;
import com.securetravels.crm.auth.dto.PersonHoursLogResponse;
import com.securetravels.crm.auth.dto.PersonHoursLogResponse.DayEntry;
import com.securetravels.crm.auth.dto.PresenceResponse;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.security.JwtService;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PresenceService {

    static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Set<Role> COMPANY = EnumSet.of(Role.ADMIN, Role.CEO);
    static final String REASON_PAUSE = "PAUSE";

    private final LoginSessionRepository sessions;
    private final RefreshTokenRepository refreshTokens;
    private final UserRepository users;
    private final JwtService jwtService;

    public PresenceService(LoginSessionRepository sessions, RefreshTokenRepository refreshTokens,
                           UserRepository users, JwtService jwtService) {
        this.sessions = sessions;
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public PresenceResponse current(UUID userId, String rawRefresh) {
        LoginSession session = sessionForCookie(rawRefresh);
        if (session == null || !session.getUserId().equals(userId)) {
            session = sessions.findByUserIdAndLogoutAtIsNullOrderByLoginAtDesc(userId)
                    .stream().findFirst().orElse(null);
        }
        if (session == null) {
            // Away: last closed segment was a pause — still authenticated, clock stopped.
            session = latestSession(userId);
            if (session == null || !REASON_PAUSE.equals(session.getLogoutReason())) {
                return null;
            }
        }
        User user = users.findById(userId).orElse(null);
        return toResponse(session, user);
    }

    /**
     * Stop the desk clock without signing out. Auth cookie stays; hours stop until resume.
     */
    @Transactional
    public PresenceResponse pause(UUID userId, String rawRefresh) {
        LoginSession session = openSession(userId, rawRefresh);
        if (session == null) {
            throw new BadRequestException("No open desk clock to pause — sign in first, or resume if already away");
        }
        Instant now = Instant.now();
        session.close(now, REASON_PAUSE);
        sessions.save(session);
        User user = users.findById(userId).orElse(null);
        return toResponse(session, user);
    }

    /**
     * Start a new desk clock segment after Away. Keeps the same refresh token.
     */
    @Transactional
    public PresenceResponse resume(UUID userId, String rawRefresh) {
        RefreshToken token = refreshToken(rawRefresh);
        if (token == null || token.isRevoked() || !token.getUserId().equals(userId)) {
            throw new BadRequestException("Sign in again to resume the desk clock");
        }
        LoginSession open = sessions.findByUserIdAndLogoutAtIsNullOrderByLoginAtDesc(userId)
                .stream().findFirst().orElse(null);
        if (open != null) {
            throw new BadRequestException("Desk clock is already running");
        }
        Instant now = Instant.now();
        LoginSession session = sessions.save(new LoginSession(UUID.randomUUID(), userId, now));
        token.setLoginSessionId(session.getId());
        refreshTokens.save(token);
        User user = users.findById(userId).orElse(null);
        return toResponse(session, user);
    }

    @Transactional(readOnly = true)
    public List<PresenceResponse> board(UserPrincipal caller, LocalDate day) {
        if (caller.role() != Role.MANAGER && !COMPANY.contains(caller.role())) {
            throw new ForbiddenException("Only a manager or admin can see the sign-in board");
        }
        LocalDate date = day != null ? day : LocalDate.now(ZONE);
        Instant from = date.atStartOfDay(ZONE).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZONE).toInstant();
        List<LoginSession> rows = sessions.findBetween(from, to);
        Map<UUID, User> people = users.findAllById(rows.stream().map(LoginSession::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        List<UUID> visible = visibleIds(caller);
        List<PresenceResponse> result = new ArrayList<>();
        for (LoginSession row : rows) {
            if (visible != null && !visible.contains(row.getUserId())) {
                continue;
            }
            result.add(toResponse(row, people.get(row.getUserId())));
        }
        return result;
    }

    /**
     * Hours for one India day. Sales sees only their own row. A manager sees
     * the sales people who report to them. Admin and CEO see every sales person.
     * Pause segments stop the clock; resume starts a new session row.
     */
    @Transactional(readOnly = true)
    public DayHoursResponse dayHours(UserPrincipal caller, LocalDate day) {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate date = day != null ? day : today;
        Instant from = date.atStartOfDay(ZONE).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZONE).toInstant();
        Instant cap = Instant.now().isBefore(to) ? Instant.now() : to;
        List<User> people = salesInScope(caller);
        boolean live = date.equals(today);
        if (people.isEmpty() || !cap.isAfter(from)) {
            return new DayHoursResponse(date, live, people.stream().map(person -> closed(person)).toList());
        }
        Map<UUID, List<LoginSession>> byUser = sessions.findOverlapping(
                        people.stream().map(User::getId).toList(), from, to)
                .stream()
                .collect(Collectors.groupingBy(LoginSession::getUserId));
        List<PersonDayHours> rows = new ArrayList<>();
        for (User person : people) {
            List<LoginSession> mine = byUser.getOrDefault(person.getId(), List.of());
            rows.add(toPersonDay(person, mine, from, cap, live));
        }
        rows.sort(Comparator.comparing(PersonDayHours::fullName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return new DayHoursResponse(date, live, rows);
    }

    /**
     * Full sign-in / pause / sign-out timeline for one person on an India day.
     * Self always; managers see their sales reports; admin/CEO see any sales person in scope.
     */
    @Transactional(readOnly = true)
    public PersonDayDetailResponse personDay(UserPrincipal caller, UUID userId, LocalDate day) {
        User person = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        assertCanViewHours(caller, person);

        LocalDate today = LocalDate.now(ZONE);
        LocalDate date = day != null ? day : today;
        Instant from = date.atStartOfDay(ZONE).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZONE).toInstant();
        Instant cap = Instant.now().isBefore(to) ? Instant.now() : to;
        boolean live = date.equals(today);

        List<LoginSession> mine = sessions.findOverlapping(List.of(userId), from, to).stream()
                .sorted(Comparator.comparing(LoginSession::getLoginAt))
                .toList();
        PersonDayHours summary = toPersonDay(person, mine, from, cap, live);
        List<SessionSegment> segments = mine.stream().map(s -> toSegment(s, cap)).toList();
        return new PersonDayDetailResponse(
                date,
                person.getId(),
                person.getFullName(),
                person.getEmail(),
                summary.seconds(),
                summary.open(),
                summary.paused(),
                summary.sessions(),
                summary.firstSignIn(),
                summary.lastSignOut(),
                segments);
    }

    /**
     * Day-by-day sign-in / pause / sign-out log for one person across an India date range.
     * Managers: their sales reports. Admin/CEO: any sales person. Self always.
     */
    @Transactional(readOnly = true)
    public PersonHoursLogResponse personHoursLog(UserPrincipal caller, UUID userId,
                                                 LocalDate fromDay, LocalDate toDay) {
        User person = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        assertCanViewHours(caller, person);

        LocalDate today = LocalDate.now(ZONE);
        LocalDate to = toDay != null ? toDay : today;
        LocalDate from = fromDay != null ? fromDay : to.minusDays(13);
        if (from.isAfter(to)) {
            throw new BadRequestException("From date must be on or before to date");
        }
        if (from.plusDays(62).isBefore(to)) {
            throw new BadRequestException("Pick at most 62 India days at a time");
        }

        Instant rangeFrom = from.atStartOfDay(ZONE).toInstant();
        Instant rangeTo = to.plusDays(1).atStartOfDay(ZONE).toInstant();
        Instant now = Instant.now();

        List<LoginSession> all = sessions.findOverlapping(List.of(userId), rangeFrom, rangeTo).stream()
                .sorted(Comparator.comparing(LoginSession::getLoginAt))
                .toList();

        List<DayEntry> days = new ArrayList<>();
        long totalSeconds = 0;
        int totalSessions = 0;
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            Instant dayFrom = date.atStartOfDay(ZONE).toInstant();
            Instant dayTo = date.plusDays(1).atStartOfDay(ZONE).toInstant();
            Instant cap = now.isBefore(dayTo) ? now : dayTo;
            boolean live = date.equals(today);
            List<LoginSession> mine = all.stream()
                    .filter(s -> overlapsDay(s, dayFrom, dayTo))
                    .toList();
            PersonDayHours summary = toPersonDay(person, mine, dayFrom, cap, live);
            List<SessionSegment> segments = mine.stream().map(s -> toSegment(s, cap)).toList();
            days.add(new DayEntry(
                    date,
                    summary.seconds(),
                    summary.open(),
                    summary.paused(),
                    summary.sessions(),
                    summary.firstSignIn(),
                    summary.lastSignOut(),
                    segments));
            totalSeconds += summary.seconds();
            totalSessions += summary.sessions();
        }
        // Newest day first — managers scan recent activity first.
        days.sort(Comparator.comparing(DayEntry::workDate).reversed());
        return new PersonHoursLogResponse(
                person.getId(),
                person.getFullName(),
                person.getEmail(),
                from,
                to,
                totalSeconds,
                totalSessions,
                days);
    }

    static boolean overlapsDay(LoginSession session, Instant dayFrom, Instant dayTo) {
        if (!session.getLoginAt().isBefore(dayTo)) {
            return false;
        }
        Instant end = session.getLogoutAt() != null ? session.getLogoutAt() : Instant.MAX;
        return end.isAfter(dayFrom);
    }

    private void assertCanViewHours(UserPrincipal caller, User person) {
        if (caller.id().equals(person.getId())) {
            return;
        }
        List<User> scope = salesInScope(caller);
        boolean allowed = scope.stream().anyMatch(u -> u.getId().equals(person.getId()));
        if (!allowed) {
            throw new ForbiddenException("You cannot open that person's desk hours");
        }
    }

    private static PersonDayHours toPersonDay(User person, List<LoginSession> mine,
                                              Instant from, Instant cap, boolean live) {
        List<long[]> spans = new ArrayList<>();
        boolean open = false;
        Instant firstSignIn = null;
        Instant lastSignOut = null;
        for (LoginSession session : mine) {
            if (firstSignIn == null || session.getLoginAt().isBefore(firstSignIn)) {
                firstSignIn = session.getLoginAt();
            }
            Instant start = session.getLoginAt().isAfter(from) ? session.getLoginAt() : from;
            Instant end = session.getLogoutAt() == null || session.getLogoutAt().isAfter(cap)
                    ? cap
                    : session.getLogoutAt();
            if (end.isAfter(start)) {
                spans.add(new long[]{start.getEpochSecond(), end.getEpochSecond()});
            }
            if (session.getLogoutAt() != null) {
                if (lastSignOut == null || session.getLogoutAt().isAfter(lastSignOut)) {
                    lastSignOut = session.getLogoutAt();
                }
            }
            if (live && session.getLogoutAt() == null) {
                open = true;
            }
        }
        boolean paused = live && !open && isAway(mine);
        if (open) {
            lastSignOut = null; // still on the desk
        }
        return new PersonDayHours(
                person.getId(), person.getFullName(), person.getEmail(),
                mergedSeconds(spans), open, paused, mine.size(), firstSignIn, lastSignOut);
    }

    private static SessionSegment toSegment(LoginSession session, Instant cap) {
        Instant end = session.getLogoutAt() != null ? session.getLogoutAt() : cap;
        long elapsed = Math.max(0, Duration.between(session.getLoginAt(), end).getSeconds());
        boolean open = session.isOpen();
        boolean paused = !open && REASON_PAUSE.equals(session.getLogoutReason());
        return new SessionSegment(
                session.getId(),
                session.getLoginAt(),
                session.getLogoutAt(),
                open,
                paused,
                session.getLogoutReason(),
                elapsed);
    }

    private List<User> salesInScope(UserPrincipal caller) {
        if (COMPANY.contains(caller.role())) {
            return users.findByIsActiveTrueAndRoleIn(List.of(Role.SALES));
        }
        if (caller.role() == Role.MANAGER) {
            return users.findByReportsToOrderByFullNameAsc(caller.id()).stream()
                    .filter(user -> user.isActive() && user.getRole() == Role.SALES)
                    .toList();
        }
        // Staff see their own desk hours regardless of role (ops/sales/etc.).
        return users.findById(caller.id()).stream().toList();
    }

    private static PersonDayHours closed(User person) {
        return new PersonDayHours(person.getId(), person.getFullName(), person.getEmail(),
                0, false, false, 0, null, null);
    }

    /** Latest closed segment today/overall ended with PAUSE → Away. */
    static boolean isAway(List<LoginSession> mine) {
        return mine.stream()
                .filter(s -> s.getLogoutAt() != null)
                .max(Comparator.comparing(LoginSession::getLoginAt))
                .map(s -> REASON_PAUSE.equals(s.getLogoutReason()))
                .orElse(false);
    }

    /** Overlapping browsers must not count the same minute twice. */
    static long mergedSeconds(List<long[]> spans) {
        if (spans.isEmpty()) {
            return 0;
        }
        spans.sort(Comparator.comparingLong(a -> a[0]));
        long total = 0;
        long start = spans.get(0)[0];
        long end = spans.get(0)[1];
        for (int i = 1; i < spans.size(); i++) {
            long nextStart = spans.get(i)[0];
            long nextEnd = spans.get(i)[1];
            if (nextStart <= end) {
                end = Math.max(end, nextEnd);
            } else {
                total += Math.max(0, end - start);
                start = nextStart;
                end = nextEnd;
            }
        }
        total += Math.max(0, end - start);
        return total;
    }

    private List<UUID> visibleIds(UserPrincipal caller) {
        if (COMPANY.contains(caller.role())) {
            return null;
        }
        List<UUID> ids = new ArrayList<>();
        ids.add(caller.id());
        users.findByReportsToOrderByFullNameAsc(caller.id()).forEach(user -> ids.add(user.getId()));
        return ids;
    }

    private LoginSession openSession(UUID userId, String rawRefresh) {
        LoginSession session = sessionForCookie(rawRefresh);
        if (session != null && session.getUserId().equals(userId) && session.isOpen()) {
            return session;
        }
        return sessions.findByUserIdAndLogoutAtIsNullOrderByLoginAtDesc(userId)
                .stream().findFirst().orElse(null);
    }

    private LoginSession latestSession(UUID userId) {
        return sessions.findByUserIdOrderByLoginAtDesc(userId).stream().findFirst().orElse(null);
    }

    private RefreshToken refreshToken(String rawRefresh) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            return null;
        }
        return refreshTokens.findByTokenHash(jwtService.sha256Hex(rawRefresh)).orElse(null);
    }

    private LoginSession sessionForCookie(String rawRefresh) {
        RefreshToken token = refreshToken(rawRefresh);
        if (token == null || token.getLoginSessionId() == null) {
            return null;
        }
        return sessions.findById(token.getLoginSessionId()).orElse(null);
    }

    private PresenceResponse toResponse(LoginSession session, User user) {
        Instant end = session.getLogoutAt() != null ? session.getLogoutAt() : Instant.now();
        long elapsed = Math.max(0, Duration.between(session.getLoginAt(), end).getSeconds());
        boolean open = session.isOpen();
        boolean paused = !open && REASON_PAUSE.equals(session.getLogoutReason());
        return new PresenceResponse(
                session.getId(),
                session.getUserId(),
                user == null ? null : user.getFullName(),
                user == null ? null : user.getEmail(),
                user == null ? null : user.getRole().name(),
                session.getLoginAt(),
                session.getLogoutAt(),
                open,
                paused,
                session.getLogoutReason(),
                elapsed);
    }
}

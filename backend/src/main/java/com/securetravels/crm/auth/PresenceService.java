package com.securetravels.crm.auth;

import com.securetravels.crm.auth.dto.DayHoursResponse;
import com.securetravels.crm.auth.dto.DayHoursResponse.PersonDayHours;
import com.securetravels.crm.auth.dto.PresenceResponse;
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
            return null;
        }
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
     * An open session counts up to now. A finished day stops at midnight.
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
            return new DayHoursResponse(date, live, people.stream().map(person -> closed(person, 0, 0)).toList());
        }
        Map<UUID, List<LoginSession>> byUser = sessions.findOverlapping(
                        people.stream().map(User::getId).toList(), from, to)
                .stream()
                .collect(Collectors.groupingBy(LoginSession::getUserId));
        List<PersonDayHours> rows = new ArrayList<>();
        for (User person : people) {
            boolean open = false;
            List<LoginSession> mine = byUser.getOrDefault(person.getId(), List.of());
            List<long[]> spans = new ArrayList<>();
            for (LoginSession session : mine) {
                Instant start = session.getLoginAt().isAfter(from) ? session.getLoginAt() : from;
                Instant end = session.getLogoutAt() == null || session.getLogoutAt().isAfter(cap)
                        ? cap
                        : session.getLogoutAt();
                if (end.isAfter(start)) {
                    spans.add(new long[]{start.getEpochSecond(), end.getEpochSecond()});
                }
                if (live && session.getLogoutAt() == null) {
                    open = true;
                }
            }
            rows.add(new PersonDayHours(
                    person.getId(), person.getFullName(), person.getEmail(),
                    mergedSeconds(spans), open, mine.size()));
        }
        rows.sort(Comparator.comparing(PersonDayHours::fullName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return new DayHoursResponse(date, live, rows);
    }

    /** Null means the whole company. A manager gets self and direct reports. */
    private List<User> salesInScope(UserPrincipal caller) {
        if (COMPANY.contains(caller.role())) {
            return users.findByIsActiveTrueAndRoleIn(List.of(Role.SALES));
        }
        if (caller.role() == Role.MANAGER) {
            return users.findByReportsToOrderByFullNameAsc(caller.id()).stream()
                    .filter(user -> user.isActive() && user.getRole() == Role.SALES)
                    .toList();
        }
        return users.findById(caller.id()).stream().toList();
    }

    private static PersonDayHours closed(User person, long seconds, int sessions) {
        return new PersonDayHours(person.getId(), person.getFullName(), person.getEmail(), seconds, false, sessions);
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

    private LoginSession sessionForCookie(String rawRefresh) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            return null;
        }
        return refreshTokens.findByTokenHash(jwtService.sha256Hex(rawRefresh))
                .map(RefreshToken::getLoginSessionId)
                .flatMap(sessions::findById)
                .orElse(null);
    }

    private PresenceResponse toResponse(LoginSession session, User user) {
        Instant end = session.getLogoutAt() != null ? session.getLogoutAt() : Instant.now();
        long elapsed = Math.max(0, Duration.between(session.getLoginAt(), end).getSeconds());
        return new PresenceResponse(
                session.getId(),
                session.getUserId(),
                user == null ? null : user.getFullName(),
                user == null ? null : user.getEmail(),
                user == null ? null : user.getRole().name(),
                session.getLoginAt(),
                session.getLogoutAt(),
                session.isOpen(),
                elapsed);
    }
}

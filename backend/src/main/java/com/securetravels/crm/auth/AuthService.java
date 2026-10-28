package com.securetravels.crm.auth;

import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.security.JwtService;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {

    /** Local DemoDataSeeder passwords — never valid on Railway prod. */
    private static final Set<String> DEMO_PASSWORDS = Set.of("admin123", "finance123", "manager123", "sales123");

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final LoginSessionRepository loginSessions;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Environment environment;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
                       LoginSessionRepository loginSessions, PasswordEncoder passwordEncoder,
                       JwtService jwtService, Environment environment) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.loginSessions = loginSessions;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.environment = environment;
    }

    @Transactional
    public AuthResponse login(String email, String rawPassword) {
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> badCredentials(rawPassword));
        if (!user.isActive() || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw badCredentials(rawPassword);
        }
        refreshTokens.deleteByUserIdAndRevokedTrue(user.getId());
        return issuePair(user);
    }

    private BadCredentialsException badCredentials(String rawPassword) {
        if (productionProfile() && rawPassword != null && DEMO_PASSWORDS.contains(rawPassword)) {
            return new BadCredentialsException(
                    "Demo passwords are disabled in production. Use BOOTSTRAP_ADMIN_PASSWORD "
                            + "(or FINANCE_BOOTSTRAP_PASSWORD) from Railway → Variables.");
        }
        return new BadCredentialsException("Invalid email or password");
    }

    private boolean productionProfile() {
        return Arrays.stream(environment.getActiveProfiles()).anyMatch("prod"::equals);
    }

    /** The reuse revoke must commit. A rollback-on-401 would leave the stolen successor alive. */
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthResponse refresh(String rawToken) {
        Claims claims = jwtService.parse(rawToken);
        if (claims == null || !JwtService.TYPE_REFRESH.equals(claims.get(JwtService.CLAIM_TYPE, String.class))) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        String hash = jwtService.sha256Hex(rawToken);
        RefreshToken stored = refreshTokens.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        if (stored.isRevoked()) {
            // A rotated token presented again means the earlier copy leaked.
            // Logout (replacedBy == null) stays a single-session revoke.
            if (stored.getReplacedBy() != null) {
                refreshTokens.revokeActiveByUserId(stored.getUserId());
                loginSessions.closeOpenByUserId(stored.getUserId(), Instant.now(), "REUSE");
            }
            throw new BadCredentialsException("Invalid refresh token");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        User user = users.findById(stored.getUserId())
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        if (!user.isActive()) {
            throw new BadCredentialsException("Account disabled");
        }

        // rotation: revoke the presented token, persist the replacement hash
        String newRefresh = jwtService.issueRefreshToken(user.getId());
        String newHash = jwtService.sha256Hex(newRefresh);
        stored.revoke(newHash);
        refreshTokens.save(stored);
        RefreshToken successor = new RefreshToken(user.getId(), newHash,
                Instant.now().plus(jwtService.refreshTtl()));
        successor.setLoginSessionId(stored.getLoginSessionId());
        refreshTokens.save(successor);

        return new AuthResponse(
                jwtService.issueAccessToken(user.getId(), user.getEmail(), user.getRole()),
                newRefresh,
                "Bearer",
                jwtService.accessTtlSeconds(),
                toUserInfo(user));
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> sessions(UUID userId, String rawCurrent) {
        String currentHash = rawCurrent == null || rawCurrent.isBlank() ? null : jwtService.sha256Hex(rawCurrent);
        return refreshTokens.findByUserIdAndRevokedFalseOrderByCreatedAtDesc(userId).stream()
                .map(token -> new SessionResponse(
                        token.getId(),
                        token.getCreatedAt(),
                        token.getExpiresAt(),
                        currentHash != null && currentHash.equals(token.getTokenHash())))
                .toList();
    }

    /** Revokes one of the caller's sessions. Returns true when that row was the presented cookie. */
    @Transactional
    public boolean revokeSession(UUID userId, UUID sessionId, String rawCurrent) {
        RefreshToken token = refreshTokens.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("Session not found"));
        String currentHash = rawCurrent == null || rawCurrent.isBlank() ? null : jwtService.sha256Hex(rawCurrent);
        boolean current = currentHash != null && currentHash.equals(token.getTokenHash());
        if (!token.isRevoked()) {
            token.revoke(null);
            refreshTokens.save(token);
            closeSession(token.getLoginSessionId(), "REVOKED");
        }
        return current;
    }

    @Transactional
    public void logout(String rawToken) {
        String hash = jwtService.sha256Hex(rawToken);
        refreshTokens.findByTokenHash(hash).ifPresent(t -> {
            t.revoke(null);
            refreshTokens.save(t);
            closeSession(t.getLoginSessionId(), "LOGOUT");
        });
    }

    private AuthResponse issuePair(User user) {
        Instant now = Instant.now();
        // One open desk clock per person. An earlier browser without Sign out
        // must not keep counting into today's hours after this sign-in.
        // Refresh tokens for other devices stay alive (session list / revoke).
        loginSessions.closeOpenByUserId(user.getId(), now, "SUPERSEDED");
        LoginSession session = loginSessions.save(new LoginSession(UUID.randomUUID(), user.getId(), now));
        String refresh = jwtService.issueRefreshToken(user.getId());
        RefreshToken token = new RefreshToken(user.getId(), jwtService.sha256Hex(refresh),
                now.plus(jwtService.refreshTtl()));
        token.setLoginSessionId(session.getId());
        refreshTokens.save(token);
        return new AuthResponse(
                jwtService.issueAccessToken(user.getId(), user.getEmail(), user.getRole()),
                refresh,
                "Bearer",
                jwtService.accessTtlSeconds(),
                toUserInfo(user));
    }

    private void closeSession(UUID sessionId, String reason) {
        if (sessionId == null) {
            return;
        }
        loginSessions.findById(sessionId).ifPresent(session -> {
            session.close(Instant.now(), reason);
            loginSessions.save(session);
        });
    }

    private AuthResponse.UserInfo toUserInfo(User user) {
        return new AuthResponse.UserInfo(user.getId(), user.getEmail(), user.getFullName(), user.getRole());
    }
}
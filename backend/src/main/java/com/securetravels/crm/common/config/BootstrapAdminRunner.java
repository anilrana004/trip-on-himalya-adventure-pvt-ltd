package com.securetravels.crm.common.config;

import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Ensures a CEO desk login exists from {@code BOOTSTRAP_ADMIN_EMAIL} +
 * {@code BOOTSTRAP_ADMIN_PASSWORD}. Finance (or any other) seed must not block
 * creating this account — operators sign in as CEO first, then manage the team.
 *
 * <p>Default email when only the password is set: {@code admin@securetravels.in}.
 * Set {@code BOOTSTRAP_ADMIN_FORCE_PASSWORD=true} to re-hash the password for an
 * existing account (ops recovery after a forgotten bootstrap secret). Unset
 * force after the next successful login.
 *
 * <p>Deliberately NOT wired to {@code app.bootstrap-demo-data}. Demo
 * {@code admin123} never applies on Railway {@code prod}.
 */
@Component
@Order(10) // before BootstrapFinanceUserRunner (20) so finance alone cannot block first CEO
public class BootstrapAdminRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);

    private static final String ENV_EMAIL = "BOOTSTRAP_ADMIN_EMAIL";
    private static final String ENV_PASSWORD = "BOOTSTRAP_ADMIN_PASSWORD";
    private static final String ENV_FORCE = "BOOTSTRAP_ADMIN_FORCE_PASSWORD";
    private static final String DEFAULT_EMAIL = "admin@securetravels.in";

    /** Role for the first account: CEO is the top of the flat hierarchy and
     *  satisfies every hasAnyRole(...) check, so it cannot be locked out of
     *  any screen. */
    private static final Role BOOTSTRAP_ROLE = Role.CEO;

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public BootstrapAdminRunner(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        bootstrap(
                System.getenv(ENV_EMAIL),
                System.getenv(ENV_PASSWORD),
                isTruthy(System.getenv(ENV_FORCE)));
    }

    /**
     * Package-visible so tests can exercise both branches without mutating the
     * process environment (which is not reliably writable in a forked JVM).
     *
     * @return {@code true} if an account was created or its password was reset
     */
    @Transactional
    boolean bootstrap(String rawEmail, String rawPassword) {
        return bootstrap(rawEmail, rawPassword, false);
    }

    @Transactional
    boolean bootstrap(String rawEmail, String rawPassword, boolean forcePassword) {
        String password = rawPassword;
        if (password == null || password.isBlank()) {
            log.info("[bootstrap-admin] skipped: set {} (and optionally {}) to create the CEO desk login",
                    ENV_PASSWORD, ENV_EMAIL);
            return false;
        }

        String email = trimToNull(rawEmail);
        if (email == null) {
            email = DEFAULT_EMAIL;
            log.info("[bootstrap-admin] {} unset — using default {}", ENV_EMAIL, DEFAULT_EMAIL);
        }

        String normalisedEmail = email.toLowerCase(Locale.ROOT);
        var existing = users.findByEmailIgnoreCase(normalisedEmail);
        if (existing.isPresent()) {
            if (!forcePassword) {
                log.info("[bootstrap-admin] skipped: {} already exists (set {}=true to rotate password from env)",
                        normalisedEmail, ENV_FORCE);
                return false;
            }
            User admin = existing.get();
            admin.setPasswordHash(passwordEncoder.encode(password));
            if (!admin.isActive()) {
                admin.setActive(true);
            }
            users.save(admin);
            log.info("[bootstrap-admin] password rotated for existing {} account; unset {} after sign-in",
                    BOOTSTRAP_ROLE, ENV_FORCE);
            return true;
        }

        User admin = new User(
                normalisedEmail,
                passwordEncoder.encode(password),
                "Bootstrap Admin",
                BOOTSTRAP_ROLE,
                null);
        users.save(admin);

        // Never echo the password. Email is not secret, but keep volume low in tickets.
        log.info("[bootstrap-admin] created {} account; unset {} / {} once you have signed in and changed the password",
                BOOTSTRAP_ROLE, ENV_EMAIL, ENV_PASSWORD);
        return true;
    }

    private static boolean isTruthy(String value) {
        if (value == null) return false;
        String v = value.trim().toLowerCase(Locale.ROOT);
        return v.equals("1") || v.equals("true") || v.equals("yes") || v.equals("on");
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

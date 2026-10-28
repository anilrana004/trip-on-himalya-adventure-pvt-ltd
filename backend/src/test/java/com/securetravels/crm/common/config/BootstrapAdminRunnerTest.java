package com.securetravels.crm.common.config;

import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Production must always be able to create a CEO desk login from env vars,
 * even when finance was seeded first. Demo {@code admin123} is never used here.
 */
@SpringBootTest
@ActiveProfiles("test")
class BootstrapAdminRunnerTest {

    @Autowired BootstrapAdminRunner runner;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JdbcTemplate jdbcTemplate;

    private void truncateUsers() {
        jdbcTemplate.execute("TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    @Test
    @DisplayName("empty DB + both env vars set -> creates one CEO admin")
    void createsAdminOnEmptyDatabase() {
        truncateUsers();
        assertThat(users.count()).isZero();

        boolean created = runner.bootstrap("First.Admin@SecureTravels.in", "S3cret-pass!");

        assertThat(created).isTrue();
        assertThat(users.count()).isEqualTo(1);

        User admin = users.findAll().get(0);
        assertThat(admin.getEmail()).isEqualTo("first.admin@securetravels.in");
        assertThat(admin.getRole()).isEqualTo(Role.CEO);
        assertThat(admin.isActive()).isTrue();
        assertThat(admin.getFullName()).isNotBlank();
    }

    @Test
    @DisplayName("password only -> defaults email to admin@securetravels.in")
    void defaultsEmailWhenUnset() {
        truncateUsers();

        assertThat(runner.bootstrap(null, "DefaultEmailPass1!")).isTrue();

        User admin = users.findAll().get(0);
        assertThat(admin.getEmail()).isEqualTo("admin@securetravels.in");
        assertThat(admin.getRole()).isEqualTo(Role.CEO);
        assertThat(passwordEncoder.matches("DefaultEmailPass1!", admin.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("bootstrap password is stored BCrypt-hashed, never in plaintext")
    void storesHashedPassword() {
        truncateUsers();
        runner.bootstrap("hash.check@securetravels.in", "PlainTextLeaked?");

        String stored = users.findAll().get(0).getPasswordHash();
        assertThat(stored).isNotEqualTo("PlainTextLeaked?");
        assertThat(stored).startsWith("$2");
        assertThat(passwordEncoder.matches("PlainTextLeaked?", stored)).isTrue();
    }

    @Test
    @DisplayName("finance already present -> still creates CEO when email is new")
    void createsCeoWhenFinanceAlreadyExists() {
        truncateUsers();
        users.save(new User("finance@securetravels.in",
                passwordEncoder.encode("already-here"), "Finance", Role.FINANCE, null));
        assertThat(users.count()).isEqualTo(1);

        boolean created = runner.bootstrap("admin@securetravels.in", "CeoPass1!");

        assertThat(created).isTrue();
        assertThat(users.count()).isEqualTo(2);
        assertThat(users.findByEmailIgnoreCase("admin@securetravels.in")).isPresent();
        assertThat(users.findByEmailIgnoreCase("admin@securetravels.in").orElseThrow().getRole())
                .isEqualTo(Role.CEO);
    }

    @Test
    @DisplayName("same email twice without force -> idempotent no-op")
    void secondInvocationIsNoOp() {
        truncateUsers();

        assertThat(runner.bootstrap("once.only@securetravels.in", "FirstPass1!")).isTrue();
        assertThat(runner.bootstrap("once.only@securetravels.in", "SecondPass1!")).isFalse();

        assertThat(users.count()).isEqualTo(1);
        assertThat(passwordEncoder.matches("FirstPass1!", users.findAll().get(0).getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("force flag rotates password for existing admin")
    void forceRotatesPassword() {
        truncateUsers();
        runner.bootstrap("admin@securetravels.in", "OldPass1!");

        assertThat(runner.bootstrap("admin@securetravels.in", "NewPass2!", true)).isTrue();

        User admin = users.findByEmailIgnoreCase("admin@securetravels.in").orElseThrow();
        assertThat(passwordEncoder.matches("NewPass2!", admin.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("OldPass1!", admin.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("missing password -> no user created, no crash")
    void missingEnvVarsAreSafeNoOps() {
        truncateUsers();

        assertThat(runner.bootstrap("someone@securetravels.in", null)).isFalse();
        assertThat(runner.bootstrap("someone@securetravels.in", "   ")).isFalse();
        assertThat(runner.bootstrap(null, null)).isFalse();
        assertThat(runner.bootstrap("", "")).isFalse();

        assertThat(users.count()).isZero();
    }
}

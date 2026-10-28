package com.securetravels.crm.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Failed-password lockout must behave like a desk CRM: per-account and per-IP,
 * not a tiny shared "any POST burns a token" bucket that locks the CEO after
 * typos + health probes.
 */
@TestPropertySource(properties = {
        "app.login-rate-limit.max-failures-per-email=3",
        "app.login-rate-limit.max-failures-per-ip=20",
        "app.login-rate-limit.window-minutes=15",
        "app.login-rate-limit.capacity=10000",
        "app.login-rate-limit.refill-per-window=10000"
})
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoginThrottleIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    private static final String IP_A = "throttle-a-" + UUID.randomUUID();
    private static final String IP_B = "throttle-b-" + UUID.randomUUID();

    @Test
    @DisplayName("three failed passwords for one email then 429 with Retry-After")
    void locksAccountAfterConfiguredFailures() throws Exception {
        String email = "lock." + UUID.randomUUID() + "@securetravels.in";
        seedUser(email, "CorrectPass1!");

        List<Integer> statuses = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            statuses.add(loginStatus(email, "wrong", IP_A));
        }
        assertThat(statuses).containsOnly(401);

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", IP_A)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", "still-wrong"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("other email on same IP is not locked by a neighbor's failures")
    void doesNotLockNeighborAccountOnSameIp() throws Exception {
        String locked = "locked." + UUID.randomUUID() + "@securetravels.in";
        String neighbor = "neighbor." + UUID.randomUUID() + "@securetravels.in";
        seedUser(locked, "CorrectPass1!");
        seedUser(neighbor, "NeighborPass1!");

        for (int i = 0; i < 3; i++) {
            assertThat(loginStatus(locked, "wrong", IP_B)).isEqualTo(401);
        }
        assertThat(loginStatus(locked, "wrong", IP_B)).isEqualTo(429);

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", IP_B)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", neighbor, "password", "NeighborPass1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("successful login clears the account failure window")
    void successClearsEmailFailures() throws Exception {
        String email = "clear." + UUID.randomUUID() + "@securetravels.in";
        String ip = "throttle-clear-" + UUID.randomUUID();
        seedUser(email, "CorrectPass1!");

        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(401);
        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(401);

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", ip)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", "CorrectPass1!"))))
                .andExpect(status().isOk());

        // Two more failures should still be allowed after the clear.
        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(401);
        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(401);
        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(401);
        assertThat(loginStatus(email, "wrong", ip)).isEqualTo(429);
    }

    private int loginStatus(String email, String password, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", ip)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", password))))
                .andReturn().getResponse().getStatus();
    }

    private void seedUser(String email, String password) {
        jdbc.update("""
                insert into users (id, email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
                values (?, ?, ?, ?, 'CEO', null, true, now(), now())
                """,
                UUID.randomUUID(),
                email.toLowerCase(),
                passwordEncoder.encode(password),
                "Throttle Test");
    }
}

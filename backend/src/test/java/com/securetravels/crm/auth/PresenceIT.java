package com.securetravels.crm.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.securetravels.crm.BaseIT;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PresenceIT extends BaseIT {

    @Test
    void loginStartsOneClockAndRefreshDoesNotResetIt() throws Exception {
        createUser("timer@toh.test", "Timer Sales", Role.SALES, "password1");
        var tokens = loginTokens("timer@toh.test", "password1");

        mockMvc.perform(get("/api/auth/presence")
                        .header("Authorization", authHeader(tokens.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, tokens.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.fullName").value("Timer Sales"))
                .andExpect(jsonPath("$.loginAt").isNotEmpty());

        String firstLogin = objectMapper.readTree(mockMvc.perform(get("/api/auth/presence")
                        .header("Authorization", authHeader(tokens.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, tokens.refresh())))
                .andReturn().getResponse().getContentAsString()).get("loginAt").asText();

        var rotated = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, tokens.refresh())))
                .andExpect(status().isOk())
                .andReturn();
        String nextRefresh = refreshFrom(rotated.getResponse().getHeader(HttpHeaders.SET_COOKIE));
        String nextAccess = objectMapper.readTree(rotated.getResponse().getContentAsString()).get("accessToken").asText();

        mockMvc.perform(get("/api/auth/presence")
                        .header("Authorization", authHeader(nextAccess))
                        .cookie(new Cookie(RefreshCookie.NAME, nextRefresh)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.loginAt").value(firstLogin));

        Long rows = jdbcTemplate.queryForObject("select count(*) from login_sessions", Long.class);
        assertThat(rows).isEqualTo(1L);
    }

    @Test
    void logoutStopsTheClockAndAdminSeesTheTeam() throws Exception {
        createUser("desk@toh.test", "Desk Sales", Role.SALES, "password1");
        createUser("chief@toh.test", "Chief", Role.ADMIN, "password1");
        var sales = loginTokens("desk@toh.test", "password1");
        String admin = login("chief@toh.test", "password1");

        mockMvc.perform(get("/api/auth/presence/team")
                        .header("Authorization", authHeader(sales.access())))
                .andExpect(status().isForbidden());

        JsonNode openBoard = board(admin);
        JsonNode desk = row(openBoard, "desk@toh.test");
        assertThat(desk.get("open").asBoolean()).isTrue();
        assertThat(desk.get("logoutAt").isNull()).isTrue();

        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(RefreshCookie.NAME, sales.refresh())))
                .andExpect(status().isOk());

        JsonNode closed = row(board(admin), "desk@toh.test");
        assertThat(closed.get("open").asBoolean()).isFalse();
        assertThat(closed.get("logoutAt").isNull()).isFalse();
    }

    @Test
    void managerSeesOnlyDirectReports() throws Exception {
        UUID managerId = createUser("mgr@toh.test", "Line Manager", Role.MANAGER, "password1");
        UUID reportId = createUser("report@toh.test", "Direct Report", Role.SALES, "password1");
        createUser("stranger@toh.test", "Other Sales", Role.SALES, "password1");
        User report = userRepository.findById(reportId).orElseThrow();
        report.setReportsTo(managerId);
        userRepository.save(report);

        loginTokens("report@toh.test", "password1");
        loginTokens("stranger@toh.test", "password1");
        String manager = login("mgr@toh.test", "password1");

        JsonNode rows = board(manager);
        assertThat(row(rows, "report@toh.test").get("open").asBoolean()).isTrue();
        assertThat(rows.findValuesAsText("email")).doesNotContain("stranger@toh.test");
    }

    @Test
    void aSecondLoginClosesTheAbandonedClock() throws Exception {
        createUser("again@toh.test", "Again Sales", Role.SALES, "password1");
        var first = loginTokens("again@toh.test", "password1");
        mockMvc.perform(get("/api/auth/presence")
                        .header("Authorization", authHeader(first.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, first.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true));

        var second = loginTokens("again@toh.test", "password1");
        mockMvc.perform(get("/api/auth/presence")
                        .header("Authorization", authHeader(second.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, second.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true));

        Long open = jdbcTemplate.queryForObject(
                "select count(*) from login_sessions where logout_at is null", Long.class);
        assertThat(open).isEqualTo(1L);
        Long superseded = jdbcTemplate.queryForObject(
                "select count(*) from login_sessions where logout_reason = 'SUPERSEDED'", Long.class);
        assertThat(superseded).isEqualTo(1L);
    }

    @Test
    void salesHoursStayOnTheirDashboardAndAFinishedDayReachesTheManager() throws Exception {
        UUID managerId = createUser("hours-mgr@toh.test", "Hours Manager", Role.MANAGER, "password1");
        UUID salesId = createUser("hours-sales@toh.test", "Hours Sales", Role.SALES, "password1");
        createUser("hours-other@toh.test", "Other Sales", Role.SALES, "password1");
        User sales = userRepository.findById(salesId).orElseThrow();
        sales.setReportsTo(managerId);
        userRepository.saveAndFlush(sales);

        var tokens = loginTokens("hours-sales@toh.test", "password1");
        loginTokens("hours-other@toh.test", "password1");

        JsonNode own = hours(tokens.access(), null);
        assertThat(own.get("live").asBoolean()).isTrue();
        assertThat(own.get("people")).hasSize(1);
        assertThat(own.get("people").get(0).get("email").asText()).isEqualTo("hours-sales@toh.test");
        assertThat(own.get("people").get(0).get("open").asBoolean()).isTrue();
        assertThat(own.get("people").get(0).get("seconds").asLong()).isGreaterThanOrEqualTo(0);

        String manager = login("hours-mgr@toh.test", "password1");
        JsonNode team = hours(manager, null);
        assertThat(team.get("people").findValuesAsText("email")).containsExactly("hours-sales@toh.test");
        assertThat(team.get("people").get(0).get("open").asBoolean()).isTrue();

        LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Kolkata")).minusDays(1);
        var start = yesterday.atTime(9, 30).atZone(ZoneId.of("Asia/Kolkata")).toInstant();
        var end = yesterday.atTime(18, 30).atZone(ZoneId.of("Asia/Kolkata")).toInstant();
        jdbcTemplate.update(
                "update login_sessions set login_at = ?, logout_at = ?, logout_reason = 'LOGOUT' where user_id = ?",
                Timestamp.from(start), Timestamp.from(end), salesId);

        JsonNode finished = hours(manager, yesterday.toString());
        assertThat(finished.get("live").asBoolean()).isFalse();
        assertThat(finished.get("workDate").asText()).isEqualTo(yesterday.toString());
        JsonNode person = finished.get("people").get(0);
        assertThat(person.get("email").asText()).isEqualTo("hours-sales@toh.test");
        assertThat(person.get("open").asBoolean()).isFalse();
        assertThat(person.get("seconds").asLong()).isEqualTo(9 * 60 * 60);
    }

    private JsonNode hours(String token, String day) throws Exception {
        var request = get("/api/auth/presence/hours").header("Authorization", authHeader(token));
        if (day != null) {
            request.param("day", day);
        }
        String body = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private JsonNode board(String token) throws Exception {
        String body = mockMvc.perform(get("/api/auth/presence/team")
                        .header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private static JsonNode row(JsonNode rows, String email) {
        for (JsonNode row : rows) {
            if (email.equals(row.get("email").asText())) return row;
        }
        throw new AssertionError("missing " + email);
    }

    private LoginTokens loginTokens(String email, String password) throws Exception {
        var result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        String access = objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
        return new LoginTokens(access, refreshFrom(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)));
    }

    private record LoginTokens(String access, String refresh) {}

    private static String refreshFrom(String setCookie) {
        String pair = setCookie.split(";", 2)[0];
        return pair.substring((RefreshCookie.NAME + "=").length());
    }
}

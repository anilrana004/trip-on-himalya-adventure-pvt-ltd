package com.securetravels.crm.auth;

import com.securetravels.crm.BaseIT;
import com.securetravels.crm.user.Role;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthFlowIT extends BaseIT {

    @Test
    void loginReturnsAccessAndRefreshTokens() throws Exception {
        UUID id = createUser("admin@securetravels.in", "Admin", Role.ADMIN, "admin123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "admin@securetravels.in", "password", "admin123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("admin@securetravels.in"))
                .andExpect(jsonPath("$.user.role").value("ADMIN"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
                .andExpect(header().string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"));
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        createUser("sales@securetravels.in", "Ravi", Role.SALES, "good-pass");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "sales@securetravels.in", "password", "wrong-pass"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void refreshRotatesOldToken() throws Exception {
        createUser("ops@securetravels.in", "Suresh", Role.OPS, "ops123");
        String refresh = loginGetRefresh("ops@securetravels.in", "ops123");

        var rotated = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, refresh)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn();
        String successor = refreshFrom(rotated.getResponse().getHeader(HttpHeaders.SET_COOKIE));

        var rotatedAgain = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, successor)))
                .andExpect(status().isOk())
                .andReturn();
        String latest = refreshFrom(rotatedAgain.getResponse().getHeader(HttpHeaders.SET_COOKIE));

        // Replaying the already-rotated token is theft: the live successor dies too.
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refresh))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, latest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutDoesNotRevokeTheOtherSession() throws Exception {
        createUser("ops@securetravels.in", "Suresh", Role.OPS, "ops123");
        String first = loginGetRefresh("ops@securetravels.in", "ops123");
        String second = loginGetRefresh("ops@securetravels.in", "ops123");

        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(RefreshCookie.NAME, first)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, second)))
                .andExpect(status().isOk());
    }

    @Test
    void ownerCanRevokeOneSession() throws Exception {
        createUser("sales@securetravels.in", "Ravi", Role.SALES, "sales123");
        var kept = loginTokens("sales@securetravels.in", "sales123");
        String other = loginGetRefresh("sales@securetravels.in", "sales123");

        String sessions = mockMvc.perform(get("/api/auth/sessions")
                        .header("Authorization", authHeader(kept.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, kept.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.current == true)]").exists())
                .andReturn().getResponse().getContentAsString();
        String otherId = null;
        for (var node : objectMapper.readTree(sessions)) {
            if (!node.get("current").asBoolean()) {
                otherId = node.get("id").asText();
            }
        }
        assertThat(otherId).isNotBlank();

        mockMvc.perform(delete("/api/auth/sessions/" + otherId)
                        .header("Authorization", authHeader(kept.access()))
                        .cookie(new Cookie(RefreshCookie.NAME, kept.refresh())))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, other)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me").header("Authorization", authHeader(kept.access())))
                .andExpect(status().isOk());
    }

    @Test
    void meReturnsPrincipal() throws Exception {
        createUser("sales@securetravels.in", "Ravi", Role.SALES, "sales123");
        String token = login("sales@securetravels.in", "sales123");

        mockMvc.perform(get("/api/auth/me").header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("sales@securetravels.in"));
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        createUser("ops@securetravels.in", "Suresh", Role.OPS, "ops123");
        String refresh = loginGetRefresh("ops@securetravels.in", "ops123");

        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(RefreshCookie.NAME, refresh)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(RefreshCookie.NAME, refresh)))
                .andExpect(status().isUnauthorized());
    }

    private String loginGetRefresh(String email, String password) throws Exception {
        return loginTokens(email, password).refresh();
    }

    private LoginTokens loginTokens(String email, String password) throws Exception {
        var result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andReturn();
        String access = objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
        return new LoginTokens(access, refreshFrom(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)));
    }

    private record LoginTokens(String access, String refresh) {}

    private static String refreshFrom(String setCookie) {
        assertThat(setCookie).contains(RefreshCookie.NAME + "=");
        String pair = setCookie.split(";", 2)[0];
        return pair.substring((RefreshCookie.NAME + "=").length());
    }
}
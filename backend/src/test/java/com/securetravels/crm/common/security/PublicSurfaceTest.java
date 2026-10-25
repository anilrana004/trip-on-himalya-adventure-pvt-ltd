package com.securetravels.crm.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublicSurfaceTest {

    @Test
    @DisplayName("dev still exposes prometheus and the API docs")
    void devKeepsOperatorSurfaces() {
        assertThat(SecurityConfig.permittedMatchers(false)).contains(
                "/actuator/prometheus", "/v3/api-docs/**", "/docs/**", "/swagger-ui/**");
    }

    @Test
    @DisplayName("prod does not publish prometheus or swagger without a login")
    void prodHidesOperatorSurfaces() {
        assertThat(SecurityConfig.permittedMatchers(true))
                .doesNotContain("/actuator/prometheus", "/v3/api-docs/**", "/docs/**",
                        "/swagger-ui/**", "/swagger-ui.html")
                .contains("/actuator/health", "/api/webhook/**", "/api/v1/webhooks/email/**");
    }
}

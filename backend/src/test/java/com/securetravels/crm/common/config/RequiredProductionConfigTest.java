package com.securetravels.crm.common.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class RequiredProductionConfigTest {

    @Test
    @DisplayName("localhost yaml CORS default is not accepted in production")
    void rejectsLocalhostCorsDefault() {
        MockEnvironment env = baseSecrets();
        env.setProperty("app.cors.allowed-origins", "http://localhost:*,http://127.0.0.1:*");

        assertThat(RequiredProductionConfig.secretProblems(env))
                .anyMatch(p -> p.contains("CORS_ALLOWED_ORIGINS") || p.contains("APP_PUBLIC_URL"));
    }

    @Test
    @DisplayName("APP_PUBLIC_URL https origin satisfies CORS when CORS_ALLOWED_ORIGINS is unset")
    void appPublicUrlSatisfiesCors() {
        MockEnvironment env = baseSecrets();
        env.setProperty("APP_PUBLIC_URL", "https://trip-crm.vercel.app/");

        assertThat(RequiredProductionConfig.secretProblems(env)).isEmpty();
        assertThat(RequiredProductionConfig.resolveCorsOrigins(env))
                .isEqualTo("https://trip-crm.vercel.app");
    }

    @Test
    @DisplayName("explicit CORS_ALLOWED_ORIGINS wins")
    void explicitCorsWins() {
        MockEnvironment env = baseSecrets();
        env.setProperty("CORS_ALLOWED_ORIGINS", "https://app.example.com");
        env.setProperty("APP_PUBLIC_URL", "https://other.vercel.app");

        assertThat(RequiredProductionConfig.resolveCorsOrigins(env))
                .isEqualTo("https://app.example.com");
        assertThat(RequiredProductionConfig.secretProblems(env)).isEmpty();
    }

    @Test
    @DisplayName("http and wildcard origins are rejected")
    void rejectsHttpAndWildcard() {
        assertThat(RequiredProductionConfig.isProductionSafeOriginList("http://app.vercel.app")).isFalse();
        assertThat(RequiredProductionConfig.isProductionSafeOriginList("https://*.vercel.app")).isFalse();
        assertThat(RequiredProductionConfig.isProductionSafeOriginList("https://app.vercel.app")).isTrue();
    }

    private static MockEnvironment baseSecrets() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz0123456789ABCD");
        env.setProperty("WEBHOOK_SECRET", "a-real-webhook-secret-not-the-default");
        env.setProperty("EMAIL_WEBHOOK_SECRET", "email-secret");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret");
        return env;
    }
}

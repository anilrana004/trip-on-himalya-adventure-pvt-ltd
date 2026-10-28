package com.securetravels.crm.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RailwayEnvironmentPostProcessorTest {

    @Test
    void mapsPostgresUrlToJdbc() {
        var mapped = RailwayEnvironmentPostProcessor.mapDatabaseUrl(
                "postgres://rail:s3cret%21@host.railway.internal:5432/railway");
        assertEquals("jdbc:postgresql://host.railway.internal:5432/railway", mapped.jdbcUrl());
        assertEquals("rail", mapped.user());
        assertEquals("s3cret!", mapped.password());
    }

    @Test
    void railwayWithoutConfigRefusesBootWithClearMessage() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        assertThatThrownBy(() ->
                        new RailwayEnvironmentPostProcessor().postProcessEnvironment(env, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DATABASE_URL")
                .hasMessageContaining("JWT_SECRET")
                .hasMessageContaining("RAILWAY.md");
        assertNull(env.getProperty("JWT_SECRET"));
        assertNull(env.getProperty("app.jwt.secret"));
    }

    @Test
    void railwayIgnoresLocalhostDatasourceDefault() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        // application.yml default — must NOT count as a configured production DB
        env.setProperty("spring.datasource.url", "jdbc:postgresql://127.0.0.1:5432/securetravels_crm");
        env.setProperty("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz0123456789ABCD");
        env.setProperty("WEBHOOK_SECRET", "a-real-webhook-secret-not-the-default");
        env.setProperty("EMAIL_WEBHOOK_SECRET", "email-secret");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret");
        env.setProperty("CORS_ALLOWED_ORIGINS", "https://app.example.com");

        assertThatThrownBy(() ->
                        new RailwayEnvironmentPostProcessor().postProcessEnvironment(env, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DATABASE_URL")
                .hasMessageContaining("127.0.0.1");
    }

    @Test
    void railwayWithFullConfigMapsDatabaseAndAllowsBoot() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        env.setProperty("DATABASE_URL", "postgres://rail:s3cret@host.railway.internal:5432/railway");
        env.setProperty("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz0123456789ABCD");
        env.setProperty("WEBHOOK_SECRET", "a-real-webhook-secret-not-the-default");
        env.setProperty("EMAIL_WEBHOOK_SECRET", "email-secret");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret");
        env.setProperty("CORS_ALLOWED_ORIGINS", "https://app.example.com");

        new RailwayEnvironmentPostProcessor().postProcessEnvironment(env, new SpringApplication());

        assertThat(env.getProperty("DB_URL")).isEqualTo("jdbc:postgresql://host.railway.internal:5432/railway");
        assertThat(env.getProperty("DB_USER")).isEqualTo("rail");
    }

    @Test
    void passesThroughJdbcUrl() {
        var mapped = RailwayEnvironmentPostProcessor.mapDatabaseUrl(
                "jdbc:postgresql://localhost:5432/crm");
        assertEquals("jdbc:postgresql://localhost:5432/crm", mapped.jdbcUrl());
        assertNull(mapped.user());
    }
}

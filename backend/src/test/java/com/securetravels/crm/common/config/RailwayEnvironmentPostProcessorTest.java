package com.securetravels.crm.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

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
    void doesNotInventAJwtSecretWhenRailwayOmitsOne() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        new RailwayEnvironmentPostProcessor().postProcessEnvironment(env, new SpringApplication());
        assertNull(env.getProperty("JWT_SECRET"));
        assertNull(env.getProperty("app.jwt.secret"));
    }

    @Test
    void passesThroughJdbcUrl() {
        var mapped = RailwayEnvironmentPostProcessor.mapDatabaseUrl(
                "jdbc:postgresql://localhost:5432/crm");
        assertEquals("jdbc:postgresql://localhost:5432/crm", mapped.jdbcUrl());
        assertNull(mapped.user());
    }
}

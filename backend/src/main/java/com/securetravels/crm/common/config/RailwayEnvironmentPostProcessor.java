package com.securetravels.crm.common.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Railway Postgres exposes {@code DATABASE_URL} (postgres://user:pass@host:port/db).
 * This app expects {@code DB_URL} / {@code DB_USER} / {@code DB_PASSWORD}. Map the
 * Railway form early so the datasource can boot when only the plugin vars exist.
 *
 * <p>A missing {@code JWT_SECRET} is not invented here. {@link ProdSecretsValidator}
 * refuses the boot on Railway so a redeploy cannot silently rotate every session
 * onto a secret that was never stored.
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RailwayEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> extras = new HashMap<>();

        String existingJdbc = firstNonBlank(
                environment.getProperty("DB_URL"),
                environment.getProperty("SPRING_DATASOURCE_URL"));
        String databaseUrl = firstNonBlank(
                environment.getProperty("DATABASE_URL"),
                environment.getProperty("POSTGRES_URL"),
                environment.getProperty("DATABASE_PRIVATE_URL"));

        if (existingJdbc == null && databaseUrl != null) {
            try {
                MappedDb mapped = mapDatabaseUrl(databaseUrl);
                extras.put("DB_URL", mapped.jdbcUrl());
                extras.put("spring.datasource.url", mapped.jdbcUrl());
                if (isBlank(environment.getProperty("DB_USER")) && mapped.user() != null) {
                    extras.put("DB_USER", mapped.user());
                    extras.put("spring.datasource.username", mapped.user());
                }
                if (isBlank(environment.getProperty("DB_PASSWORD")) && mapped.password() != null) {
                    extras.put("DB_PASSWORD", mapped.password());
                    extras.put("spring.datasource.password", mapped.password());
                }
            } catch (Exception ex) {
                throw new IllegalStateException(
                        "Could not parse DATABASE_URL for Railway Postgres: " + ex.getMessage(), ex);
            }
        }

        if (!extras.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource("railwayDbMapping", extras));
        }
    }

    static MappedDb mapDatabaseUrl(String raw) {
        String normalized = raw.trim();
        if (normalized.startsWith("postgres://")) {
            normalized = "postgresql://" + normalized.substring("postgres://".length());
        }
        if (!normalized.startsWith("postgresql://") && !normalized.startsWith("jdbc:postgresql://")) {
            throw new IllegalArgumentException("expected postgres/postgresql URL");
        }
        if (normalized.startsWith("jdbc:")) {
            // Already JDBC; leave user/pass to separate env if present.
            return new MappedDb(normalized, null, null);
        }

        URI uri = URI.create(normalized);
        String user = null;
        String password = null;
        if (uri.getUserInfo() != null) {
            String[] parts = uri.getUserInfo().split(":", 2);
            user = decode(parts[0]);
            if (parts.length > 1) {
                password = decode(parts[1]);
            }
        }
        String path = uri.getPath() == null ? "" : uri.getPath();
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String query = uri.getQuery() == null || uri.getQuery().isBlank() ? "" : "?" + uri.getQuery();
        String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + port + "/" + path + query;
        return new MappedDb(jdbc, user, password);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    record MappedDb(String jdbcUrl, String user, String password) {}
}

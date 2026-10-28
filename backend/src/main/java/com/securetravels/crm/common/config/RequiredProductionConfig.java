package com.securetravels.crm.common.config;

import org.springframework.core.env.Environment;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Shared production gate for Trip On Himalaya CRM / Finance ERP / IVR-facing API.
 *
 * <p>Same bar as a Salesforce / Zoho org: the desk does not boot on demo secrets,
 * open CORS, or a localhost database. Used by the Railway early boot check and
 * {@link ProdSecretsValidator}.
 */
public final class RequiredProductionConfig {

    public static final String DEV_JWT = "securetravels-phase1-jwt-secret-change-me-32b-plus";
    public static final String DEV_WEBHOOK = "dev-webhook-secret-insecure-change-me";

    private RequiredProductionConfig() {
    }

    /** Secrets + CORS that must be set before any production / Railway process serves traffic. */
    public static List<String> secretProblems(Environment env) {
        List<String> missing = new ArrayList<>();
        String jwt = firstNonBlank(env.getProperty("JWT_SECRET"), env.getProperty("app.jwt.secret"));
        String webhook = firstNonBlank(env.getProperty("WEBHOOK_SECRET"), env.getProperty("app.webhook.secret"));
        String email = firstNonBlank(env.getProperty("EMAIL_WEBHOOK_SECRET"), env.getProperty("app.email.webhook-secret"));
        String sms = firstNonBlank(env.getProperty("SMS_WEBHOOK_SECRET"), env.getProperty("app.sms.webhook-secret"));

        if (jwt.isBlank() || jwt.equals(DEV_JWT) || jwt.length() < 32) {
            missing.add("JWT_SECRET (≥32 chars, not the checked-in default)");
        }
        if (webhook.isBlank() || webhook.equals(DEV_WEBHOOK)) {
            missing.add("WEBHOOK_SECRET");
        }
        if (email.isBlank()) {
            missing.add("EMAIL_WEBHOOK_SECRET");
        }
        if (sms.isBlank()) {
            missing.add("SMS_WEBHOOK_SECRET");
        }
        String cors = firstNonBlank(env.getProperty("CORS_ALLOWED_ORIGINS"), env.getProperty("app.cors.allowed-origins"));
        if (cors.isBlank() || cors.contains("*") || cors.contains("localhost") || cors.contains("127.0.0.1")) {
            missing.add("CORS_ALLOWED_ORIGINS (exact Vercel/app https origin; no * or localhost)");
        }
        return missing;
    }

    /**
     * Database must be a real Railway (or managed) Postgres — never the local
     * {@code 127.0.0.1} default from {@code application.yml}.
     */
    public static List<String> databaseProblems(Environment env) {
        List<String> missing = new ArrayList<>();
        // Only operator-supplied URLs count. Ignore spring.datasource.url default
        // (jdbc:postgresql://127.0.0.1:5432/…) which is for laptop docker-compose.
        String explicit = firstNonBlank(
                env.getProperty("DATABASE_URL"),
                env.getProperty("POSTGRES_URL"),
                env.getProperty("DATABASE_PRIVATE_URL"),
                env.getProperty("DB_URL"),
                env.getProperty("SPRING_DATASOURCE_URL"));

        if (explicit.isBlank() || isUnresolvedReference(explicit) || isLoopbackDatabase(explicit)) {
            missing.add(
                    "DATABASE_URL — add Railway Postgres, then set DATABASE_URL=${{Postgres.DATABASE_URL}} "
                            + "(match the Postgres service name). Do not use 127.0.0.1 or localhost.");
            return missing;
        }
        return missing;
    }

    static boolean isLoopbackDatabase(String url) {
        String u = url.toLowerCase(Locale.ROOT);
        return u.contains("127.0.0.1")
                || u.contains("localhost")
                || u.contains("0.0.0.0")
                || u.contains("[::1]");
    }

    static boolean isUnresolvedReference(String value) {
        // Operator pasted the template literally without a Postgres plugin.
        return value.contains("${{") || value.contains("${Postgres");
    }

    public static String refusalMessage(List<String> problems) {
        return "Trip On Himalaya CRM API refused to start — production configuration incomplete:\n  - "
                + String.join("\n  - ", problems)
                + "\n\nFix (permanent): Railway → this API service → Variables. "
                + "Add Postgres, set DATABASE_URL=${{Postgres.DATABASE_URL}}, generate secrets with "
                + "ops/gen-prod-secrets.ps1, set CORS_ALLOWED_ORIGINS to your Vercel URL, "
                + "Settings → Networking → Generate Domain, then Vercel API_PROXY_TARGET=that https origin. "
                + "Runbook: docs/deployment/RAILWAY.md";
    }

    static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}

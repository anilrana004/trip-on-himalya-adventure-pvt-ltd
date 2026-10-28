package com.securetravels.crm.common.config;

import org.springframework.core.env.Environment;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared production gate for Trip On Himalaya CRM / Finance ERP / IVR-facing API.
 *
 * <p>Same bar as a Salesforce / Zoho org: the desk does not boot on demo secrets,
 * open CORS, or a missing database. Used by the Railway early boot check and
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

    /** Database must exist before Hibernate/Flyway touch the JVM on Railway. */
    public static List<String> databaseProblems(Environment env) {
        List<String> missing = new ArrayList<>();
        String jdbc = firstNonBlank(
                env.getProperty("DB_URL"),
                env.getProperty("spring.datasource.url"),
                env.getProperty("SPRING_DATASOURCE_URL"),
                env.getProperty("DATABASE_URL"),
                env.getProperty("POSTGRES_URL"),
                env.getProperty("DATABASE_PRIVATE_URL"));
        if (jdbc.isBlank()) {
            missing.add("DATABASE_URL (add Railway Postgres and reference ${{Postgres.DATABASE_URL}})");
        }
        return missing;
    }

    public static String refusalMessage(List<String> problems) {
        return "Trip On Himalaya CRM API refused to start — production configuration incomplete:\n  - "
                + String.join("\n  - ", problems)
                + "\n\nFix (permanent): Railway → this API service → Variables. "
                + "Import ops/ENV.production.example (or root .env.example), generate secrets with "
                + "ops/gen-prod-secrets.ps1, attach Postgres, set CORS_ALLOWED_ORIGINS to your Vercel URL, "
                + "then Settings → Networking → Generate Domain. Full runbook: docs/deployment/RAILWAY.md";
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

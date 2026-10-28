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
 *
 * <p>Browser traffic is same-origin via the Vercel {@code /api} BFF. CORS must
 * still list that app origin. Operators may set {@code CORS_ALLOWED_ORIGINS}
 * or {@code APP_PUBLIC_URL} (https) — never the localhost yaml default.
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
        if (!isProductionSafeOriginList(resolveCorsOrigins(env))) {
            missing.add(
                    "CORS_ALLOWED_ORIGINS or APP_PUBLIC_URL "
                            + "(exact https://your-app.vercel.app — no *, no localhost)");
        }
        return missing;
    }

    /**
     * Prefer explicit CORS, then the public app URL. Never treat the
     * {@code application.yml} localhost default as a production CORS allowlist.
     */
    public static String resolveCorsOrigins(Environment env) {
        String explicit = firstNonBlank(
                env.getProperty("CORS_ALLOWED_ORIGINS"),
                env.getProperty("APP_PUBLIC_URL"),
                env.getProperty("app.public-url"));
        if (isProductionSafeOriginList(explicit)) {
            return stripTrailingSlash(explicit.trim());
        }
        return "";
    }

    public static boolean isProductionSafeOriginList(String cors) {
        if (cors == null || cors.isBlank()) {
            return false;
        }
        String value = cors.trim();
        if (!value.startsWith("https://")) {
            return false;
        }
        String lower = value.toLowerCase(Locale.ROOT);
        return !lower.contains("*")
                && !lower.contains("localhost")
                && !lower.contains("127.0.0.1");
    }

    /**
     * Database must be a real Railway (or managed) Postgres — never the local
     * {@code 127.0.0.1} default from {@code application.yml}.
     */
    public static List<String> databaseProblems(Environment env) {
        List<String> missing = new ArrayList<>();
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
        return value.contains("${{") || value.contains("${Postgres");
    }

    public static String refusalMessage(List<String> problems) {
        return "Trip On Himalaya CRM API refused to start — production configuration incomplete:\n  - "
                + String.join("\n  - ", problems)
                + "\n\nFix (permanent): Railway → API → Variables. Set:\n"
                + "  CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app\n"
                + "  (or APP_PUBLIC_URL to that same https URL)\n"
                + "Also keep DATABASE_URL=${{Postgres.DATABASE_URL}} and JWT/webhook secrets. "
                + "Then Vercel API_PROXY_TARGET=https://<railway-domain>. "
                + "Runbook: docs/deployment/GO_LIVE_LOGIN.md";
    }

    static String stripTrailingSlash(String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
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

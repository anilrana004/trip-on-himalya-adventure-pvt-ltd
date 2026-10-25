package com.securetravels.crm.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Refuses a Railway or {@code prod} boot that is still on checked-in secrets,
 * or that leaves the public email and SMS webhooks without a signing secret.
 * Logs never include secret values. A missing secret used to be a warning so
 * the process could stay up; that left {@code admin}-equivalent webhook
 * forgery available on the public port.
 */
@Component
public class ProdSecretsValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProdSecretsValidator.class);

    static final String DEV_JWT = "securetravels-phase1-jwt-secret-change-me-32b-plus";
    static final String DEV_WEBHOOK = "dev-webhook-secret-insecure-change-me";

    private final Environment env;

    public ProdSecretsValidator(Environment env) {
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!ProductionBoot.detected(env)) {
            return;
        }
        List<String> missing = problems();
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Refusing to boot: set " + String.join(", ", missing)
                            + ". Checked-in defaults and blank email/SMS webhook secrets are not allowed "
                            + "on Railway or the prod profile.");
        }
        log.info("[prod-secrets] JWT_SECRET, WEBHOOK_SECRET, and email/SMS webhook secrets are set");
    }

    List<String> problems() {
        List<String> missing = new ArrayList<>();
        String jwt = firstNonBlank(env.getProperty("JWT_SECRET"), env.getProperty("app.jwt.secret"));
        String webhook = firstNonBlank(env.getProperty("WEBHOOK_SECRET"), env.getProperty("app.webhook.secret"));
        String email = firstNonBlank(env.getProperty("EMAIL_WEBHOOK_SECRET"), env.getProperty("app.email.webhook-secret"));
        String sms = firstNonBlank(env.getProperty("SMS_WEBHOOK_SECRET"), env.getProperty("app.sms.webhook-secret"));

        if (jwt.isBlank() || jwt.equals(DEV_JWT) || jwt.length() < 32) {
            missing.add("JWT_SECRET");
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
            missing.add("CORS_ALLOWED_ORIGINS");
        }
        return missing;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}

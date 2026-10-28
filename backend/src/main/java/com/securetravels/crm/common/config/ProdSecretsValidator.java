package com.securetravels.crm.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

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

    /** @deprecated use {@link RequiredProductionConfig#DEV_JWT} — kept for tests. */
    static final String DEV_JWT = RequiredProductionConfig.DEV_JWT;
    /** @deprecated use {@link RequiredProductionConfig#DEV_WEBHOOK} — kept for tests. */
    static final String DEV_WEBHOOK = RequiredProductionConfig.DEV_WEBHOOK;

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
            throw new IllegalStateException(RequiredProductionConfig.refusalMessage(missing));
        }
        log.info("[prod-secrets] JWT_SECRET, WEBHOOK_SECRET, email/SMS webhook secrets, and CORS are set");
    }

    List<String> problems() {
        return RequiredProductionConfig.secretProblems(env);
    }
}

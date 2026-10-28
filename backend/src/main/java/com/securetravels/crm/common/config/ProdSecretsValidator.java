package com.securetravels.crm.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Refuses a Railway or {@code prod} boot that is still on checked-in secrets,
 * or that leaves the public email and SMS webhooks without a signing secret.
 * Runs early (before seeders) and prints the refusal to stderr so Railway
 * deploy logs always show the missing variable names.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ProdSecretsValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ProdSecretsValidator.class);

    static final String DEV_JWT = RequiredProductionConfig.DEV_JWT;
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
            String message = RequiredProductionConfig.refusalMessage(missing);
            // stderr survives Railway log drains better than structured JSON alone
            System.err.println("================================================================");
            System.err.println(message);
            System.err.println("================================================================");
            log.error("[prod-secrets] refusing boot — missing/invalid: {}", String.join(", ", missing));
            throw new IllegalStateException(message);
        }
        log.info("[prod-secrets] JWT_SECRET, WEBHOOK_SECRET, email/SMS webhook secrets, and CORS are set");
    }

    List<String> problems() {
        return RequiredProductionConfig.secretProblems(env);
    }
}

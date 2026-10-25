package com.securetravels.crm.common.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProdSecretsValidatorTest {

    @Test
    @DisplayName("a local boot may keep the checked-in defaults")
    void localBootDoesNotRefuse() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("JWT_SECRET", ProdSecretsValidator.DEV_JWT);
        new ProdSecretsValidator(env).run(new DefaultApplicationArguments());
    }

    @Test
    @DisplayName("Railway refuses the checked-in JWT and a blank email webhook secret")
    void railwayRefusesDefaults() {
        MockEnvironment env = railway();
        env.setProperty("JWT_SECRET", ProdSecretsValidator.DEV_JWT);
        env.setProperty("WEBHOOK_SECRET", "a-real-webhook-secret-not-the-default");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret-value");

        ProdSecretsValidator validator = new ProdSecretsValidator(env);
        assertThat(validator.problems()).contains("JWT_SECRET", "EMAIL_WEBHOOK_SECRET");
        assertThatThrownBy(() -> validator.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET")
                .hasMessageContaining("EMAIL_WEBHOOK_SECRET");
    }

    @Test
    @DisplayName("the prod profile refuses the checked-in webhook secret")
    void prodRefusesDevWebhook() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        env.setProperty("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz0123456789ABCD");
        env.setProperty("WEBHOOK_SECRET", ProdSecretsValidator.DEV_WEBHOOK);
        env.setProperty("EMAIL_WEBHOOK_SECRET", "email-secret");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret");
        env.setProperty("CORS_ALLOWED_ORIGINS", "https://app.example.com");

        assertThat(new ProdSecretsValidator(env).problems()).containsExactly("WEBHOOK_SECRET");
    }

    @Test
    @DisplayName("a fully configured production boot is allowed")
    void configuredProductionBoots() {
        MockEnvironment env = railway();
        env.setProperty("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz0123456789ABCD");
        env.setProperty("WEBHOOK_SECRET", "a-real-webhook-secret-not-the-default");
        env.setProperty("EMAIL_WEBHOOK_SECRET", "email-secret");
        env.setProperty("SMS_WEBHOOK_SECRET", "sms-secret");
        env.setProperty("CORS_ALLOWED_ORIGINS", "https://app.example.com");
        new ProdSecretsValidator(env).run(new DefaultApplicationArguments());
    }

    private static MockEnvironment railway() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        return env;
    }
}

package com.securetravels.crm.webhook;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookAttemptTest {

    @Test
    void errorTextDropsAMobileAndKeepsTheReason() {
        assertThat(WebhookService.safeError("mobileNumber 9876543210 is not valid"))
                .doesNotContain("9876543210")
                .contains("mobileNumber");
        assertThat(WebhookService.safeError(null)).isNull();
        assertThat(WebhookService.safeError("   ")).isNull();
    }
}

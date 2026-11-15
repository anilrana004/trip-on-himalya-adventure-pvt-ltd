package com.securetravels.crm.automation.zapier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ZapierEventsClientTest {

    private AppProperties props;
    private ZapierEventsClient client;

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.getZapier().setEventsHookUrl("https://hooks.zapier.com/hooks/catch/test/unit/");
        props.getZapier().setEventsEnabled(true);
        client = new ZapierEventsClient(props, new ObjectMapper());
    }

    @Test
    void enabled_whenHookPresentAndFlagOn() {
        assertThat(client.configured()).isTrue();
        assertThat(client.enabled()).isTrue();
    }

    @Test
    void publishAsync_skipsWhenEventsDisabled() {
        props.getZapier().setEventsEnabled(false);
        assertThat(client.enabled()).isFalse();

        client.publishAsync("lead.created", Map.of("leadId", "1"));

        assertThat(client.stats().get("skippedDisabled")).isEqualTo(1L);
        assertThat(client.stats().get("published")).isEqualTo(0L);
    }

    @Test
    void publishAsync_skipsWhenHookBlank() {
        props.getZapier().setEventsHookUrl("");
        assertThat(client.configured()).isFalse();

        client.publishAsync("lead.created", Map.of("leadId", "1"));

        assertThat(client.stats().get("skippedUnconfigured")).isEqualTo(1L);
    }

    @Test
    void leadData_includesCoreFields() {
        Map<String, Object> data = ZapierEventsClient.leadData(
                java.util.UUID.fromString("00000000-0000-0000-0000-000000000001"),
                "Guest", "9876543210", "WEBSITE", "Anil", "NEW");
        assertThat(data).containsEntry("customerName", "Guest")
                .containsEntry("mobile", "9876543210")
                .containsEntry("stage", "NEW");
    }
}

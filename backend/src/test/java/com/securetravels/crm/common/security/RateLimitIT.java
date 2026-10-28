package com.securetravels.crm.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.webhook.WebhookSignature;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Webhook intake flood ceiling. Login failed-password lockout lives in
 * {@link com.securetravels.crm.auth.LoginThrottleIT}.
 */
@TestPropertySource(properties = {
        "app.webhook.rate-limit.capacity=3",
        "app.webhook.rate-limit.refill-per-window=3",
        "app.webhook.rate-limit.window-minutes=1"
})
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RateLimitIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppProperties props;

    private static final String WEBHOOK_IP = "rate-test-webhook-" + UUID.randomUUID();

    @Test
    void webhookAllowsThreePerMinuteThenReturns429() throws Exception {
        List<Integer> statuses = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Map<String, Object> body = webhookBody();
            statuses.add(mockMvc.perform(post("/api/webhook/lead")
                            .header("X-Forwarded-For", WEBHOOK_IP)
                            .header(WebhookSignature.HEADER, signature(body))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andReturn().getResponse().getStatus());
        }
        assertThat(statuses.subList(0, 3)).doesNotContain(429);
        assertThat(statuses.get(3)).isEqualTo(429);
    }

    @Test
    void webhook429HasRateLimitCode() throws Exception {
        for (int i = 0; i < 3; i++) {
            Map<String, Object> body = webhookBody();
            mockMvc.perform(post("/api/webhook/lead")
                            .header("X-Forwarded-For", WEBHOOK_IP + "-hdr")
                            .header(WebhookSignature.HEADER, signature(body))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andReturn();
        }
        Map<String, Object> body = webhookBody();
        mockMvc.perform(post("/api/webhook/lead")
                        .header("X-Forwarded-For", WEBHOOK_IP + "-hdr")
                        .header(WebhookSignature.HEADER, signature(body))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    private Map<String, Object> webhookBody() {
        return new java.util.LinkedHashMap<>(Map.of(
                "customer_name", "Rate Test",
                "mobile_number", "98" + (10000000 + (int) (Math.random() * 89999999)),
                "destination", "Rishikesh",
                "num_persons", 1,
                "consent_given", true));
    }

    private String signature(Map<String, Object> body) throws Exception {
        return "sha256=" + WebhookSignature.compute(props.getWebhook().getSecret(),
                objectMapper.writeValueAsString(body).getBytes(StandardCharsets.UTF_8));
    }
}

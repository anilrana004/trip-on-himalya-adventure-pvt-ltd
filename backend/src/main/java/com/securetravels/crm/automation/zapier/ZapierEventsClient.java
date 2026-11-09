package com.securetravels.crm.automation.zapier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.security.HmacSigner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Posts CRM lifecycle events to a Zapier Catch Hook (Slack / Gmail / Teams, etc.).
 * Failures are logged and never block the sales desk transaction.
 */
@Component
public class ZapierEventsClient {

    private static final Logger log = LoggerFactory.getLogger(ZapierEventsClient.class);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ExecutorService pool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "zapier-events");
        t.setDaemon(true);
        return t;
    });

    public ZapierEventsClient(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public boolean configured() {
        String hook = props.getZapier().getEventsHookUrl();
        return hook != null && !hook.isBlank() && hook.startsWith("https://");
    }

    /** Fire-and-forget POST. Safe to call inside @Transactional methods. */
    public void publishAsync(String event, Map<String, Object> data) {
        if (!configured()) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", event);
        payload.put("occurredAt", Instant.now().toString());
        payload.put("source", "trip-on-himalaya-crm");
        payload.put("data", data == null ? Map.of() : data);
        pool.execute(() -> post(event, payload));
    }

    private void post(String event, Map<String, Object> payload) {
        try {
            String hook = props.getZapier().getEventsHookUrl().trim();
            String body = mapper.writeValueAsString(payload);
            String secret = props.getWebhook().getSecret();
            String signature = HmacSigner.sign(secret, body.getBytes(StandardCharsets.UTF_8));

            HttpRequest req = HttpRequest.newBuilder(URI.create(hook))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("X-Webhook-Signature", signature)
                    .header("X-TOH-Event", event)
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                log.warn("[zapier-events] event={} http={} body={}", event, res.statusCode(),
                        res.body() == null ? "" : res.body().substring(0, Math.min(160, res.body().length())));
            } else {
                log.info("[zapier-events] event={} ok", event);
            }
        } catch (Exception ex) {
            log.warn("[zapier-events] event={} failed: {}", event, ex.getMessage());
        }
    }

    public static Map<String, Object> leadData(UUID leadId, String customerName, String mobile,
                                               String source, String ownerName, String stage) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (leadId != null) m.put("leadId", leadId.toString());
        m.put("customerName", customerName);
        m.put("mobile", mobile);
        m.put("source", source);
        m.put("ownerName", ownerName);
        m.put("stage", stage);
        return m;
    }
}

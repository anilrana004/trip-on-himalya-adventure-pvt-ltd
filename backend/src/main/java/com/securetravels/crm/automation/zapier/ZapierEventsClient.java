package com.securetravels.crm.automation.zapier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.security.HmacSigner;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.concurrent.atomic.AtomicLong;

/**
 * Posts CRM lifecycle events to a Zapier Catch Hook (Slack / Gmail / Teams, etc.).
 * Failures are logged and never block the sales desk transaction.
 *
 * <p>When {@code app.zapier.events-enabled=false} or the hook URL is blank, publishes
 * are skipped (native EmailGateway / in-app notifications still run elsewhere).
 */
@Component
public class ZapierEventsClient {

    private static final Logger log = LoggerFactory.getLogger(ZapierEventsClient.class);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final AtomicLong published = new AtomicLong();
    private final AtomicLong skippedDisabled = new AtomicLong();
    private final AtomicLong skippedUnconfigured = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final Counter publishedCounter;
    private final Counter skippedDisabledCounter;
    private final Counter skippedUnconfiguredCounter;
    private final Counter failedCounter;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ExecutorService pool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "zapier-events");
        t.setDaemon(true);
        return t;
    });

    @Autowired
    public ZapierEventsClient(AppProperties props, ObjectMapper mapper,
                              @Autowired(required = false) MeterRegistry registry) {
        this.props = props;
        this.mapper = mapper;
        if (registry != null) {
            this.publishedCounter = Counter.builder("toh.zapier.events.published").register(registry);
            this.skippedDisabledCounter = Counter.builder("toh.zapier.events.skipped_disabled").register(registry);
            this.skippedUnconfiguredCounter = Counter.builder("toh.zapier.events.skipped_unconfigured").register(registry);
            this.failedCounter = Counter.builder("toh.zapier.events.failed").register(registry);
        } else {
            this.publishedCounter = null;
            this.skippedDisabledCounter = null;
            this.skippedUnconfiguredCounter = null;
            this.failedCounter = null;
        }
    }

    /** Test helper without Micrometer. */
    public ZapierEventsClient(AppProperties props, ObjectMapper mapper) {
        this(props, mapper, null);
    }

    public boolean configured() {
        String hook = props.getZapier().getEventsHookUrl();
        return hook != null && !hook.isBlank() && hook.startsWith("https://");
    }

    /** Hook URL present and {@code app.zapier.events-enabled=true}. */
    public boolean enabled() {
        return props.getZapier().isEventsEnabled() && configured();
    }

    public Map<String, Long> stats() {
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("published", published.get());
        m.put("skippedDisabled", skippedDisabled.get());
        m.put("skippedUnconfigured", skippedUnconfigured.get());
        m.put("failed", failed.get());
        return m;
    }

    /** Fire-and-forget POST. Safe to call inside @Transactional methods. */
    public void publishAsync(String event, Map<String, Object> data) {
        if (!props.getZapier().isEventsEnabled()) {
            skippedDisabled.incrementAndGet();
            if (skippedDisabledCounter != null) skippedDisabledCounter.increment();
            log.debug("[zapier-events] skipped (events-enabled=false) event={}", event);
            return;
        }
        if (!configured()) {
            skippedUnconfigured.incrementAndGet();
            if (skippedUnconfiguredCounter != null) skippedUnconfiguredCounter.increment();
            log.debug("[zapier-events] skipped (no hook url) event={}", event);
            return;
        }
        Map<String, Object> nested = data == null ? Map.of() : data;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", event);
        payload.put("occurredAt", Instant.now().toString());
        payload.put("source", "trip-on-himalaya-crm");
        payload.put("data", nested);
        // Flat mirrors so Zapier Email/Slack field pickers map without nested paths.
        for (Map.Entry<String, Object> e : nested.entrySet()) {
            payload.putIfAbsent(e.getKey(), e.getValue());
        }
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
                failed.incrementAndGet();
                if (failedCounter != null) failedCounter.increment();
                log.warn("[zapier-events] event={} http={} body={}", event, res.statusCode(),
                        res.body() == null ? "" : res.body().substring(0, Math.min(160, res.body().length())));
            } else {
                published.incrementAndGet();
                if (publishedCounter != null) publishedCounter.increment();
                log.info("[zapier-events] event={} ok", event);
            }
        } catch (Exception ex) {
            failed.incrementAndGet();
            if (failedCounter != null) failedCounter.increment();
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

package com.securetravels.crm.automation.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.automation.runtime.RuntimeSnapshot;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.communications.TimelineEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Small CRM messaging agent: composes personalized guest copy for automation.
 *
 * <p>Does not send by itself — {@code ActionExecutor.AI_SEND_MESSAGE} calls
 * {@link #compose} then SendGate, and only when {@link #channelWorkable} and
 * {@link #ready()} are true.
 */
@Component
public class AiMessagingAgent {

    private static final Logger log = LoggerFactory.getLogger(AiMessagingAgent.class);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public AiMessagingAgent(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean ready() {
        return props.getAi().ready();
    }

    public String statusLabel() {
        AppProperties.Ai ai = props.getAi();
        if (!ai.isEnabled()) {
            return "Off — set AI_AGENT_ENABLED=true";
        }
        if (!ai.ready()) {
            return "Enabled but not ready — set AI_AGENT_API_KEY for OPENAI";
        }
        return "Ready · " + ai.getProvider().name()
                + (ai.getProvider() == AppProperties.Ai.Provider.OPENAI ? " · " + ai.getModel() : "");
    }

    /**
     * Channel is workable when sandbox (always deliverable for testing) or live
     * credentials are present for SES / Interakt.
     */
    public boolean channelWorkable(TimelineEvent.Channel channel) {
        if (channel == null) {
            return false;
        }
        return switch (channel) {
            case EMAIL -> {
                var email = props.getEmail();
                if (email.getMode() == AppProperties.Email.Mode.SANDBOX) {
                    yield true;
                }
                yield email.live() && email.getAccessKey() != null && !email.getAccessKey().isBlank()
                        && email.getSecretKey() != null && !email.getSecretKey().isBlank();
            }
            case WHATSAPP -> {
                var wa = props.getWhatsApp();
                if (wa.getMode() == AppProperties.WhatsApp.Mode.SANDBOX) {
                    yield true;
                }
                yield wa.getMode() == AppProperties.WhatsApp.Mode.INTERAKT && wa.configured();
            }
            default -> false;
        };
    }

    public String channelNotWorkableReason(TimelineEvent.Channel channel) {
        if (channel == TimelineEvent.Channel.EMAIL) {
            return "Email channel not workable — use SANDBOX or configure SES credentials";
        }
        if (channel == TimelineEvent.Channel.WHATSAPP) {
            return "WhatsApp channel not workable — use SANDBOX or set INTERAKT_API_KEY";
        }
        return "AI agent does not support channel " + channel;
    }

    public AiComposeResult compose(String intent, TimelineEvent.Channel channel,
                                   RuntimeSnapshot snapshot, int slotCount) {
        if (!ready()) {
            throw new IllegalStateException("AI messaging agent is not ready");
        }
        String intentKey = intent == null || intent.isBlank() ? "FOLLOW_UP" : intent.trim().toUpperCase(Locale.ROOT);
        Context ctx = Context.from(snapshot);

        if (props.getAi().getProvider() == AppProperties.Ai.Provider.STUB) {
            return stubCompose(intentKey, channel, ctx, slotCount);
        }
        return openAiCompose(intentKey, channel, ctx, slotCount);
    }

    private AiComposeResult stubCompose(String intent, TimelineEvent.Channel channel,
                                        Context ctx, int slotCount) {
        String trek = ctx.trek();
        String name = ctx.name();
        String subject = switch (intent) {
            case "QUOTATION_CHASE" -> "Quick check-in on your " + trek + " quote";
            case "BOOKING_NUDGE" -> "Ready to lock your " + trek + " dates?";
            default -> "Following up on your " + trek + " enquiry";
        };
        String body = switch (intent) {
            case "QUOTATION_CHASE" ->
                    "Hi " + name + ",\n\nJust checking whether you had a chance to review the "
                            + trek + " quotation. Happy to adjust dates or inclusions — reply here "
                            + "and we will help.\n\nTrip On Himalaya";
            case "BOOKING_NUDGE" ->
                    "Hi " + name + ",\n\nSeats for " + trek + " move quickly. If you want to "
                            + "confirm, we can hold a place and share the payment link.\n\nTrip On Himalaya";
            default ->
                    "Hi " + name + ",\n\nThanks for your interest in " + trek
                            + ". I am following up to help with dates, fitness level, or a tailored plan. "
                            + "What would be most useful next?\n\nTrip On Himalaya";
        };
        List<String> slots = fillSlots(slotCount, trek, name);
        if (channel == TimelineEvent.Channel.WHATSAPP) {
            return new AiComposeResult(null, body, slots, "STUB");
        }
        return new AiComposeResult(subject, body, slots, "STUB");
    }

    private AiComposeResult openAiCompose(String intent, TimelineEvent.Channel channel,
                                          Context ctx, int slotCount) {
        AppProperties.Ai ai = props.getAi();
        String system = """
                You write short, professional guest messages for Trip On Himalaya, a Himalayan trek operator.
                Never invent prices, medical claims, or guarantees. No markdown. No emojis.
                Return strict JSON only with keys: subject (string), body (string), bodyValues (string array).
                bodyValues length must match the requested slot count (trek name first, guest first name second when slots >= 2).
                """;
        String user = "intent=" + intent
                + " channel=" + channel.name()
                + " guestName=" + ctx.name()
                + " trek=" + ctx.trek()
                + " source=" + ctx.source()
                + " status=" + ctx.status()
                + " slotCount=" + Math.max(0, slotCount);

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", ai.getModel());
            payload.put("temperature", 0.4);
            payload.put("messages", List.of(
                    Map.of("role", "system", "content", system),
                    Map.of("role", "user", "content", user)));
            payload.put("response_format", Map.of("type", "json_object"));

            String base = ai.getBaseUrl() == null || ai.getBaseUrl().isBlank()
                    ? "https://api.openai.com/v1" : ai.getBaseUrl().replaceAll("/$", "");
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(base + "/chat/completions"))
                    .timeout(ai.getTimeout() == null ? Duration.ofSeconds(20) : ai.getTimeout())
                    .header("Authorization", "Bearer " + ai.getApiKey().trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("OpenAI HTTP " + response.statusCode() + ": "
                        + truncate(response.body(), 200));
            }
            JsonNode root = mapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (content.isBlank()) {
                throw new IllegalStateException("OpenAI returned empty content");
            }
            JsonNode parsed = mapper.readTree(content);
            String subject = textOr(parsed.path("subject"), stubCompose(intent, channel, ctx, slotCount).subject());
            String body = textOr(parsed.path("body"), stubCompose(intent, channel, ctx, slotCount).body());
            List<String> slots = readSlots(parsed.path("bodyValues"), slotCount, ctx);
            log.info("[ai-agent] composed intent={} channel={} provider=OPENAI model={}",
                    intent, channel, ai.getModel());
            return new AiComposeResult(
                    channel == TimelineEvent.Channel.WHATSAPP ? null : subject,
                    body,
                    slots,
                    "OPENAI");
        } catch (Exception ex) {
            log.warn("[ai-agent] OpenAI compose failed, falling back to STUB: {}", ex.getMessage());
            AiComposeResult stub = stubCompose(intent, channel, ctx, slotCount);
            return new AiComposeResult(stub.subject(), stub.body(), stub.bodyValues(), "STUB_FALLBACK");
        }
    }

    private static List<String> readSlots(JsonNode node, int slotCount, Context ctx) {
        if (slotCount <= 0) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode item : node) {
                if (out.size() >= slotCount) {
                    break;
                }
                out.add(item.asText(""));
            }
        }
        while (out.size() < slotCount) {
            out.add(out.isEmpty() ? ctx.trek() : ctx.name());
        }
        return out;
    }

    private static List<String> fillSlots(int slotCount, String trek, String name) {
        if (slotCount <= 0) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        out.add(trek);
        if (slotCount >= 2) {
            out.add(name);
        }
        while (out.size() < slotCount) {
            out.add("");
        }
        return out;
    }

    private static String textOr(JsonNode node, String fallback) {
        String v = node.asText(null);
        return v == null || v.isBlank() ? fallback : v.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private record Context(String name, String trek, String source, String status) {
        static Context from(RuntimeSnapshot snapshot) {
            String name = firstNonBlank(
                    snapshot.asString("customerName"),
                    snapshot.asString("fullName"),
                    "there");
            String trek = firstNonBlank(
                    snapshot.asString("destination"),
                    snapshot.asString("packageName"),
                    "your Himalayan trek");
            String source = firstNonBlank(snapshot.asString("source"), "OTHER");
            String status = firstNonBlank(snapshot.asString("status"), "NEW");
            return new Context(name, trek, source, status);
        }

        private static String firstNonBlank(String... values) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    return v.trim();
                }
            }
            return "";
        }
    }
}

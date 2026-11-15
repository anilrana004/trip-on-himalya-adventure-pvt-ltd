package com.securetravels.crm.communications;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Live Meta WhatsApp Cloud API gateway — company WABA, no BSP (Interakt etc.).
 *
 * <p>Posts approved template messages to
 * {@code POST /{graph-version}/{phone-number-id}/messages}.
 */
@Component
@ConditionalOnProperty(prefix = "app.whatsapp", name = "mode", havingValue = "META")
public class MetaWhatsAppGateway implements WhatsAppGateway {

    private static final Logger log = LoggerFactory.getLogger(MetaWhatsAppGateway.class);
    public static final String PROVIDER = "META_WHATSAPP";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AppProperties.WhatsApp wa;

    public MetaWhatsAppGateway(RestClient metaWhatsAppRestClient, ObjectMapper objectMapper,
                               AppProperties props) {
        this.restClient = metaWhatsAppRestClient;
        this.objectMapper = objectMapper;
        this.wa = props.getWhatsApp();
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public SendResult send(SendCommand command) {
        if (!wa.configured()) {
            return SendResult.failure(
                    "META_WA_PHONE_NUMBER_ID / META_WA_ACCESS_TOKEN not set", null, null, false);
        }

        String to = digitsOnly(command.countryCode()) + digitsOnly(command.phoneNumber());
        if (to.isBlank()) {
            return SendResult.failure("Missing recipient phone", null, null, false);
        }

        Map<String, Object> body = buildTemplatePayload(
                to, command.templateName(), command.languageCode(), nullSafe(command.bodyValues()));

        String url = messagesUrl();
        ResponseEntity<String> response;
        try {
            response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + wa.getAccessToken().trim())
                    .body(body)
                    .exchange((req, res) -> {
                        String raw = res.bodyTo(String.class);
                        return ResponseEntity.status(res.getStatusCode()).body(raw);
                    }, false);
        } catch (RestClientException e) {
            log.warn("[meta-wa] transport failure template={}: {}", command.templateName(), e.getMessage());
            return SendResult.failure(shorten(e.getMessage(), 500), null, null, true);
        }

        return interpret(response.getStatusCode(), response.getBody(), command.templateName());
    }

    private String messagesUrl() {
        String base = wa.getGraphBaseUrl() == null || wa.getGraphBaseUrl().isBlank()
                ? "https://graph.facebook.com" : wa.getGraphBaseUrl().replaceAll("/$", "");
        String version = wa.getGraphApiVersion() == null || wa.getGraphApiVersion().isBlank()
                ? "v21.0" : wa.getGraphApiVersion().replaceAll("^/+|/+$", "");
        return base + "/" + version + "/" + wa.getPhoneNumberId().trim() + "/messages";
    }

    private static Map<String, Object> buildTemplatePayload(String to, String templateName,
                                                            String languageCode, List<String> bodyValues) {
        Map<String, Object> template = new LinkedHashMap<>();
        template.put("name", templateName);
        template.put("language", Map.of("code",
                languageCode == null || languageCode.isBlank() ? "en" : languageCode));

        if (!bodyValues.isEmpty()) {
            List<Map<String, Object>> parameters = new ArrayList<>();
            for (String value : bodyValues) {
                parameters.add(Map.of("type", "text", "text", value == null ? "" : value));
            }
            template.put("components", List.of(Map.of(
                    "type", "body",
                    "parameters", parameters)));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", to);
        payload.put("type", "template");
        payload.put("template", template);
        return payload;
    }

    private SendResult interpret(HttpStatusCode status, String raw, String templateName) {
        if (!status.is2xxSuccessful()) {
            boolean retryable = status.value() == 429 || status.is5xxServerError();
            String detail = extractError(raw);
            log.warn("[meta-wa] HTTP {} template={}: {}", status.value(), templateName, detail);
            return SendResult.failure(shorten("HTTP " + status.value() + ": " + detail, 500),
                    String.valueOf(status.value()), shorten(detail, 300), retryable);
        }
        String messageId = extractMessageId(raw);
        if (messageId == null || messageId.isBlank()) {
            log.warn("[meta-wa] success without message id; status webhooks cannot correlate");
            return SendResult.ok("meta-unknown-" + System.currentTimeMillis());
        }
        return SendResult.ok(messageId);
    }

    private String extractMessageId(String raw) {
        try {
            JsonNode root = objectMapper.readTree(raw == null ? "{}" : raw);
            JsonNode messages = root.path("messages");
            if (messages.isArray() && !messages.isEmpty()) {
                return messages.get(0).path("id").asText(null);
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    private String extractError(String raw) {
        try {
            JsonNode root = objectMapper.readTree(raw == null ? "{}" : raw);
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                String message = error.path("message").asText("");
                String code = error.path("code").asText("");
                return (code.isBlank() ? "" : code + " ") + message;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return raw == null ? "" : raw;
    }

    private static List<String> nullSafe(List<String> values) {
        return values == null ? List.of() : values;
    }

    private static String digitsOnly(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c >= '0' && c <= '9') {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String shorten(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}

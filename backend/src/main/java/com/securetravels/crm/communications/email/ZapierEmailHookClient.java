package com.securetravels.crm.communications.email;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.security.HmacSigner;
import com.securetravels.crm.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Posts one campaign recipient to a Zapier Catch Hook with HMAC over the raw body.
 */
@Component
public class ZapierEmailHookClient {

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public ZapierEmailHookClient(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public String postRecipient(EmailCampaign campaign, EmailCampaignRecipient recipient) throws Exception {
        String hook = props.getEmail().getZapierHookUrl();
        if (hook == null || hook.isBlank()) {
            throw new BadRequestException(
                    "ZAPIER_EMAIL_HOOK_URL is not set. Create a Zapier Catch Hook and paste it into Railway.");
        }
        if (!hook.startsWith("https://")) {
            throw new BadRequestException("ZAPIER_EMAIL_HOOK_URL must be https://");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("campaignId", campaign.getId().toString());
        payload.put("campaignName", campaign.getName());
        payload.put("recipientId", recipient.getId().toString());
        payload.put("leadId", recipient.getLeadId().toString());
        payload.put("email", recipient.getEmail());
        payload.put("customerName", recipient.getCustomerName());
        payload.put("templateCode", campaign.getTemplateCode() == null ? "LEAD_FOLLOW_UP" : campaign.getTemplateCode());
        payload.put("subject", campaign.getSubjectOverride());
        payload.put("body", campaign.getBodyText());
        payload.put("fromHint", props.getEmail().getFrom());

        String body = mapper.writeValueAsString(payload);
        String secret = props.getWebhook().getSecret();
        String signature = HmacSigner.sign(secret, body.getBytes(StandardCharsets.UTF_8));

        HttpRequest req = HttpRequest.newBuilder(URI.create(hook.trim()))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .header("X-Webhook-Signature", signature)
                .header("X-TOH-Campaign-Id", campaign.getId().toString())
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("Zapier hook HTTP " + res.statusCode() + ": "
                    + (res.body() == null ? "" : res.body().substring(0, Math.min(200, res.body().length()))));
        }
        return "zapier-" + UUID.randomUUID();
    }
}

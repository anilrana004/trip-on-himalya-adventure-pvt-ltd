package com.securetravels.crm.payment.webhook;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.WebhookSignatureException;
import com.securetravels.crm.common.security.HmacSigner;
import com.securetravels.crm.payment.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/**
 * Razorpay payment webhooks (CORE C4). Verifies {@code X-Razorpay-Signature}
 * as lowercase HMAC-SHA256 hex of the raw body (no {@code sha256=} prefix).
 * Applies {@code payment.captured} / {@code payment.authorized} by matching
 * {@code payload.payment.entity.id} to {@code payments.gateway_ref}.
 */
@Service
public class RazorpayWebhookService {

    private static final Logger log = LoggerFactory.getLogger(RazorpayWebhookService.class);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final PaymentService payments;

    public RazorpayWebhookService(AppProperties props, ObjectMapper mapper, PaymentService payments) {
        this.props = props;
        this.mapper = mapper;
        this.payments = payments;
    }

    @Transactional
    public int handle(byte[] raw, String signatureHeader) {
        String secret = props.getPayments().getRazorpayWebhookSecret();
        if (secret == null || secret.isBlank()) {
            throw new WebhookSignatureException("RAZORPAY_WEBHOOK_SECRET is not configured");
        }
        if (!signatureMatches(secret, signatureHeader, raw)) {
            throw new WebhookSignatureException("Invalid Razorpay webhook signature");
        }
        JsonNode root;
        try {
            root = mapper.readTree(raw);
        } catch (Exception e) {
            log.warn("[razorpay] unreadable body: {}", e.getMessage());
            return 0;
        }
        String event = text(root, "event");
        if (!"payment.captured".equals(event) && !"payment.authorized".equals(event)) {
            log.debug("[razorpay] ignore event={}", event);
            return 0;
        }
        JsonNode entity = root.path("payload").path("payment").path("entity");
        String gatewayRef = text(entity, "id");
        if (gatewayRef == null || gatewayRef.isBlank()) {
            log.warn("[razorpay] missing payment entity id event={}", event);
            return 0;
        }
        Instant paidAt = Instant.now();
        if (entity.hasNonNull("created_at")) {
            try {
                paidAt = Instant.ofEpochSecond(entity.get("created_at").asLong());
            } catch (Exception ignored) {
                // keep now
            }
        }
        boolean applied = payments.confirmFromGateway(gatewayRef, paidAt);
        return applied ? 1 : 0;
    }

    static boolean signatureMatches(String secret, String provided, byte[] payload) {
        if (provided == null || provided.isBlank()) {
            return false;
        }
        String expectedHex = HmacSigner.computeHex(secret, payload);
        String providedHex = provided.startsWith(HmacSigner.PREFIX)
                ? provided.substring(HmacSigner.PREFIX.length())
                : provided;
        return MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.UTF_8),
                providedHex.getBytes(StandardCharsets.UTF_8));
    }

    private static String text(JsonNode node, String field) {
        JsonNode child = node.get(field);
        return child == null || child.isNull() ? null : child.asText();
    }
}

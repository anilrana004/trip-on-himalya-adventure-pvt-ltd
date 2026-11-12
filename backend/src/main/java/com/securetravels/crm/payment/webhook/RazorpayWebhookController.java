package com.securetravels.crm.payment.webhook;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public Razorpay webhook (CORE C4). Covered by {@code /api/webhook/**}
 * permitAll; authenticity is HMAC on the raw body.
 */
@RestController
@RequestMapping("/api/webhook/payments/razorpay")
public class RazorpayWebhookController {

    public static final String SIGNATURE_HEADER = "X-Razorpay-Signature";

    private final RazorpayWebhookService service;

    public RazorpayWebhookController(RazorpayWebhookService service) {
        this.service = service;
    }

    @Operation(summary = "Razorpay payment webhook",
            description = "Public endpoint. Header " + SIGNATURE_HEADER
                    + " is HMAC-SHA256 hex of the raw body with RAZORPAY_WEBHOOK_SECRET. "
                    + "payment.captured / payment.authorized complete the CRM payment whose "
                    + "gateway_ref matches the Razorpay payment id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Event accepted (applied=0 means duplicate or unknown)"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid HMAC signature")
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> receive(
            @RequestBody byte[] raw,
            @RequestHeader(value = SIGNATURE_HEADER, required = false) String signature) {
        int applied = service.handle(raw, signature);
        return Map.of("accepted", true, "applied", applied);
    }
}

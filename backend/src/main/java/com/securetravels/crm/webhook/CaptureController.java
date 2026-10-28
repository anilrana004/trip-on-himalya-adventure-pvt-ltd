package com.securetravels.crm.webhook;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read side of form capture. The public HMAC intake stays on
 * {@code POST /api/webhook/lead}. This path is authenticated and never
 * returns the stored form body.
 */
@RestController
@RequestMapping("/api/capture")
@SecurityRequirement(name = "bearerAuth")
public class CaptureController {

    private final WebhookService webhookService;

    public CaptureController(WebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @Operation(summary = "Recent website form posts, without the form body")
    @GetMapping(path = "/website-attempts", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public List<WebhookAttemptResponse> websiteAttempts() {
        return webhookService.recentAttempts();
    }
}

package com.securetravels.crm.webhook;

import java.time.Instant;
import java.util.UUID;

/**
 * One public-channel form attempt. The stored payload is never returned.
 */
public record WebhookAttemptResponse(
        UUID id,
        String source,
        String status,
        String errorMessage,
        UUID leadId,
        Instant createdAt
) {}

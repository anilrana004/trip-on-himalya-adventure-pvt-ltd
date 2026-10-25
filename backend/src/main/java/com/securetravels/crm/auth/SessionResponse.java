package com.securetravels.crm.auth;

import java.time.Instant;
import java.util.UUID;

/** One live refresh-token row. The hash itself is never returned. */
public record SessionResponse(
        UUID id,
        Instant createdAt,
        Instant expiresAt,
        boolean current
) {}

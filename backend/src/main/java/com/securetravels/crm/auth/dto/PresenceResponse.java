package com.securetravels.crm.auth.dto;

import java.time.Instant;
import java.util.UUID;

public record PresenceResponse(
        UUID id,
        UUID userId,
        String fullName,
        String email,
        String role,
        Instant loginAt,
        Instant logoutAt,
        boolean open,
        long elapsedSeconds
) {
}

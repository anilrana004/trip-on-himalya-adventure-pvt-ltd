package com.securetravels.crm.face.dto;

import java.time.Instant;
import java.util.UUID;

public record FaceRosterItemResponse(
        UUID userId,
        String fullName,
        String email,
        String role,
        boolean enrolled,
        Instant enrolledAt,
        int sampleCount
) {
}

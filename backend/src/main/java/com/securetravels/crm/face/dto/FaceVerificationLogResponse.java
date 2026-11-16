package com.securetravels.crm.face.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FaceVerificationLogResponse(
        UUID id,
        UUID subjectUserId,
        String subjectName,
        UUID matchedUserId,
        String matchedName,
        UUID verifiedBy,
        String verifiedByName,
        String purpose,
        String result,
        BigDecimal score,
        boolean hasSnapshot,
        Instant createdAt
) {
}

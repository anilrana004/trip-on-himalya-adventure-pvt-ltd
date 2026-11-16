package com.securetravels.crm.face.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FaceVerifyResponse(
        UUID id,
        UUID subjectUserId,
        UUID matchedUserId,
        String matchedFullName,
        String matchedEmail,
        String purpose,
        String result,
        BigDecimal score,
        BigDecimal threshold,
        Instant createdAt
) {
}

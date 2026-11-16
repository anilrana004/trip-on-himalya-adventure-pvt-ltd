package com.securetravels.crm.face.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record FaceVerifyRequest(
        /** When set, 1:1 check against that enrolled person. When null, identify among enrolled staff. */
        UUID subjectUserId,
        @NotEmpty @Size(min = 128, max = 128) List<Double> descriptor,
        @NotNull @Size(min = 1, max = 30) String purpose,
        String snapshotJpegBase64,
        UUID loginSessionId,
        @Size(max = 200) String note
) {
}

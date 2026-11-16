package com.securetravels.crm.face.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record FaceEnrollRequest(
        @NotNull UUID userId,
        @NotEmpty @Size(min = 1, max = 5) List<@Size(min = 128, max = 128) List<Double>> descriptors,
        String snapshotJpegBase64
) {
}

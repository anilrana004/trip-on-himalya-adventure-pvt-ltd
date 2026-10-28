package com.securetravels.crm.trip.faq;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record TripFaqWriteRequest(
        @NotNull UUID tripId,
        @NotBlank @Size(max = 300) String question,
        @NotBlank @Size(max = 4000) String answer,
        Boolean published
) {
}

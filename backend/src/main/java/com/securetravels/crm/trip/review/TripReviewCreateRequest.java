package com.securetravels.crm.trip.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record TripReviewCreateRequest(
        @NotNull UUID tripId,
        UUID bookingId,
        @NotBlank @Size(max = 200) String guestName,
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 2000) String body
) {
}

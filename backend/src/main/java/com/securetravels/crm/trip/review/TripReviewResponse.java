package com.securetravels.crm.trip.review;

import com.securetravels.crm.trip.review.TripReview.Status;

import java.time.Instant;
import java.util.UUID;

public record TripReviewResponse(
        UUID id,
        UUID tripId,
        String tripName,
        UUID bookingId,
        String guestName,
        int rating,
        String body,
        Status status,
        Instant createdAt
) {
}

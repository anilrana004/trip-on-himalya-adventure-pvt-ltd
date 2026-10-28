package com.securetravels.crm.trip.review;

import com.securetravels.crm.trip.review.TripReview.Status;
import jakarta.validation.constraints.NotNull;

public record TripReviewStatusRequest(@NotNull Status status) {
}

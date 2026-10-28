package com.securetravels.crm.trip.dto;

public record TripCloneResponse(
        TripDetailResponse trip,
        int highlights,
        int faqs,
        int tags
) {
}

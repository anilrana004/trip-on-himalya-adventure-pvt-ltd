package com.securetravels.crm.storefront.dto;

import com.securetravels.crm.trip.Trip;

import java.math.BigDecimal;
import java.util.UUID;

/** Public trek detail for the customer storefront. */
public record StorefrontTripDetail(
        UUID id,
        String name,
        String slug,
        Trip.Category category,
        Trip.BookingType bookingType,
        Trip.Difficulty difficulty,
        BigDecimal fromPriceInr,
        int durationDays,
        String coverImageUrl,
        String metaTitle,
        String metaDescription,
        String itinerary,
        String inclusions,
        String exclusions
) {
    public static StorefrontTripDetail from(Trip t) {
        return new StorefrontTripDetail(
                t.getId(),
                t.getName(),
                t.getSlug(),
                t.getCategory(),
                t.getBookingType(),
                t.getDifficulty(),
                t.getBaseCost(),
                t.getDurationDays(),
                t.getCoverImageUrl(),
                t.getMetaTitle(),
                t.getMetaDescription(),
                t.getItinerary(),
                t.getInclusions(),
                t.getExclusions());
    }
}

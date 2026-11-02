package com.securetravels.crm.storefront.dto;

import com.securetravels.crm.trip.Trip;

import java.math.BigDecimal;
import java.util.UUID;

/** Public catalogue card — no internal CRM notes. */
public record StorefrontTripCard(
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
        String metaDescription
) {
    public static StorefrontTripCard from(Trip t) {
        return new StorefrontTripCard(
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
                t.getMetaDescription());
    }
}

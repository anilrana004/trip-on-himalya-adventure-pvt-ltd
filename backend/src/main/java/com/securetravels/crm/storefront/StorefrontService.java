package com.securetravels.crm.storefront;

import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.storefront.dto.StorefrontTripCard;
import com.securetravels.crm.storefront.dto.StorefrontTripDetail;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
public class StorefrontService {

    private final TripRepository trips;

    public StorefrontService(TripRepository trips) {
        this.trips = trips;
    }

    @Transactional(readOnly = true)
    public List<StorefrontTripCard> listActive(String category, String q) {
        Trip.Category cat = parseCategory(category);
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);

        return trips.findAllByActiveTrueOrderByNameAsc().stream()
                .filter(t -> cat == null || t.getCategory() == cat)
                .filter(t -> needle.isEmpty()
                        || t.getName().toLowerCase(Locale.ROOT).contains(needle)
                        || t.getSlug().toLowerCase(Locale.ROOT).contains(needle))
                .map(StorefrontTripCard::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public StorefrontTripDetail getBySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new NotFoundException("Trek not found");
        }
        Trip trip = trips.findBySlug(slug.trim().toLowerCase(Locale.ROOT))
                .or(() -> trips.findBySlug(slug.trim()))
                .filter(Trip::isActive)
                .orElseThrow(() -> new NotFoundException("Trek not found"));
        return StorefrontTripDetail.from(trip);
    }

    private static Trip.Category parseCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Trip.Category.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new com.securetravels.crm.common.exception.BadRequestException(
                    "category must be one of " + Arrays.toString(Trip.Category.values()));
        }
    }
}

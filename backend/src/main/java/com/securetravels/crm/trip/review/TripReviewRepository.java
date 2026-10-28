package com.securetravels.crm.trip.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripReviewRepository extends JpaRepository<TripReview, UUID> {

    List<TripReview> findTop200ByOrderByCreatedAtDesc();

    boolean existsByBookingId(UUID bookingId);
}

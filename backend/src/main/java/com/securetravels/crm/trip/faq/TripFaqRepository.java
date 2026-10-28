package com.securetravels.crm.trip.faq;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripFaqRepository extends JpaRepository<TripFaq, UUID> {

    List<TripFaq> findByTripIdOrderByCreatedAtAsc(UUID tripId);

    List<TripFaq> findTop500ByOrderByCreatedAtDesc();
}

package com.securetravels.crm.trip.tag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripTagRepository extends JpaRepository<TripTag, UUID> {

    List<TripTag> findByTripIdOrderByCreatedAtAsc(UUID tripId);

    List<TripTag> findTop800ByOrderByCreatedAtDesc();
}

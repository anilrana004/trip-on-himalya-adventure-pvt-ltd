package com.securetravels.crm.trip.highlight;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripHighlightRepository extends JpaRepository<TripHighlight, UUID> {

    List<TripHighlight> findByTripIdOrderBySortOrderAscCreatedAtAsc(UUID tripId);

    List<TripHighlight> findTop800ByOrderByCreatedAtDesc();
}

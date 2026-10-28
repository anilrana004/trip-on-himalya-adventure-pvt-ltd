package com.securetravels.crm.trip.waypoint;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripWaypointRepository extends JpaRepository<TripWaypoint, UUID> {

    List<TripWaypoint> findByTripIdOrderBySortOrderAscCreatedAtAsc(UUID tripId);

    List<TripWaypoint> findTop1000ByOrderByCreatedAtDesc();
}

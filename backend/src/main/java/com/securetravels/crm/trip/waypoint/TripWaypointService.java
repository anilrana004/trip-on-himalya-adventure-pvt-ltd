package com.securetravels.crm.trip.waypoint;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.trip.waypoint.TripWaypoint.Kind;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TripWaypointService {

    private static final int MAX_POINTS = 24;
    private static final Set<Kind> SINGLES = EnumSet.of(Kind.START, Kind.SUMMIT, Kind.END);
    private static final Set<Role> WRITERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final TripWaypointRepository waypoints;
    private final TripRepository trips;
    private final AuditService auditService;

    public TripWaypointService(TripWaypointRepository waypoints, TripRepository trips, AuditService auditService) {
        this.waypoints = waypoints;
        this.trips = trips;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TripWaypointResponse> list() {
        Map<UUID, String> names = new HashMap<>();
        return waypoints.findTop1000ByOrderByCreatedAtDesc().stream()
                .map(point -> toResponse(point, names))
                .toList();
    }

    @Transactional
    public TripWaypointResponse create(TripWaypointWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        Trip trip = requireTrip(request.tripId());
        List<TripWaypoint> existing = waypoints.findByTripIdOrderBySortOrderAscCreatedAtAsc(trip.getId());
        Kind kind = request.kind();
        assertRoom(existing, null, kind);
        int sort = request.sortOrder() != null ? request.sortOrder() : nextSort(existing);
        TripWaypoint point = new TripWaypoint(trip.getId(), cleanName(request.name()), kind,
                coordinate(request.latitude(), -90, 90, "Latitude"),
                coordinate(request.longitude(), -180, 180, "Longitude"),
                request.altitudeM(), request.dayNumber(), sort);
        point.setCreatedBy(caller.id());
        TripWaypoint saved = waypoints.save(point);
        auditService.record("TRIP_WAYPOINT", saved.getId(), AuditAction.CREATE, "name", null, saved.getName());
        return toResponse(saved, new HashMap<>());
    }

    @Transactional
    public TripWaypointResponse update(UUID id, TripWaypointWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        TripWaypoint point = waypoints.findById(id).orElseThrow(() -> new NotFoundException("Waypoint not found: " + id));
        if (!point.getTripId().equals(request.tripId())) {
            throw new BadRequestException("A point stays on the trek it was plotted for");
        }
        List<TripWaypoint> existing = waypoints.findByTripIdOrderBySortOrderAscCreatedAtAsc(point.getTripId());
        assertRoom(existing, point.getId(), request.kind());
        point.setName(cleanName(request.name()));
        point.setKind(request.kind());
        point.setLatitude(coordinate(request.latitude(), -90, 90, "Latitude"));
        point.setLongitude(coordinate(request.longitude(), -180, 180, "Longitude"));
        point.setAltitudeM(request.altitudeM());
        point.setDayNumber(request.dayNumber());
        if (request.sortOrder() != null) {
            point.setSortOrder(request.sortOrder());
        }
        waypoints.save(point);
        auditService.record("TRIP_WAYPOINT", point.getId(), AuditAction.UPDATE, "name", null, point.getName());
        return toResponse(point, new HashMap<>());
    }

    @Transactional
    public void delete(UUID id, UserPrincipal caller) {
        requireWriter(caller.role());
        TripWaypoint point = waypoints.findById(id).orElseThrow(() -> new NotFoundException("Waypoint not found: " + id));
        waypoints.delete(point);
        auditService.record("TRIP_WAYPOINT", id, AuditAction.DELETE, "name", point.getName(), null);
    }

    private void assertRoom(List<TripWaypoint> existing, UUID self, Kind kind) {
        long others = existing.stream().filter(point -> self == null || !point.getId().equals(self)).count();
        if (others >= MAX_POINTS) {
            throw new BadRequestException("A route holds at most 24 points");
        }
        if (SINGLES.contains(kind)) {
            boolean taken = existing.stream()
                    .anyMatch(point -> point.getKind() == kind && (self == null || !point.getId().equals(self)));
            if (taken) {
                throw new BadRequestException("This trek already has a " + kind.name().toLowerCase() + " point. Edit that one.");
            }
        }
    }

    private static int nextSort(List<TripWaypoint> existing) {
        return existing.stream().mapToInt(TripWaypoint::getSortOrder).max().orElse(0) + 1;
    }

    private TripWaypointResponse toResponse(TripWaypoint point, Map<UUID, String> names) {
        String tripName = names.computeIfAbsent(point.getTripId(),
                id -> trips.findById(id).map(Trip::getName).orElse(null));
        return new TripWaypointResponse(point.getId(), point.getTripId(), tripName, point.getName(), point.getKind(),
                point.getLatitude(), point.getLongitude(), point.getAltitudeM(), point.getDayNumber(),
                point.getSortOrder(), point.getCreatedAt());
    }

    private Trip requireTrip(UUID id) {
        return trips.findById(id).orElseThrow(() -> new NotFoundException("Trek not found: " + id));
    }

    private static String cleanName(String raw) {
        String text = XssSanitizer.text(raw == null ? "" : raw.trim().replaceAll("\\s+", " "));
        if (text == null || text.length() < 2) {
            throw new BadRequestException("A point needs a name");
        }
        if (text.length() > 80) {
            throw new BadRequestException("Keep a point name to 80 characters");
        }
        return text;
    }

    private static BigDecimal coordinate(BigDecimal value, int min, int max, String label) {
        BigDecimal scaled = value.setScale(6, RoundingMode.HALF_UP);
        if (scaled.compareTo(BigDecimal.valueOf(min)) < 0 || scaled.compareTo(BigDecimal.valueOf(max)) > 0) {
            throw new BadRequestException(label + " is out of range");
        }
        return scaled;
    }

    private static void requireWriter(Role role) {
        if (!WRITERS.contains(role)) {
            throw new ForbiddenException("This role (" + role + ") cannot edit trek routes");
        }
    }
}

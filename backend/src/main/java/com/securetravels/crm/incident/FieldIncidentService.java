package com.securetravels.crm.incident;

import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.BookingRepository;
import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ConflictException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.customer.Customer360Repository;
import com.securetravels.crm.incident.dto.CreateIncidentRequest;
import com.securetravels.crm.incident.dto.FieldIncidentResponse;
import com.securetravels.crm.incident.dto.ResolveIncidentRequest;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.trip.BatchRepository;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class FieldIncidentService {

    private static final Logger log = LoggerFactory.getLogger(FieldIncidentService.class);
    private static final Set<Role> STAFF = EnumSet.of(Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO);
    private static final Set<Role> NOTIFY = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final FieldIncidentRepository incidents;
    private final BookingRepository bookings;
    private final BatchRepository batches;
    private final TripRepository trips;
    private final Customer360Repository customers;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final AuditService audit;

    public FieldIncidentService(FieldIncidentRepository incidents, BookingRepository bookings,
                                BatchRepository batches, TripRepository trips,
                                Customer360Repository customers, UserRepository users,
                                NotificationRepository notifications, AuditService audit) {
        this.incidents = incidents;
        this.bookings = bookings;
        this.batches = batches;
        this.trips = trips;
        this.customers = customers;
        this.users = users;
        this.notifications = notifications;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<FieldIncidentResponse> list(FieldIncident.Status status, UserPrincipal caller) {
        requireStaff(caller);
        return incidents.findTop200ByOrderByCreatedAtDesc().stream()
                .filter(row -> status == null || row.getStatus() == status)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FieldIncidentResponse create(CreateIncidentRequest request, UserPrincipal caller) {
        requireStaff(caller);
        Booking booking = bookings.findById(request.bookingId())
                .orElseThrow(() -> new NotFoundException("Booking not found: " + request.bookingId()));
        if (booking.getStatus() != Booking.Status.CONFIRMED && booking.getStatus() != Booking.Status.COMPLETED) {
            throw new BadRequestException("Log an incident on a confirmed or completed booking.");
        }
        LocalDate occurredOn = request.occurredOn() == null ? LocalDate.now() : request.occurredOn();
        if (occurredOn.isAfter(LocalDate.now())) {
            throw new BadRequestException("The incident date cannot be in the future.");
        }
        String summary = XssSanitizer.text(request.summary().trim());
        if (summary.isBlank()) {
            throw new BadRequestException("Describe what happened.");
        }
        FieldIncident saved = incidents.save(new FieldIncident(
                booking.getId(), booking.getBatchId(), request.kind(), summary, occurredOn, caller.id()));
        audit.record("FIELD_INCIDENT", saved.getId(), AuditAction.CREATE, "summary", null, summary);
        notifyManagers(saved, booking);
        return toResponse(saved);
    }

    @Transactional
    public FieldIncidentResponse resolve(UUID id, ResolveIncidentRequest request, UserPrincipal caller) {
        requireStaff(caller);
        FieldIncident incident = incidents.findById(id)
                .orElseThrow(() -> new NotFoundException("Incident not found: " + id));
        if (incident.getStatus() == FieldIncident.Status.RESOLVED) {
            throw new ConflictException("This incident is already resolved.");
        }
        String resolution = XssSanitizer.text(request.resolution().trim());
        if (resolution.isBlank()) {
            throw new BadRequestException("Write how it was resolved.");
        }
        incident.resolve(resolution, caller.id(), Instant.now());
        incidents.save(incident);
        audit.statusChange("FIELD_INCIDENT", incident.getId(), "status", "OPEN", "RESOLVED");
        return toResponse(incident);
    }

    private void notifyManagers(FieldIncident incident, Booking booking) {
        String title = "Field incident on " + booking.getBookingRef();
        String body = incident.getKind().name() + ": " + incident.getSummary();
        int sent = 0;
        for (Role role : NOTIFY) {
            for (User user : users.findAllByRoleOrderByCreatedAtAsc(role)) {
                if (!user.isActive()) continue;
                notifications.save(new Notification(user.getId(), Notification.Channel.IN_APP,
                        title, body, "/operations/incidents"));
                sent++;
            }
        }
        if (sent == 0) {
            log.warn("[incidents] logged {} with no active manager to notify", incident.getId());
        }
    }

    private FieldIncidentResponse toResponse(FieldIncident incident) {
        Booking booking = bookings.findById(incident.getBookingId()).orElse(null);
        var trip = booking == null ? null : trips.findById(booking.getTripId()).orElse(null);
        var batch = incident.getBatchId() == null ? null : batches.findById(incident.getBatchId()).orElse(null);
        String customerName = booking == null || booking.getCustomerId() == null ? null
                : customers.findById(booking.getCustomerId()).map(c -> c.getFullName()).orElse(null);
        String reportedByName = incident.getReportedBy() == null ? null
                : users.findById(incident.getReportedBy()).map(User::getFullName).orElse(null);
        return new FieldIncidentResponse(
                incident.getId(),
                incident.getBookingId(),
                booking == null ? null : booking.getBookingRef(),
                customerName,
                booking == null ? null : booking.getTripId(),
                trip == null ? null : trip.getName(),
                incident.getBatchId(),
                batch == null ? (booking == null ? null : booking.getTravelDate()) : batch.getDepartureDate(),
                incident.getKind(),
                incident.getSummary(),
                incident.getOccurredOn(),
                incident.getStatus(),
                incident.getResolution(),
                reportedByName,
                incident.getCreatedAt(),
                incident.getResolvedAt());
    }

    private static void requireStaff(UserPrincipal caller) {
        if (caller == null || !STAFF.contains(caller.role())) {
            throw new ForbiddenException("Operations staff record field incidents.");
        }
    }
}

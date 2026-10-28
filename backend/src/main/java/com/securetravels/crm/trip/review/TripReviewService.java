package com.securetravels.crm.trip.review;

import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.BookingRepository;
import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ConflictException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.trip.review.TripReview.Status;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class TripReviewService {

    private static final Set<Role> WRITERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final TripReviewRepository reviews;
    private final TripRepository trips;
    private final BookingRepository bookings;
    private final AuditService auditService;

    public TripReviewService(TripReviewRepository reviews, TripRepository trips,
                             BookingRepository bookings, AuditService auditService) {
        this.reviews = reviews;
        this.trips = trips;
        this.bookings = bookings;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TripReviewResponse> list(UserPrincipal caller) {
        boolean staff = WRITERS.contains(caller.role());
        return reviews.findTop200ByOrderByCreatedAtDesc().stream()
                .filter(review -> staff || review.getStatus() == Status.PUBLISHED)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TripReviewResponse create(TripReviewCreateRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        Trip trip = trips.findById(request.tripId())
                .orElseThrow(() -> new NotFoundException("Trek not found: " + request.tripId()));
        if (request.bookingId() != null) {
            Booking booking = bookings.findById(request.bookingId())
                    .orElseThrow(() -> new NotFoundException("Booking not found: " + request.bookingId()));
            if (!trip.getId().equals(booking.getTripId())) {
                throw new BadRequestException("That booking is for a different trek");
            }
            if (reviews.existsByBookingId(request.bookingId())) {
                throw new ConflictException("This booking already has a review");
            }
        }
        String name = XssSanitizer.text(request.guestName().trim());
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Guest name is required");
        }
        TripReview review = new TripReview(trip.getId(), name, request.rating(), Status.PENDING);
        review.setBookingId(request.bookingId());
        if (request.body() != null && !request.body().isBlank()) {
            review.setBody(XssSanitizer.text(request.body().trim()));
        }
        review.setCreatedBy(caller.id());
        TripReview saved = reviews.save(review);
        auditService.record("TRIP_REVIEW", saved.getId(), AuditAction.CREATE, "rating", null, String.valueOf(saved.getRating()));
        return toResponse(saved);
    }

    @Transactional
    public TripReviewResponse updateStatus(UUID id, Status status, UserPrincipal caller) {
        requireWriter(caller.role());
        TripReview review = reviews.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found: " + id));
        Status old = review.getStatus();
        if (old != status) {
            review.setStatus(status);
            reviews.save(review);
            auditService.record("TRIP_REVIEW", review.getId(), AuditAction.STATUS_CHANGE, "status", old.name(), status.name());
        }
        return toResponse(review);
    }

    private TripReviewResponse toResponse(TripReview review) {
        String tripName = trips.findById(review.getTripId()).map(Trip::getName).orElse(null);
        return new TripReviewResponse(
                review.getId(), review.getTripId(), tripName, review.getBookingId(),
                review.getGuestName(), review.getRating(), review.getBody(),
                review.getStatus(), review.getCreatedAt());
    }

    private static void requireWriter(Role role) {
        if (!WRITERS.contains(role)) {
            throw new ForbiddenException("This role (" + role + ") cannot moderate reviews");
        }
    }
}

package com.securetravels.crm.customer;

import com.securetravels.crm.automation.zapier.ZapierEventsClient;
import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.BookingRepository;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.notify.EmailNotifier;
import com.securetravels.crm.communications.SendDecision;
import com.securetravels.crm.communications.SendGateService;
import com.securetravels.crm.communications.SendRequest;
import com.securetravels.crm.communications.SubjectType;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.task.Task;
import com.securetravels.crm.task.TaskRepository;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.trip.review.TripReviewRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Post-trip review (+1..+7 days after return) and 90-day re-engage (N2).
 * Guest sends go through {@link SendGateService} (MARKETING consent); staff
 * get a REVIEW task when the send is blocked or no reachable channel exists.
 */
@Component
public class PostTripEngagementSweep {

    private static final Logger log = LoggerFactory.getLogger(PostTripEngagementSweep.class);

    public static final String TAG_REVIEW_SENT = "POST_TRIP_REVIEW_SENT";
    public static final String TAG_REENGAGE_90D = "REENGAGE_90D";
    private static final int REVIEW_WINDOW_DAYS = 7;
    private static final int REENGAGE_AFTER_DAYS = 90;

    private final BookingRepository bookings;
    private final TripRepository trips;
    private final TripReviewRepository reviews;
    private final Customer360Repository customers;
    private final LeadRepository leads;
    private final UserRepository users;
    private final TaskRepository tasks;
    private final NotificationRepository notifications;
    private final EmailNotifier email;
    private final SendGateService sendGate;
    private final ZapierEventsClient zapier;
    private final AppProperties props;
    private final JdbcTemplate jdbc;

    public PostTripEngagementSweep(BookingRepository bookings, TripRepository trips,
                                   TripReviewRepository reviews, Customer360Repository customers,
                                   LeadRepository leads, UserRepository users, TaskRepository tasks,
                                   NotificationRepository notifications, EmailNotifier email,
                                   SendGateService sendGate, ZapierEventsClient zapier,
                                   AppProperties props, JdbcTemplate jdbc) {
        this.bookings = bookings;
        this.trips = trips;
        this.reviews = reviews;
        this.customers = customers;
        this.leads = leads;
        this.users = users;
        this.tasks = tasks;
        this.notifications = notifications;
        this.email = email;
        this.sendGate = sendGate;
        this.zapier = zapier;
        this.props = props;
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 86_400_000, initialDelay = 150_000)
    @Transactional
    public void runSweep() {
        LocalDate today = LocalDate.now();
        int reviews = solicitReviews(today);
        int reengage = solicitReengage(today);
        if (reviews > 0 || reengage > 0) {
            log.info("[post-trip-sweep] reviewSends={} reengageSends={} day={}", reviews, reengage, today);
        }
    }

    private int solicitReviews(LocalDate today) {
        // Return date ≈ travelDate + durationDays. Window: returned yesterday through 7 days ago.
        LocalDate earliestTravel = today.minusDays(REVIEW_WINDOW_DAYS + 30);
        LocalDate latestTravel = today.minusDays(1);
        List<Booking> candidates = bookings.findByStatusAndTravelDateBetween(
                Booking.Status.CONFIRMED, earliestTravel, latestTravel);
        candidates = new java.util.ArrayList<>(candidates);
        candidates.addAll(bookings.findByStatusAndTravelDateBetween(
                Booking.Status.COMPLETED, earliestTravel, latestTravel));

        int sent = 0;
        for (Booking booking : candidates) {
            Trip trip = trips.findById(booking.getTripId()).orElse(null);
            int duration = trip == null ? 1 : Math.max(1, trip.getDurationDays());
            LocalDate returned = booking.getTravelDate().plusDays(duration);
            if (returned.isAfter(today) || returned.isBefore(today.minusDays(REVIEW_WINDOW_DAYS))) {
                continue;
            }
            if (reviews.existsByBookingId(booking.getId())) {
                continue;
            }
            Customer360 customer = customers.findById(booking.getCustomerId()).orElse(null);
            if (customer == null || hasTag(customer, TAG_REVIEW_SENT)) {
                continue;
            }
            boolean queued = queuePostTripReview(booking, trip, customer);
            appendTag(customer.getId(), TAG_REVIEW_SENT);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("bookingId", booking.getId().toString());
            data.put("bookingRef", booking.getBookingRef());
            data.put("customerId", customer.getId().toString());
            data.put("travelDate", booking.getTravelDate().toString());
            data.put("returnedOn", returned.toString());
            zapier.publishAsync("booking.post_trip", data);
            if (!queued) {
                ensureReviewTask(booking, customer);
            }
            sent++;
        }
        return sent;
    }

    private int solicitReengage(LocalDate today) {
        LocalDate cutoff = today.minusDays(REENGAGE_AFTER_DAYS);
        List<UUID> ids = jdbc.query(
                """
                        SELECT id FROM customer360
                         WHERE last_trip_date IS NOT NULL
                           AND last_trip_date <= ?
                           AND NOT (? = ANY(coalesce(offer_tags, ARRAY[]::text[])))
                         LIMIT 200
                        """,
                (rs, rowNum) -> (UUID) rs.getObject("id"),
                cutoff, TAG_REENGAGE_90D);
        int sent = 0;
        for (UUID customerId : ids) {
            Customer360 customer = customers.findById(customerId).orElse(null);
            if (customer == null || hasTag(customer, TAG_REENGAGE_90D)) {
                continue;
            }
            boolean queued = queueReengage(customer);
            appendTag(customerId, TAG_REENGAGE_90D);
            if (queued) {
                sent++;
            }
        }
        return sent;
    }

    private boolean queuePostTripReview(Booking booking, Trip trip, Customer360 customer) {
        String tripName = trip == null ? "your trek" : trip.getName();
        String mobile = preferredMobile(customer);
        if (mobile != null) {
            SendDecision decision = sendGate.request(SendRequest.whatsappTemplate(
                    SubjectType.CUSTOMER,
                    customer.getId(),
                    "POST_TRIP_REVIEW",
                    mobile,
                    List.of(blank(tripName), blank(booking.getBookingRef()), blank(customer.getFullName())),
                    null));
            if (decision.accepted()) {
                return true;
            }
            log.info("[post-trip] WA review blocked booking={} reason={}",
                    booking.getBookingRef(), decision.reason());
        }
        if (customer.getEmail() != null && !customer.getEmail().isBlank()) {
            SendDecision decision = sendGate.request(SendRequest.email(
                    SubjectType.CUSTOMER,
                    customer.getId(),
                    "POST_TRIP_REVIEW",
                    customer.getEmail(),
                    List.of(blank(tripName), blank(booking.getBookingRef()), blank(customer.getFullName())),
                    null));
            if (decision.accepted()) {
                return true;
            }
            log.info("[post-trip] email review blocked booking={} reason={}",
                    booking.getBookingRef(), decision.reason());
        }
        return false;
    }

    private boolean queueReengage(Customer360 customer) {
        String mobile = preferredMobile(customer);
        String tripHint = customer.getSuggestOffer() == null || customer.getSuggestOffer().isBlank()
                ? "your next Himalayan trek"
                : customer.getSuggestOffer();
        if (mobile != null) {
            SendDecision decision = sendGate.request(SendRequest.whatsappTemplate(
                    SubjectType.CUSTOMER,
                    customer.getId(),
                    "POST_TRIP_REVIEW",
                    mobile,
                    List.of(blank(tripHint), "follow-up", blank(customer.getFullName())),
                    null));
            if (decision.accepted()) {
                return true;
            }
        }
        if (customer.getEmail() != null && !customer.getEmail().isBlank()) {
            SendDecision decision = sendGate.request(SendRequest.email(
                    SubjectType.CUSTOMER,
                    customer.getId(),
                    "POST_TRIP_REVIEW",
                    customer.getEmail(),
                    List.of(blank(tripHint), "follow-up", blank(customer.getFullName())),
                    null));
            return decision.accepted();
        }
        return false;
    }

    private void ensureReviewTask(Booking booking, Customer360 customer) {
        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        if (tasks.existsByBookingIdAndTypeAndStatusIn(booking.getId(), Task.Type.REVIEW, open)) {
            return;
        }
        UUID assignee = booking.getCreatedBy();
        if (assignee == null && booking.getLeadId() != null) {
            Lead lead = leads.findById(booking.getLeadId()).orElse(null);
            assignee = lead == null ? null : lead.getOwnerId();
        }
        if (assignee == null) {
            assignee = users.findFirstByRoleOrderByCreatedAtAsc(Role.SALES).map(User::getId)
                    .or(() -> users.findFirstByRoleOrderByCreatedAtAsc(Role.MANAGER).map(User::getId))
                    .orElse(null);
        }
        if (assignee == null) {
            return;
        }
        Instant due = Instant.now().plus(24, ChronoUnit.HOURS);
        Task task = tasks.save(new Task(booking.getLeadId(), assignee, Task.Type.REVIEW, due,
                due.plus(48, ChronoUnit.HOURS)));
        task.setBookingId(booking.getId());
        task.setNotes("POST_TRIP_REVIEW: ask " + customer.getFullName() + " for a review");
        String title = "Ask for review: " + booking.getBookingRef();
        String body = "Could not auto-send POST_TRIP_REVIEW for " + customer.getFullName()
                + " — follow up manually.";
        String link = "/bookings?focus=" + booking.getId();
        notifications.save(new Notification(assignee, Notification.Channel.IN_APP, title, body, link));
        users.findById(assignee).ifPresent(u ->
                email.send(u.getEmail(), title, body + " " + props.getPublicUrl() + link));
    }

    private static String preferredMobile(Customer360 customer) {
        if (customer.getWhatsappNumber() != null && !customer.getWhatsappNumber().isBlank()) {
            return customer.getWhatsappNumber();
        }
        if (customer.getMobileNumber() != null && !customer.getMobileNumber().isBlank()) {
            return customer.getMobileNumber();
        }
        return null;
    }

    private static boolean hasTag(Customer360 customer, String tag) {
        for (String existing : customer.offerTagsCopy()) {
            if (tag.equals(existing)) {
                return true;
            }
        }
        return false;
    }

    private void appendTag(UUID customerId, String tag) {
        jdbc.update("""
                UPDATE customer360
                   SET offer_tags = array_append(coalesce(offer_tags, ARRAY[]::text[]), ?),
                       updated_at = now()
                 WHERE id = ? AND NOT (? = ANY(coalesce(offer_tags, ARRAY[]::text[])))
                """, tag, customerId, tag);
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}

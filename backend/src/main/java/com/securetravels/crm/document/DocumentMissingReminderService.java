package com.securetravels.crm.document;

import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.Traveller;
import com.securetravels.crm.booking.TravellerRepository;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.notify.EmailNotifier;
import com.securetravels.crm.communications.SendDecision;
import com.securetravels.crm.communications.SendGateService;
import com.securetravels.crm.communications.SendRequest;
import com.securetravels.crm.communications.SubjectType;
import com.securetravels.crm.customer.Customer360;
import com.securetravels.crm.customer.Customer360Repository;
import com.securetravels.crm.document.dto.TravellerComplianceResponse;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.task.Task;
import com.securetravels.crm.task.TaskRepository;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Near-departure document chase (AUTOMATION_INVENTORY N1). Creates a deduped
 * CUSTOM task for OPS when any traveller on a CONFIRMED booking is not GREEN,
 * notifies staff, and optionally queues TRANSACTIONAL {@code DOCUMENT_LINK}.
 */
@Service
public class DocumentMissingReminderService {

    private static final Logger log = LoggerFactory.getLogger(DocumentMissingReminderService.class);

    /** Stable latch in {@code tasks.notes} so we never collide with OPS prep. */
    public static final String NOTES_LATCH = "DOC_MISSING";

    private final ComplianceService compliance;
    private final TravellerRepository travellers;
    private final TripRepository trips;
    private final Customer360Repository customers;
    private final TaskRepository tasks;
    private final NotificationRepository notifications;
    private final UserRepository users;
    private final EmailNotifier email;
    private final SendGateService sendGate;
    private final AppProperties props;

    public DocumentMissingReminderService(ComplianceService compliance,
                                          TravellerRepository travellers,
                                          TripRepository trips,
                                          Customer360Repository customers,
                                          TaskRepository tasks,
                                          NotificationRepository notifications,
                                          UserRepository users,
                                          EmailNotifier email,
                                          SendGateService sendGate,
                                          AppProperties props) {
        this.compliance = compliance;
        this.travellers = travellers;
        this.trips = trips;
        this.customers = customers;
        this.tasks = tasks;
        this.notifications = notifications;
        this.users = users;
        this.email = email;
        this.sendGate = sendGate;
        this.props = props;
    }

    @Transactional
    public boolean ensureReminder(Booking booking) {
        List<Traveller> pax = travellers.findByBookingIdOrderByCreatedAtAsc(booking.getId());
        if (pax.isEmpty()) {
            return false;
        }
        int incomplete = 0;
        for (Traveller traveller : pax) {
            TravellerComplianceResponse row = compliance.travellerSummary(traveller.getId());
            if (!"GREEN".equals(row.color())) {
                incomplete++;
            }
        }
        if (incomplete == 0) {
            retireReminders(booking.getId());
            return false;
        }

        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        boolean alreadyOpen = tasks.findByBookingIdAndTypeAndStatusIn(booking.getId(), Task.Type.CUSTOM, open)
                .stream()
                .anyMatch(t -> t.getNotes() != null && t.getNotes().startsWith(NOTES_LATCH));
        if (alreadyOpen) {
            return false;
        }

        User assignee = users.findFirstByRoleOrderByCreatedAtAsc(Role.OPS)
                .or(() -> users.findFirstByRoleOrderByCreatedAtAsc(Role.MANAGER))
                .orElse(null);
        if (assignee == null) {
            log.warn("[doc-missing] no OPS/MANAGER for booking={}", booking.getBookingRef());
            return false;
        }

        Instant due = Instant.now().plus(24, ChronoUnit.HOURS);
        Task task = tasks.save(new Task(booking.getLeadId(), assignee.getId(), Task.Type.CUSTOM, due,
                due.plus(48, ChronoUnit.HOURS)));
        task.setBookingId(booking.getId());
        task.setNotes(NOTES_LATCH + ": " + incomplete + " traveller(s) not GREEN before "
                + booking.getTravelDate());

        String title = "Documents missing: " + booking.getBookingRef();
        String body = incomplete + " traveller(s) still need verified docs for "
                + booking.getBookingRef() + " (travel " + booking.getTravelDate() + ").";
        String link = "/bookings?focus=" + booking.getId();
        notifications.save(new Notification(assignee.getId(), Notification.Channel.IN_APP, title, body, link));
        email.send(assignee.getEmail(), title, body + " " + props.getPublicUrl() + link);

        maybeSendDocumentLink(booking);
        log.info("[doc-missing] task created booking={} incomplete={} assignee={}",
                booking.getBookingRef(), incomplete, assignee.getId());
        return true;
    }

    /** Cancel open DOC_MISSING tasks when the booking's travellers are all GREEN. */
    @Transactional
    public void retireReminders(UUID bookingId) {
        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        for (Task t : tasks.findByBookingIdAndTypeAndStatusIn(bookingId, Task.Type.CUSTOM, open)) {
            if (t.getNotes() != null && t.getNotes().startsWith(NOTES_LATCH)) {
                t.cancel();
            }
        }
    }

    /**
     * After a checklist change: if every traveller on the booking is GREEN,
     * retire the chase task.
     */
    @Transactional
    public void retireIfComplete(UUID bookingId) {
        List<Traveller> pax = travellers.findByBookingIdOrderByCreatedAtAsc(bookingId);
        if (pax.isEmpty()) {
            return;
        }
        for (Traveller traveller : pax) {
            if (!"GREEN".equals(compliance.travellerSummary(traveller.getId()).color())) {
                return;
            }
        }
        retireReminders(bookingId);
    }

    private void maybeSendDocumentLink(Booking booking) {
        Customer360 customer = customers.findById(booking.getCustomerId()).orElse(null);
        if (customer == null) {
            return;
        }
        String mobile = customer.getWhatsappNumber() != null && !customer.getWhatsappNumber().isBlank()
                ? customer.getWhatsappNumber()
                : customer.getMobileNumber();
        if (mobile == null || mobile.isBlank()) {
            return;
        }
        Trip trip = trips.findById(booking.getTripId()).orElse(null);
        String tripName = trip == null ? "your trek" : trip.getName();
        String link = props.getPublicUrl() + "/bookings?focus=" + booking.getId();
        try {
            SendDecision decision = sendGate.request(SendRequest.whatsappTemplate(
                    SubjectType.BOOKING,
                    booking.getId(),
                    "DOCUMENT_LINK",
                    mobile,
                    List.of(
                            blank(tripName),
                            blank(booking.getBookingRef()),
                            blank(customer.getFullName()),
                            booking.getTravelDate() == null ? "-" : booking.getTravelDate().toString()),
                    null));
            if (!decision.accepted()) {
                log.info("[doc-missing] DOCUMENT_LINK not queued booking={} reason={}",
                        booking.getBookingRef(), decision.reason());
            }
        } catch (RuntimeException e) {
            log.warn("[doc-missing] DOCUMENT_LINK failed booking={}: {}", booking.getBookingRef(), e.getMessage());
        }
        // link kept for ops desk; template body uses booking fields only
        if (log.isDebugEnabled()) {
            log.debug("[doc-missing] guest upload hint {}", link);
        }
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}

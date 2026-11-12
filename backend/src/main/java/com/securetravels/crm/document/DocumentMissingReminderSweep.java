package com.securetravels.crm.document;

import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.BookingRepository;
import com.securetravels.crm.common.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Daily near-departure document chase (N1). Mirrors {@code PaymentSweep}:
 * scan CONFIRMED bookings in the lead window, ensure a staff task when
 * compliance is not GREEN.
 */
@Component
public class DocumentMissingReminderSweep {

    private static final Logger log = LoggerFactory.getLogger(DocumentMissingReminderSweep.class);

    private final BookingRepository bookings;
    private final DocumentMissingReminderService reminders;
    private final AppProperties props;

    public DocumentMissingReminderSweep(BookingRepository bookings,
                                        DocumentMissingReminderService reminders,
                                        AppProperties props) {
        this.bookings = bookings;
        this.reminders = reminders;
        this.props = props;
    }

    @Scheduled(fixedDelay = 86_400_000, initialDelay = 120_000)
    @Transactional
    public void runSweep() {
        int leadDays = Math.max(1, props.getCompliance().getDocReminderLeadDays());
        LocalDate today = LocalDate.now();
        LocalDate to = today.plusDays(leadDays);
        List<Booking> candidates = bookings.findByStatusAndTravelDateBetween(
                Booking.Status.CONFIRMED, today, to);
        int created = 0;
        for (Booking booking : candidates) {
            if (reminders.ensureReminder(booking)) {
                created++;
            }
        }
        if (created > 0 || !candidates.isEmpty()) {
            log.info("[doc-missing-sweep] candidates={} tasksCreated={} window={}..{}",
                    candidates.size(), created, today, to);
        }
    }
}

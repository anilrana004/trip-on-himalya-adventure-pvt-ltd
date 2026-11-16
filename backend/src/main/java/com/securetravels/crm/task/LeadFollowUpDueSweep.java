package com.securetravels.crm.task;

import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.notification.NotificationWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Fires an in-app due reminder once per lead follow-up occurrence when
 * {@code follow_up_at} is reached. Complements the 08:30 morning digest.
 */
@Component
public class LeadFollowUpDueSweep {

    private static final Logger log = LoggerFactory.getLogger(LeadFollowUpDueSweep.class);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter WHEN = DateTimeFormatter
            .ofPattern("d MMM, h:mm a")
            .withZone(IST);

    private final LeadRepository leads;
    private final NotificationWriter notifications;

    public LeadFollowUpDueSweep(LeadRepository leads, NotificationWriter notifications) {
        this.leads = leads;
        this.notifications = notifications;
    }

    @Scheduled(cron = "0 */2 * * * *", zone = "Asia/Kolkata")
    @Transactional
    public void remindDueFollowUps() {
        Instant now = Instant.now();
        List<Lead> due = leads.findDueForReminder(now);
        int sent = 0;
        for (Lead lead : due) {
            if (lead.getOwnerId() == null || lead.getFollowUpAt() == null) continue;
            String when = WHEN.format(lead.getFollowUpAt());
            String notes = lead.getFollowUpNotes() == null || lead.getFollowUpNotes().isBlank()
                    ? ""
                    : " Notes: " + lead.getFollowUpNotes().trim();
            String dedupe = "lead-fu-due:" + lead.getId() + ":" + lead.getFollowUpAt().getEpochSecond();
            boolean wrote = notifications.saveOnce(
                    lead.getOwnerId(),
                    "Follow-up due: " + lead.getCustomerName(),
                    lead.getCustomerName() + " · scheduled " + when + "." + notes
                            + " Open the lead to call, reschedule, or mark completed.",
                    "/leads?focus=" + lead.getId() + "&followUp=1",
                    dedupe);
            if (wrote) {
                lead.setFollowUpNotifiedAt(now);
                leads.save(lead);
                sent++;
            } else {
                // Already notified (unique key) — still latch so the sweep stops retrying.
                lead.setFollowUpNotifiedAt(now);
                leads.save(lead);
            }
        }
        if (sent > 0 || !due.isEmpty()) {
            log.info("[lead-follow-up-due] candidates={} notified={}", due.size(), sent);
        }
    }
}

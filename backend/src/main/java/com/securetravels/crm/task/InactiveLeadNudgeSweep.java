package com.securetravels.crm.task;

import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Morning re-engagement: NEW / INTERESTED leads with no recent contact get a
 * nudge notification (and a CALLBACK task if none is open). Caps per run.
 */
@Component
public class InactiveLeadNudgeSweep {

    private static final Logger log = LoggerFactory.getLogger(InactiveLeadNudgeSweep.class);
    private static final int MAX_PER_RUN = 40;

    private final LeadRepository leads;
    private final TaskRepository tasks;
    private final NotificationRepository notifications;
    private final FollowUpAutomation automation;

    public InactiveLeadNudgeSweep(LeadRepository leads, TaskRepository tasks,
                                  NotificationRepository notifications,
                                  FollowUpAutomation automation) {
        this.leads = leads;
        this.tasks = tasks;
        this.notifications = notifications;
        this.automation = automation;
    }

    /** 09:15 Asia/Kolkata-ish via server local zone — once a day. */
    @Scheduled(cron = "0 15 9 * * *")
    @Transactional
    public void nudgeQuietLeads() {
        Instant now = Instant.now();
        List<Lead> quiet = leads.findInactiveForNudge(
                EnumSet.of(Lead.Status.NEW, Lead.Status.INTERESTED),
                now.minus(24, ChronoUnit.HOURS),
                now.minus(6, ChronoUnit.HOURS));
        int nudged = 0;
        Set<UUID> ownersHit = new HashSet<>();
        for (Lead lead : quiet) {
            if (nudged >= MAX_PER_RUN) break;
            List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
            boolean hasOpenWork = !tasks.findByLeadIdAndStatusIn(lead.getId(), open).isEmpty();
            if (!hasOpenWork) {
                automation.onCallOutcome(lead, com.securetravels.crm.lead.LeadCallAttempt.Outcome.CALLBACK);
            }
            notifications.save(new Notification(
                    lead.getOwnerId(),
                    Notification.Channel.IN_APP,
                    "Quiet lead needs a touch",
                    lead.getCustomerName() + " (" + lead.getStatus() + ", " + lead.getHeat()
                            + ") has no recent contact. Call or update the stage.",
                    "/leads/" + lead.getId()));
            ownersHit.add(lead.getOwnerId());
            nudged++;
        }
        if (nudged > 0) {
            log.info("[inactive-nudge] nudged={} owners={}", nudged, ownersHit.size());
        }
    }
}

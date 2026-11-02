package com.securetravels.crm.task;

import com.securetravels.crm.task.Task.Status;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Every 5 minutes:
 *   1. PENDING past due_at → OVERDUE + remind sales
 *   2. PENDING due within 60 minutes → due-soon reminder (once per task window)
 *   3. still-open past sla_deadline → escalate to managers (one shot)
 */
@Component
public class FollowUpSweep {

    private static final Logger log = LoggerFactory.getLogger(FollowUpSweep.class);
    private static final long REMIND_COOLDOWN_MINUTES = 55;

    private final TaskRepository tasks;
    private final FollowUpAutomation automation;

    public FollowUpSweep(TaskRepository tasks, FollowUpAutomation automation) {
        this.tasks = tasks;
        this.automation = automation;
    }

    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    @Transactional
    public void runSweep() {
        Instant now = Instant.now();
        int overdue = 0;
        int reminded = 0;
        int escalated = 0;

        for (Task t : tasks.findByStatusAndDueAtBefore(Status.PENDING, now)) {
            t.markOverdue(now);
            overdue++;
            if (shouldRemind(t, now)) {
                automation.remindAssignee(t,
                        "Overdue: " + human(t.getType()),
                        "This follow-up is past due. Call the customer now so the SLA does not escalate.");
                reminded++;
            }
        }

        Instant soon = now.plus(60, ChronoUnit.MINUTES);
        for (Task t : tasks.findByStatusAndDueAtBetween(Status.PENDING, now, soon)) {
            if (!shouldRemind(t, now)) continue;
            automation.remindAssignee(t,
                    "Due soon: " + human(t.getType()),
                    "This follow-up is due within the next hour. Complete it on time.");
            reminded++;
        }

        for (Task t : tasks.findByStatusInAndSlaDeadlineBefore(List.of(Status.PENDING, Status.OVERDUE), now)) {
            if (t.getEscalatedAt() != null || t.getStatus() == Status.COMPLETED) continue;
            automation.escalateToManager(t, "SLA deadline missed (due " + t.getDueAt() + ")");
            escalated++;
        }

        if (overdue > 0 || reminded > 0 || escalated > 0) {
            log.info("[sweep] markedOverdue={} reminded={} escalated={}", overdue, reminded, escalated);
        }
    }

    private static boolean shouldRemind(Task t, Instant now) {
        Instant last = t.getLastRemindedAt();
        if (last == null) return true;
        return last.isBefore(now.minus(REMIND_COOLDOWN_MINUTES, ChronoUnit.MINUTES));
    }

    private static String human(Task.Type type) {
        return switch (type) {
            case INITIAL_CALL -> "first call (5 min)";
            case CALLBACK -> "callback";
            case FOLLOW_UP_1D -> "follow-up 1";
            case FOLLOW_UP_3D -> "follow-up 2";
            case FOLLOW_UP_8D -> "follow-up 3";
            case FOLLOW_UP_15D -> "follow-up 4";
            case QUOTATION -> "quotation follow-up";
            default -> type.name();
        };
    }
}

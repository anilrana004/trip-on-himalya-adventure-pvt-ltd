package com.securetravels.crm.task;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.notify.EmailNotifier;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

/**
 * Sales follow-up system:
 *   • New lead              → INITIAL_CALL due +5 min (SLA 15m for ads/web/storefront, else 1h)
 *   • Lead → INTERESTED     → FU1 tomorrow, FU2 +2d, FU3 +5d, FU4 +7d (from mark-interested time)
 *   • Lead → QUOTATION_SENT → quotation task +2 days
 * Each task notifies the assignee in-app + email. SLA breach escalates to managers.
 */
@Service
public class FollowUpAutomation {

    private static final Logger log = LoggerFactory.getLogger(FollowUpAutomation.class);
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final TaskRepository tasks;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final EmailNotifier email;
    private final String appUrl;

    public FollowUpAutomation(TaskRepository tasks, UserRepository users,
                              NotificationRepository notifications, EmailNotifier email,
                              AppProperties props) {
        this.tasks = tasks;
        this.users = users;
        this.notifications = notifications;
        this.email = email;
        String configured = props.getPublicUrl() == null ? "" : props.getPublicUrl().trim();
        this.appUrl = configured.endsWith("/") ? configured.substring(0, configured.length() - 1) : configured;
    }

    @Transactional
    public void onLeadCreated(UUID leadId, UUID assigneeId) {
        onLeadCreated(leadId, assigneeId, null);
    }

    @Transactional
    public void onLeadCreated(UUID leadId, UUID assigneeId, Lead.Source source) {
        Instant dueAt = Instant.now().plus(5, ChronoUnit.MINUTES);
        Instant sla = isFastTrack(source)
                ? Instant.now().plus(15, ChronoUnit.MINUTES)
                : dueAt.plus(1, ChronoUnit.HOURS);
        scheduleOne(leadId, assigneeId, Task.Type.INITIAL_CALL, dueAt, sla,
                "Call within 5 minutes",
                "New lead assigned to you — call the customer now.");
    }

    /** Move open follow-up tasks when a manager reassigns the lead owner. */
    @Transactional
    public void reassignOpenTasks(UUID leadId, UUID newAssigneeId) {
        if (leadId == null || newAssigneeId == null) return;
        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        for (Task task : tasks.findByLeadIdAndStatusIn(leadId, open)) {
            task.setAssigneeId(newAssigneeId);
        }
    }

    /**
     * Cadence starts when sales marks INTERESTED (not from lead createdAt), so a
     * late status change does not create already-overdue follow-ups.
     */
    @Transactional
    public void onInterested(Lead lead) {
        cancelOpenFollowUps(lead.getId());
        Instant base = Instant.now();
        int[] days = {1, 3, 8, 15};
        String[] titles = {
                "Follow-up 1 — tomorrow",
                "Follow-up 2 — 2 days later",
                "Follow-up 3 — 5 days later",
                "Follow-up 4 — 7 days later"
        };
        Instant firstDue = null;
        for (int i = 0; i < days.length; i++) {
            Instant due = base.plus(days[i], ChronoUnit.DAYS);
            if (firstDue == null) firstDue = due;
            scheduleOne(lead.getId(), lead.getOwnerId(), Task.Type.valueOf("FOLLOW_UP_" + days[i] + "D"),
                    due, 24, titles[i],
                    titles[i] + " for " + lead.getCustomerName() + ".");
        }
        if (firstDue != null) {
            lead.setFollowUpDate(LocalDate.ofInstant(firstDue, ZONE));
        }
    }

    @Transactional
    public void onQuotationSent(Lead lead) {
        cancelOpen(lead.getId(), Task.Type.QUOTATION);
        Instant due = Instant.now().plus(2, ChronoUnit.DAYS);
        scheduleOne(lead.getId(), lead.getOwnerId(), Task.Type.QUOTATION,
                due, 24, "Quotation follow-up",
                "Send / confirm the quotation for " + lead.getCustomerName() + ".");
        lead.setFollowUpDate(LocalDate.ofInstant(due, ZONE));
    }

    @Transactional
    public void onBooked(Lead lead) {
        cancelAllOpen(lead.getId());
        lead.setFollowUpDate(null);
        String title = "Booking confirmed — follow-up closed";
        String body = "No further follow-up needed for " + lead.getCustomerName() + ".";
        notifications.save(new Notification(lead.getOwnerId(), Notification.Channel.IN_APP, title, body,
                leadPath(lead.getId())));
        log.info("[automation] lead={} booked; outstanding follow-ups cancelled", lead.getId());
    }

    /** Remind the assignee that a task is due soon or already overdue. */
    @Transactional
    public void remindAssignee(Task task, String title, String body) {
        notifications.save(new Notification(task.getAssigneeId(), Notification.Channel.IN_APP, title, body,
                leadPath(task.getLeadId())));
        users.findById(task.getAssigneeId()).ifPresent(user ->
                email.send(user.getEmail(), title, body + " " + appUrl + leadPath(task.getLeadId())));
        task.markReminded(Instant.now());
        log.info("[automation] reminded assignee={} task={} type={}", task.getAssigneeId(), task.getId(), task.getType());
    }

    /** Escalation support used by the overdue sweep (SLA breach → managers). */
    @Transactional
    public void escalateToManager(Task task, String reason) {
        List<User> managers = users.findByIsActiveTrueAndRoleIn(
                EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO));
        if (managers.isEmpty()) {
            users.findFirstByRoleOrderByCreatedAtAsc(Role.MANAGER).ifPresent(managers::add);
        }
        task.escalate(Instant.now());
        String title = "SLA breach: " + humanType(task.getType());
        String body = humanType(task.getType()) + " task breached its SLA. " + reason
                + " (due " + task.getDueAt() + ")";
        if (managers.isEmpty()) {
            notifications.save(new Notification(task.getAssigneeId(), Notification.Channel.IN_APP, title, body,
                    leadPath(task.getLeadId())));
        } else {
            for (User manager : managers) {
                notifications.save(new Notification(manager.getId(), Notification.Channel.IN_APP, title, body,
                        leadPath(task.getLeadId())));
                email.send(manager.getEmail(), title, reason + " " + appUrl + leadPath(task.getLeadId()));
            }
        }
        // Also nudge the sales owner so they see the breach on their bell.
        notifications.save(new Notification(task.getAssigneeId(), Notification.Channel.IN_APP,
                "Your follow-up missed SLA", body, leadPath(task.getLeadId())));
        log.info("[automation] escalated task={} managers={} reason={}", task.getId(), managers.size(), reason);
    }

    private void cancelOpenFollowUps(UUID leadId) {
        for (Task.Type t : List.of(Task.Type.FOLLOW_UP_1D, Task.Type.FOLLOW_UP_3D,
                Task.Type.FOLLOW_UP_8D, Task.Type.FOLLOW_UP_15D)) {
            cancelOpen(leadId, t);
        }
    }

    private void cancelOpen(UUID leadId, Task.Type type) {
        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        for (Task existing : tasks.findByLeadIdAndTypeAndStatusIn(leadId, type, open)) {
            existing.cancel();
        }
    }

    private void cancelAllOpen(UUID leadId) {
        List<Task.Status> open = List.of(Task.Status.PENDING, Task.Status.OVERDUE);
        for (Task existing : tasks.findByLeadIdAndStatusIn(leadId, open)) {
            existing.cancel();
        }
    }

    private void scheduleOne(UUID leadId, UUID assigneeId, Task.Type type, Instant dueAt,
                             int slaHours, String title, String body) {
        scheduleOne(leadId, assigneeId, type, dueAt, dueAt.plus(slaHours, ChronoUnit.HOURS), title, body);
    }

    private void scheduleOne(UUID leadId, UUID assigneeId, Task.Type type, Instant dueAt,
                             Instant slaDeadline, String title, String body) {
        Task task = tasks.save(new Task(leadId, assigneeId, type, dueAt, slaDeadline));
        notifications.save(new Notification(assigneeId, Notification.Channel.IN_APP, title, body,
                leadPath(leadId)));
        users.findById(assigneeId).ifPresent(user ->
                email.send(user.getEmail(), title, body + " " + appUrl + leadPath(leadId)));
        log.info("[automation] lead={} type={} assignee={} dueAt={}", leadId, type, assigneeId, dueAt);
    }

    private static boolean isFastTrack(Lead.Source source) {
        return source == Lead.Source.FACEBOOK_ADS
                || source == Lead.Source.INSTAGRAM
                || source == Lead.Source.GOOGLE_ADS
                || source == Lead.Source.WEBSITE
                || source == Lead.Source.STOREFRONT;
    }

    private String humanType(Task.Type type) {
        return switch (type) {
            case INITIAL_CALL -> "first call";
            case QUOTATION -> "quotation follow-up";
            case PAYMENT_REMINDER -> "payment reminder";
            case OPS -> "ops handoff";
            default -> "follow-up (" + type + ")";
        };
    }

    private String leadPath(UUID leadId) {
        return "/leads/" + leadId;
    }
}

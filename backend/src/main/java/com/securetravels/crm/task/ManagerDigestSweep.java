package com.securetravels.crm.task;

import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;

/**
 * Morning SLA digest for managers/admins: overdue tasks, hot uncalled, SLA breaches.
 */
@Component
public class ManagerDigestSweep {

    private static final Logger log = LoggerFactory.getLogger(ManagerDigestSweep.class);

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final NotificationRepository notifications;

    public ManagerDigestSweep(JdbcTemplate jdbc, UserRepository users, NotificationRepository notifications) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifications = notifications;
    }

    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void sendMorningDigest() {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT
                  (SELECT count(*) FROM tasks WHERE status = 'OVERDUE') AS overdue,
                  (SELECT count(*) FROM tasks
                        WHERE status IN ('PENDING','OVERDUE')
                          AND sla_deadline IS NOT NULL AND sla_deadline < now()) AS sla_breached,
                  (SELECT count(*) FROM leads
                        WHERE status = 'NEW' AND last_contacted_at IS NULL
                          AND source IN ('FACEBOOK_ADS','INSTAGRAM','GOOGLE_ADS','WEBSITE','STOREFRONT')) AS hot_uncalled,
                  (SELECT count(*) FROM tasks
                        WHERE type = 'INITIAL_CALL' AND status IN ('PENDING','OVERDUE')
                          AND due_at < now()) AS first_call_late
                """);
        long overdue = ((Number) row.get("overdue")).longValue();
        long sla = ((Number) row.get("sla_breached")).longValue();
        long hot = ((Number) row.get("hot_uncalled")).longValue();
        long firstLate = ((Number) row.get("first_call_late")).longValue();
        if (overdue == 0 && sla == 0 && hot == 0 && firstLate == 0) {
            return;
        }
        String title = "Morning sales SLA digest";
        String body = "Overdue tasks: " + overdue
                + " · SLA breached: " + sla
                + " · Hot uncalled ads/web: " + hot
                + " · First call late: " + firstLate
                + ". Open Automations / Tasks to clear the queue.";
        List<User> managers = users.findByIsActiveTrueAndRoleIn(
                EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO));
        for (User manager : managers) {
            notifications.save(new Notification(manager.getId(), Notification.Channel.IN_APP,
                    title, body, "/automations"));
        }
        log.info("[manager-digest] notified={} overdue={} sla={} hot={} firstLate={}",
                managers.size(), overdue, sla, hot, firstLate);
    }
}

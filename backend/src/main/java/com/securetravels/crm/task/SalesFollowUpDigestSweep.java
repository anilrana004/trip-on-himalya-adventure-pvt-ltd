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
import java.util.UUID;

/**
 * Morning digest for every active sales login: overdue + due-today follow-ups
 * on their own book. Managers also get a team roll-up.
 */
@Component
public class SalesFollowUpDigestSweep {

    private static final Logger log = LoggerFactory.getLogger(SalesFollowUpDigestSweep.class);

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final NotificationRepository notifications;

    public SalesFollowUpDigestSweep(JdbcTemplate jdbc, UserRepository users,
                                    NotificationRepository notifications) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifications = notifications;
    }

    /** 08:30 Asia/Kolkata — before the manager SLA digest at 09:00. */
    @Scheduled(cron = "0 30 8 * * *", zone = "Asia/Kolkata")
    @Transactional
    public void sendSalesFollowUpDigests() {
        List<User> sales = users.findByIsActiveTrueAndRoleIn(EnumSet.of(Role.SALES));
        int notified = 0;
        for (User user : sales) {
            Map<String, Object> row = countsForOwner(user.getId());
            long overdue = ((Number) row.get("overdue")).longValue();
            long dueToday = ((Number) row.get("due_today")).longValue();
            if (overdue == 0 && dueToday == 0) continue;
            String title = "Today's follow-ups";
            String body = buildBody(overdue, dueToday, null);
            notifications.save(new Notification(user.getId(), Notification.Channel.IN_APP,
                    title, body, "/follow-ups"));
            notified++;
        }

        Map<String, Object> team = countsForOwner(null);
        long teamOverdue = ((Number) team.get("overdue")).longValue();
        long teamDue = ((Number) team.get("due_today")).longValue();
        if (teamOverdue > 0 || teamDue > 0) {
            String top = topOwnersNeedingCalls();
            String title = "Team follow-ups today";
            String body = buildBody(teamOverdue, teamDue, top);
            List<User> managers = users.findByIsActiveTrueAndRoleIn(
                    EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO));
            for (User manager : managers) {
                notifications.save(new Notification(manager.getId(), Notification.Channel.IN_APP,
                        title, body, "/follow-ups"));
            }
            log.info("[sales-follow-up-digest] managers={} teamOverdue={} teamDueToday={}",
                    managers.size(), teamOverdue, teamDue);
        }
        log.info("[sales-follow-up-digest] salesNotified={}", notified);
    }

    private Map<String, Object> countsForOwner(UUID ownerId) {
        if (ownerId == null) {
            return jdbc.queryForMap("""
                    SELECT
                      (SELECT count(*) FROM leads
                            WHERE deleted_at IS NULL
                              AND follow_up_at IS NOT NULL
                              AND follow_up_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                    AT TIME ZONE 'Asia/Kolkata'
                              AND status NOT IN ('LOST', 'BOOKING_CONFIRMED')) AS overdue,
                      (SELECT count(*) FROM leads
                            WHERE deleted_at IS NULL
                              AND follow_up_at IS NOT NULL
                              AND follow_up_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                    AT TIME ZONE 'Asia/Kolkata'
                              AND follow_up_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                    + interval '1 day') AT TIME ZONE 'Asia/Kolkata'
                              AND status NOT IN ('LOST', 'BOOKING_CONFIRMED')) AS due_today
                    """);
        }
        return jdbc.queryForMap("""
                SELECT
                  (SELECT count(*) FROM leads
                        WHERE deleted_at IS NULL
                          AND owner_id = ?
                          AND follow_up_at IS NOT NULL
                          AND follow_up_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                AT TIME ZONE 'Asia/Kolkata'
                          AND status NOT IN ('LOST', 'BOOKING_CONFIRMED')) AS overdue,
                  (SELECT count(*) FROM leads
                        WHERE deleted_at IS NULL
                          AND owner_id = ?
                          AND follow_up_at IS NOT NULL
                          AND follow_up_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                AT TIME ZONE 'Asia/Kolkata'
                          AND follow_up_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                                + interval '1 day') AT TIME ZONE 'Asia/Kolkata'
                          AND status NOT IN ('LOST', 'BOOKING_CONFIRMED')) AS due_today
                """, ownerId, ownerId);
    }

    private String topOwnersNeedingCalls() {
        List<Map<String, Object>> worst = jdbc.queryForList("""
                SELECT u.full_name,
                       count(*) AS pending
                  FROM leads l
                  JOIN users u ON u.id = l.owner_id
                 WHERE l.follow_up_at IS NOT NULL
                   AND l.follow_up_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                         + interval '1 day') AT TIME ZONE 'Asia/Kolkata'
                   AND l.status NOT IN ('LOST', 'BOOKING_CONFIRMED')
                   AND u.role = 'SALES' AND u.is_active = TRUE
                 GROUP BY u.full_name
                 ORDER BY pending DESC, u.full_name
                 LIMIT 3
                """);
        StringBuilder top = new StringBuilder();
        for (Map<String, Object> w : worst) {
            long n = ((Number) w.get("pending")).longValue();
            if (n <= 0) continue;
            if (top.length() > 0) top.append(", ");
            top.append(w.get("full_name")).append(" (").append(n).append(")");
        }
        return top.length() == 0 ? null : top.toString();
    }

    private static String buildBody(long overdue, long dueToday, String coaching) {
        String body = "Overdue: " + overdue + " · Due today: " + dueToday
                + ". Open Today's Follow-Ups to clear the queue.";
        if (coaching != null && !coaching.isBlank()) {
            body = body + " Needs coaching: " + coaching + ".";
        }
        return body;
    }
}

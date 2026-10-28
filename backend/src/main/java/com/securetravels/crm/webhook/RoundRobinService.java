package com.securetravels.crm.webhook;

import com.securetravels.crm.common.exception.ServiceUnavailableException;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Auto-assignment for Meta / website / inbound leads.
 *
 * <p>Same-trek stickiness first: if an open lead for the same trip (or same
 * normalized destination / Meta campaign) already sits with an active sales
 * user, keep routing there so a burst of five Kedarkantha enquiries does not
 * spray across the whole floor. Otherwise least-recently-assigned round-robin
 * for the month, falling back to the first active manager.
 */
@Service
public class RoundRobinService {

    private static final int STICKY_DAYS = 7;

    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public RoundRobinService(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    /**
     * Prefer sticky owner for the same trek/campaign; otherwise rotate sales.
     * Sticky hits do not advance the RR cursor so unrelated leads keep fair rotation.
     */
    public User assignForEnquiry(UUID tripId, String destination, String campaignId) {
        User sticky = findStickyOwner(tripId, normalizeDestination(destination), blankToNull(campaignId));
        if (sticky != null) {
            return sticky;
        }
        return pickNextSalesUser();
    }

    public User pickNextSalesUser() {
        LocalDate month = LocalDate.now()
                .withDayOfMonth(1);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT u.id FROM users u
                LEFT JOIN assignment_state s
                       ON s.user_id = u.id AND s.month = CAST(? AS date)
                WHERE u.role = 'SALES' AND u.is_active = true
                ORDER BY COALESCE(s.last_assigned_at, to_timestamp(0)) ASC,
                         u.created_at ASC, u.id ASC
                LIMIT 1
                """, month);

        if (!rows.isEmpty()) {
            UUID id = (UUID) rows.get(0).get("id");
            upsertAssignment(id, month);
            return users.findById(id).orElse(null);
        }

        User manager = users.findFirstByRoleOrderByCreatedAtAsc(Role.MANAGER)
                .filter(User::isActive)
                .orElse(null);
        if (manager == null) {
            throw new ServiceUnavailableException("No sales or manager user is available to own this lead.");
        }
        return manager;
    }

    private User findStickyOwner(UUID tripId, String destination, String campaignId) {
        if (tripId == null && destination == null && campaignId == null) {
            return null;
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT l.owner_id AS owner_id
                FROM leads l
                JOIN users u ON u.id = l.owner_id
                WHERE l.status IN ('NEW', 'INTERESTED', 'QUOTATION_SENT')
                  AND l.created_at >= now() - make_interval(days => ?)
                  AND u.role = 'SALES' AND u.is_active = true
                  AND (
                        (CAST(? AS uuid) IS NOT NULL AND l.trip_id = CAST(? AS uuid))
                     OR (CAST(? AS text) IS NOT NULL AND lower(trim(coalesce(l.destination, ''))) = CAST(? AS text))
                     OR (CAST(? AS text) IS NOT NULL AND l.remarks ILIKE '%' || CAST(? AS text) || '%')
                  )
                ORDER BY
                  CASE WHEN CAST(? AS uuid) IS NOT NULL AND l.trip_id = CAST(? AS uuid) THEN 0 ELSE 1 END,
                  CASE WHEN CAST(? AS text) IS NOT NULL AND lower(trim(coalesce(l.destination, ''))) = CAST(? AS text) THEN 0 ELSE 1 END,
                  l.created_at DESC
                LIMIT 1
                """,
                STICKY_DAYS,
                tripId, tripId,
                destination, destination,
                campaignId == null ? null : "campaign_id=" + campaignId,
                campaignId == null ? null : "campaign_id=" + campaignId,
                tripId, tripId,
                destination, destination);

        if (rows.isEmpty() || rows.get(0).get("owner_id") == null) {
            return null;
        }
        return users.findById((UUID) rows.get(0).get("owner_id")).orElse(null);
    }

    private void upsertAssignment(UUID userId, LocalDate month) {
        jdbc.update("""
                INSERT INTO assignment_state (user_id, month, last_assigned_at, leads_assigned_this_month)
                VALUES (?, CAST(? AS date), now(), 1)
                ON CONFLICT (user_id, month)
                DO UPDATE SET last_assigned_at = now(),
                              leads_assigned_this_month = assignment_state.leads_assigned_this_month + 1
                """, userId, month);
    }

    static String normalizeDestination(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = raw.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return cleaned.isBlank() ? null : cleaned;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
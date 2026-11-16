package com.securetravels.crm.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Idempotent notification inserts via unique (user_id, dedupe_key). */
@Component
public class NotificationWriter {

    private static final Logger log = LoggerFactory.getLogger(NotificationWriter.class);

    private final NotificationRepository notifications;

    public NotificationWriter(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @Transactional
    public boolean saveOnce(UUID userId, String title, String body, String link, String dedupeKey) {
        if (userId == null) return false;
        if (dedupeKey != null && notifications.existsByUserIdAndDedupeKey(userId, dedupeKey)) {
            return false;
        }
        try {
            notifications.save(new Notification(userId, Notification.Channel.IN_APP,
                    title, body, link, dedupeKey));
            return true;
        } catch (DataIntegrityViolationException ex) {
            log.debug("[notify] duplicate suppressed user={} key={}", userId, dedupeKey);
            return false;
        }
    }
}

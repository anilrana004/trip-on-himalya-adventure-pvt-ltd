package com.securetravels.crm.automation.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Best-effort outbox publish for MIGRATE shadow. Failures never roll back the
 * caller's business transaction — the live hard-coded path already succeeded.
 */
@Component
public class AutomationEventShadow {

    private static final Logger log = LoggerFactory.getLogger(AutomationEventShadow.class);

    private final EventPublisher domainEvents;

    public AutomationEventShadow(EventPublisher domainEvents) {
        this.domainEvents = domainEvents;
    }

    public void publish(String entity, String action, UUID subjectId) {
        if (domainEvents == null || subjectId == null || entity == null || action == null || action.isBlank()) {
            return;
        }
        try {
            domainEvents.publish(new AutomationEvent(entity, action, subjectId, Instant.now()));
        } catch (Exception ex) {
            log.warn("[automation] outbox shadow failed entity={} action={} subject={}: {}",
                    entity, action, subjectId, ex.getMessage());
        }
    }
}

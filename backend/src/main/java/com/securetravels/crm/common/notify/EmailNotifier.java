package com.securetravels.crm.common.notify;

import com.securetravels.crm.communications.email.EmailGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Staff / ops email channel. Delivers through the same {@link EmailGateway}
 * bean used for guest mail (sandbox or SES). Callers stay consent-free —
 * this is for CRM users, not guests — so {@code SendGate} is never used here.
 */
@Component
public class EmailNotifier {

    private static final Logger log = LoggerFactory.getLogger(EmailNotifier.class);

    private final EmailGateway gateway;

    public EmailNotifier(EmailGateway gateway) {
        this.gateway = gateway;
    }

    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            log.warn("[mail] skip blank recipient subject={}", subject);
            return;
        }
        String idempotencyKey = "staff-mail-" + UUID.randomUUID();
        EmailGateway.SendResult result = gateway.send(new EmailGateway.SendCommand(
                to.trim(), subject, body, null, null, idempotencyKey));
        if (result.success()) {
            log.info("[mail] sent via {} to={} subject={} id={}",
                    gateway.provider(), to, subject, result.providerMessageId());
        } else {
            log.warn("[mail] failed via {} to={} subject={} error={} retryable={}",
                    gateway.provider(), to, subject, result.error(), result.retryable());
        }
    }
}

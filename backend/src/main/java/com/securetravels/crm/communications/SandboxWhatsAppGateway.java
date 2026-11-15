package com.securetravels.crm.communications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * No-credential WhatsApp gateway (default).
 *
 * <p>Records the send and returns a synthetic provider id so templates,
 * dispatch, DLQ, and timeline work before Meta Cloud API credentials exist.
 * Switch to {@link MetaWhatsAppGateway} with {@code app.whatsapp.mode=META}.
 */
@Component
@ConditionalOnProperty(prefix = "app.whatsapp", name = "mode",
        havingValue = "SANDBOX", matchIfMissing = true)
public class SandboxWhatsAppGateway implements WhatsAppGateway {

    private static final Logger log = LoggerFactory.getLogger(SandboxWhatsAppGateway.class);
    public static final String PROVIDER = "WHATSAPP_SANDBOX";

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public SendResult send(SendCommand command) {
        log.info("[whatsapp][sandbox] to={}{} template={} values={} callback={}",
                command.countryCode(), command.phoneNumber(), command.templateName(),
                command.bodyValues(), command.callbackData());
        return SendResult.ok("sandbox-" + UUID.randomUUID());
    }
}

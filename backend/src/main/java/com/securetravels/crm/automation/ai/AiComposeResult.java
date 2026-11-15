package com.securetravels.crm.automation.ai;

import java.util.List;

/**
 * Copy produced by {@link AiMessagingAgent} for a guest send.
 *
 * @param subject    email subject (null for WhatsApp)
 * @param body       free-form email/WA body when not using template slots
 * @param bodyValues ordered template slot values (WhatsApp LEAD_FOLLOW_UP etc.)
 * @param provider   STUB or OPENAI (for audit summary)
 */
public record AiComposeResult(String subject, String body, List<String> bodyValues, String provider) {
}

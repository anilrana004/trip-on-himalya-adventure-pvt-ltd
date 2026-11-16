package com.securetravels.crm.communications.whatsapp;

import java.time.Instant;
import java.util.UUID;

/**
 * One WhatsApp-reachable lead for the manager numbers desk.
 * Campaign launch still uses {@code leadId} — no parallel contact store.
 */
public record WhatsAppRecipientResponse(
        UUID leadId,
        String customerName,
        String mobile,
        String mobileDigits,
        boolean consentGiven,
        boolean eligible,
        String ineligibleReason,
        String status,
        String heat,
        String source,
        String destination,
        UUID ownerId,
        Instant createdAt
) {}

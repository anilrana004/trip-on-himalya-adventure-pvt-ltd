package com.securetravels.crm.communications.whatsapp;

import java.time.Instant;
import java.util.UUID;

public record BulkWhatsAppCampaignResponse(
        UUID id,
        String name,
        String templateCode,
        WhatsAppCampaign.DeliveryMode deliveryMode,
        WhatsAppCampaign.Status status,
        int totalRecipients,
        int sentCount,
        int failedCount,
        int skippedCount,
        Instant createdAt
) {
    public static BulkWhatsAppCampaignResponse from(WhatsAppCampaign c) {
        return new BulkWhatsAppCampaignResponse(
                c.getId(), c.getName(), c.getTemplateCode(), c.getDeliveryMode(), c.getStatus(),
                c.getTotalRecipients(), c.getSentCount(), c.getFailedCount(), c.getSkippedCount(),
                c.getCreatedAt());
    }
}

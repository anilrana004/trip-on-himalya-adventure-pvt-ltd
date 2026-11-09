package com.securetravels.crm.communications.email;

import java.time.Instant;
import java.util.UUID;

public record BulkEmailCampaignResponse(
        UUID id,
        String name,
        String templateCode,
        EmailCampaign.DeliveryMode deliveryMode,
        EmailCampaign.Status status,
        int totalRecipients,
        int sentCount,
        int failedCount,
        int skippedCount,
        Instant createdAt
) {
    public static BulkEmailCampaignResponse from(EmailCampaign c) {
        return new BulkEmailCampaignResponse(
                c.getId(), c.getName(), c.getTemplateCode(), c.getDeliveryMode(), c.getStatus(),
                c.getTotalRecipients(), c.getSentCount(), c.getFailedCount(), c.getSkippedCount(),
                c.getCreatedAt());
    }
}

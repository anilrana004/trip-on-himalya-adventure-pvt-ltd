package com.securetravels.crm.communications.email;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BulkEmailCampaignRequest(
        @NotBlank @Size(max = 200) String name,
        @NotEmpty List<UUID> leadIds,
        @Size(max = 80) String templateCode,
        @Size(max = 300) String subject,
        @Size(max = 5000) String body,
        EmailCampaign.DeliveryMode deliveryMode
) {}

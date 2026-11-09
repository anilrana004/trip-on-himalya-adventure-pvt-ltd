package com.securetravels.crm.communications.whatsapp;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record BulkWhatsAppCampaignRequest(
        @NotBlank @Size(max = 200) String name,
        @NotEmpty List<UUID> leadIds,
        @Size(max = 80) String templateCode,
        @Size(max = 5000) String body,
        WhatsAppCampaign.DeliveryMode deliveryMode
) {}

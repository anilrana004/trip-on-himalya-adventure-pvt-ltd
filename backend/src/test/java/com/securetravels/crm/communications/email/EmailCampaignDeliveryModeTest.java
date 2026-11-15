package com.securetravels.crm.communications.email;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EmailCampaignDeliveryModeTest {

    @Test
    void nullDeliveryMode_defaultsToInline() {
        EmailCampaign campaign = new EmailCampaign(
                "Test", "LEAD_FOLLOW_UP", null, null, null, UUID.randomUUID());
        assertThat(campaign.getDeliveryMode()).isEqualTo(EmailCampaign.DeliveryMode.INLINE);
    }

    @Test
    void explicitZapier_isPreserved() {
        EmailCampaign campaign = new EmailCampaign(
                "Test", "LEAD_FOLLOW_UP", null, null,
                EmailCampaign.DeliveryMode.ZAPIER, UUID.randomUUID());
        assertThat(campaign.getDeliveryMode()).isEqualTo(EmailCampaign.DeliveryMode.ZAPIER);
    }
}

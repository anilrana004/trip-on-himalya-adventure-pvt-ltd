package com.securetravels.crm.communications.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains queued bulk-WhatsApp recipients every minute (Zapier hook or inline SendGate).
 */
@Component
public class WhatsAppCampaignSweep {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppCampaignSweep.class);

    private final BulkWhatsAppCampaignService campaigns;

    public WhatsAppCampaignSweep(BulkWhatsAppCampaignService campaigns) {
        this.campaigns = campaigns;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 50_000)
    public void drain() {
        int n = campaigns.processBatch(25);
        if (n > 0) {
            log.info("[bulk-whatsapp-sweep] processed={}", n);
        }
    }
}

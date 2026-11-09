package com.securetravels.crm.communications.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains queued bulk-email recipients every minute (Zapier hook or inline SendGate).
 */
@Component
public class EmailCampaignSweep {

    private static final Logger log = LoggerFactory.getLogger(EmailCampaignSweep.class);

    private final BulkEmailCampaignService campaigns;

    public EmailCampaignSweep(BulkEmailCampaignService campaigns) {
        this.campaigns = campaigns;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
    public void drain() {
        int n = campaigns.processBatch(25);
        if (n > 0) {
            log.info("[bulk-email-sweep] processed={}", n);
        }
    }
}

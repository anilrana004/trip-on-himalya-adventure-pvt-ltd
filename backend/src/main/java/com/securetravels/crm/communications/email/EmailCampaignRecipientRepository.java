package com.securetravels.crm.communications.email;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmailCampaignRecipientRepository extends JpaRepository<EmailCampaignRecipient, UUID> {

    List<EmailCampaignRecipient> findByStatusOrderByCreatedAtAsc(
            EmailCampaignRecipient.Status status, Pageable pageable);

    List<EmailCampaignRecipient> findByCampaignIdOrderByCreatedAtAsc(UUID campaignId);

    long countByCampaignIdAndStatus(UUID campaignId, EmailCampaignRecipient.Status status);
}
